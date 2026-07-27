import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomFieldType, TemplateStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthContext } from '../auth/auth-context';
import { assertSameMandal } from '../auth/tenant-scope';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { CreateSlipTemplateDto } from './dto/create-slip-template.dto';
import { CreateTemplateVersionDto } from './dto/create-template-version.dto';
import { SaveTemplateConfigDto } from './dto/save-template-config.dto';

const systemTemplateFields = new Set([
  'slipNumber',
  'contributorName',
  'contributorPhone',
  'contributorAddress',
  'shopName',
  'amount',
  'paymentMode',
  'areaName',
  'building_name',
  'collectorName',
  'createdAt',
  'donorType',
]);

type JsonWriteValue = never;

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomField(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    dto: CreateCustomFieldDto,
  ) {
    assertSameMandal(ctx, mandalId);
    await this.ensureFestival(mandalId, festivalId);

    const key = dto.key
      ? slugify(dto.key).replaceAll('-', '_')
      : slugify(dto.label).replaceAll('-', '_');
    if (!key) {
      throw new BadRequestException('Custom field key could not be generated.');
    }

    if (dto.type === CustomFieldType.DROPDOWN && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException('Dropdown fields require at least one option.');
    }

    try {
      const field = await this.prisma.customField.create({
        data: {
          dashboardFilter: dto.dashboardFilter,
          festivalId,
          key,
          label: dto.label,
          mandalId,
          options: dto.options ? toJsonWriteValue(dto.options) : undefined,
          printOnSlip: dto.printOnSlip,
          required: dto.required,
          sortOrder: dto.sortOrder,
          type: dto.type,
        },
      });

      await this.audit(ctx, mandalId, 'custom_field', field.id, 'created', undefined, field);
      return field;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Custom field key already exists for this festival.');
      }

      throw error;
    }
  }

  async listCustomFields(ctx: AuthContext, mandalId: string, festivalId: string) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.customField.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      where: { festivalId, mandalId },
    });
  }

  async createTemplate(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    dto: CreateSlipTemplateDto,
  ) {
    assertSameMandal(ctx, mandalId);
    await this.ensureFestival(mandalId, festivalId);

    const template = await this.prisma.slipTemplate.create({
      data: {
        createdBy: ctx.userId,
        festivalId,
        mandalId,
        name: dto.name,
        status: TemplateStatus.DRAFT,
      },
    });

    await this.audit(ctx, mandalId, 'slip_template', template.id, 'created', undefined, template);
    return template;
  }

  async listTemplates(ctx: AuthContext, mandalId: string, festivalId: string) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.slipTemplate.findMany({
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      where: { festivalId, mandalId },
    });
  }

  async saveActiveTemplateVersion(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    dto: SaveTemplateConfigDto,
  ) {
    assertSameMandal(ctx, mandalId);
    await this.ensureFestival(mandalId, festivalId);
    await this.validateRenderConfig(mandalId, festivalId, dto.renderConfig);

    return this.prisma.$transaction(async (tx) => {
      const template =
        (await tx.slipTemplate.findFirst({
          orderBy: { createdAt: 'asc' },
          where: { festivalId, mandalId },
        })) ??
        (await tx.slipTemplate.create({
          data: {
            createdBy: ctx.userId,
            festivalId,
            mandalId,
            name: dto.name?.trim() || 'Vargani Receipt Template',
            status: TemplateStatus.DRAFT,
          },
        }));

      const latest = await tx.slipTemplateVersion.aggregate({
        _max: { version: true },
        where: { templateId: template.id },
      });
      const versionNumber = (latest._max.version ?? 0) + 1;

      const version = await tx.slipTemplateVersion.create({
        data: {
          backgroundFileUrl: dto.backgroundFileUrl,
          canvasHeight: dto.canvasHeight,
          canvasWidth: dto.canvasWidth,
          renderConfig: toJsonWriteValue(dto.renderConfig),
          templateId: template.id,
          version: versionNumber,
        },
      });

      await tx.slipTemplateVersion.updateMany({
        data: { isActive: false },
        where: { templateId: template.id },
      });

      const activeVersion = await tx.slipTemplateVersion.update({
        data: { isActive: true },
        where: { id: version.id },
      });

      const activeTemplate = await tx.slipTemplate.update({
        data: {
          name: dto.name?.trim() || template.name,
          status: TemplateStatus.ACTIVE,
        },
        where: { id: template.id },
      });

      await tx.festival.update({
        data: { activeTemplateVersionId: activeVersion.id },
        where: { id: festivalId },
      });

      await tx.auditEvent.create({
        data: {
          action: 'saved_active_version',
          actorUserId: ctx.userId,
          after: toJsonWriteValue(activeVersion),
          entityId: activeVersion.id,
          entityType: 'slip_template_version',
          mandalId,
          metadata: toJsonWriteValue({
            templateId: activeTemplate.id,
            version: activeVersion.version,
          }),
        },
      });

      return {
        template: activeTemplate,
        version: activeVersion,
      };
    });
  }

  async createTemplateVersion(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    templateId: string,
    dto: CreateTemplateVersionDto,
  ) {
    assertSameMandal(ctx, mandalId);
    await this.ensureTemplate(mandalId, festivalId, templateId);
    await this.validateRenderConfig(mandalId, festivalId, dto.renderConfig);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.slipTemplateVersion.aggregate({
        _max: { version: true },
        where: { templateId },
      });
      const versionNumber = (latest._max.version ?? 0) + 1;

      const version = await tx.slipTemplateVersion.create({
        data: {
          backgroundFileUrl: dto.backgroundFileUrl,
          canvasHeight: dto.canvasHeight,
          canvasWidth: dto.canvasWidth,
          renderConfig: toJsonWriteValue(dto.renderConfig),
          templateId,
          version: versionNumber,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'created',
          actorUserId: ctx.userId,
          after: toJsonWriteValue(version),
          entityId: version.id,
          entityType: 'slip_template_version',
          mandalId,
        },
      });

      return version;
    });
  }

  async activateTemplateVersion(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    templateId: string,
    versionId: string,
  ) {
    assertSameMandal(ctx, mandalId);
    await this.ensureTemplate(mandalId, festivalId, templateId);

    const version = await this.prisma.slipTemplateVersion.findFirst({
      where: { id: versionId, templateId },
    });

    if (!version) {
      throw new NotFoundException('Template version not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.slipTemplateVersion.updateMany({
        data: { isActive: false },
        where: { templateId },
      });

      const activeVersion = await tx.slipTemplateVersion.update({
        data: { isActive: true },
        where: { id: versionId },
      });

      await tx.slipTemplate.update({
        data: { status: TemplateStatus.ACTIVE },
        where: { id: templateId },
      });

      await tx.festival.update({
        data: { activeTemplateVersionId: versionId },
        where: { id: festivalId },
      });

      await tx.auditEvent.create({
        data: {
          action: 'activated',
          actorUserId: ctx.userId,
          after: toJsonWriteValue(activeVersion),
          entityId: versionId,
          entityType: 'slip_template_version',
          mandalId,
        },
      });

      return activeVersion;
    });
  }

  private async ensureFestival(mandalId: string, festivalId: string) {
    const festival = await this.prisma.festival.findFirst({
      where: { id: festivalId, mandalId },
    });

    if (!festival) {
      throw new NotFoundException('Festival not found.');
    }

    return festival;
  }

  private async ensureTemplate(mandalId: string, festivalId: string, templateId: string) {
    const template = await this.prisma.slipTemplate.findFirst({
      where: { festivalId, id: templateId, mandalId },
    });

    if (!template) {
      throw new NotFoundException('Template not found.');
    }

    return template;
  }

  private async validateRenderConfig(
    mandalId: string,
    festivalId: string,
    renderConfig: Record<string, unknown>,
  ) {
    const fields = renderConfig.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new BadRequestException('renderConfig.fields is required.');
    }

    const customFields = await this.prisma.customField.findMany({
      select: { key: true },
      where: { festivalId, mandalId },
    });
    const allowedKeys = new Set([
      ...systemTemplateFields,
      ...customFields.map((field) => field.key),
    ]);

    for (const key of Object.keys(fields)) {
      if (!allowedKeys.has(key)) {
        throw new BadRequestException(`Unknown template field binding: ${key}.`);
      }
    }
  }

  private async audit(
    ctx: AuthContext,
    mandalId: string,
    entityType: string,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        action,
        actorUserId: ctx.userId,
        after: toJsonWriteValue(after),
        before: toJsonWriteValue(before),
        entityId,
        entityType,
        mandalId,
      },
    });
  }
}

function toJsonWriteValue(value: unknown): JsonWriteValue {
  return value as JsonWriteValue;
}
