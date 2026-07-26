import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomFieldType,
  FestivalStatus,
  Prisma,
  RenderStatus,
  SlipStatus,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthContext } from '../auth/auth-context';
import { requireMandalId } from '../auth/tenant-scope';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CancelSlipDto } from './dto/cancel-slip.dto';
import { CreateVarganiSlipDto } from './dto/create-vargani-slip.dto';

interface SequenceRow {
  current_value: bigint;
}

@Injectable()
export class VarganiService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveForm(ctx: AuthContext) {
    const mandalId = requireMandalId(ctx);
    const festival = await this.getActiveFestival(mandalId);
    const [member, customFields] = await Promise.all([
      this.prisma.member.findFirst({
        include: { group: true },
        where: { festivalId: festival.id, mandalId, userId: ctx.userId },
      }),
      this.prisma.customField.findMany({
        orderBy: { sortOrder: 'asc' },
        where: { festivalId: festival.id, mandalId },
      }),
    ]);

    return {
      customFields,
      festival,
      member,
      systemFields: [
        'contributorName',
        'contributorPhone',
        'contributorAddress',
        'shopName',
        'amount',
        'paymentMode',
        'areaName',
      ],
    };
  }

  async createSlip(ctx: AuthContext, dto: CreateVarganiSlipDto) {
    const mandalId = requireMandalId(ctx);
    const festival = await this.getActiveFestival(mandalId);
    const member = await this.prisma.member.findFirst({
      where: { festivalId: festival.id, mandalId, userId: ctx.userId },
    });

    if (!member && ctx.role === UserRole.MEMBER) {
      throw new ForbiddenException('Member is not assigned to the active festival.');
    }

    const customFields = await this.prisma.customField.findMany({
      where: { festivalId: festival.id, mandalId },
    });
    this.validateCustomData(customFields, dto.customData ?? {});

    if (dto.idempotencyKey) {
      const existing = await this.prisma.varganiSlip.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existing) {
        return existing;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const nextValue = await this.nextSlipSequence(tx, mandalId, festival.id);
      const slipNumber = `DM-${festival.type.slice(0, 3).toUpperCase()}-${new Date(festival.startDate).getFullYear()}-${String(nextValue).padStart(6, '0')}`;

      const slip = await tx.varganiSlip.create({
        data: {
          amount: dto.amount,
          areaName: dto.areaName ?? member?.areaName,
          collectedByUserId: ctx.userId,
          contributorAddress: dto.contributorAddress,
          contributorName: dto.contributorName,
          contributorPhone: dto.contributorPhone,
          customData: (dto.customData ?? {}) as Prisma.InputJsonValue,
          festivalId: festival.id,
          groupId: member?.groupId,
          idempotencyKey: dto.idempotencyKey,
          mandalId,
          paymentMode: dto.paymentMode,
          renderStatus: RenderStatus.PENDING,
          shopName: dto.shopName,
          slipNumber,
          status: SlipStatus.ACTIVE,
          templateVersionId: festival.activeTemplateVersionId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'created',
          after: slip as unknown as Prisma.InputJsonValue,
          actorUserId: ctx.userId,
          entityId: slip.id,
          entityType: 'vargani_slip',
          mandalId,
        },
      });

      return slip;
    });
  }

  async listSlips(ctx: AuthContext, query: PaginationQueryDto) {
    const mandalId = requireMandalId(ctx);
    const festival = await this.getActiveFestival(mandalId);
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.VarganiSlipWhereInput = {
      festivalId: festival.id,
      mandalId,
    };

    if (ctx.role === UserRole.MEMBER) {
      where.collectedByUserId = ctx.userId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.varganiSlip.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        where,
      }),
      this.prisma.varganiSlip.count({ where }),
    ]);

    return {
      items,
      meta: {
        limit: query.limit,
        page: query.page,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getSlip(ctx: AuthContext, id: string) {
    const mandalId = requireMandalId(ctx);
    const slip = await this.prisma.varganiSlip.findFirst({
      include: {
        collector: { select: { id: true, name: true, phone: true } },
        festival: true,
        group: true,
      },
      where: { id, mandalId },
    });

    if (!slip || (ctx.role === UserRole.MEMBER && slip.collectedByUserId !== ctx.userId)) {
      throw new NotFoundException('Slip not found.');
    }

    return slip;
  }

  async cancelSlip(ctx: AuthContext, id: string, dto: CancelSlipDto) {
    const mandalId = requireMandalId(ctx);
    const slip = await this.prisma.varganiSlip.findFirst({ where: { id, mandalId } });

    if (!slip) {
      throw new NotFoundException('Slip not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.varganiSlip.update({
        data: {
          cancellationReason: dto.reason,
          cancelledAt: new Date(),
          status: SlipStatus.CANCELLED,
        },
        where: { id },
      });

      await tx.auditEvent.create({
        data: {
          action: 'cancelled',
          actorUserId: ctx.userId,
          before: slip as unknown as Prisma.InputJsonValue,
          after: updated as unknown as Prisma.InputJsonValue,
          entityId: id,
          entityType: 'vargani_slip',
          mandalId,
        },
      });

      return updated;
    });
  }

  private async getActiveFestival(mandalId: string) {
    const festival = await this.prisma.festival.findFirst({
      where: { mandalId, status: FestivalStatus.ACTIVE },
    });

    if (!festival) {
      throw new NotFoundException('No active festival found.');
    }

    return festival;
  }

  private async nextSlipSequence(
    tx: Prisma.TransactionClient,
    mandalId: string,
    festivalId: string,
  ): Promise<number> {
    await tx.$executeRaw`
      INSERT INTO "slip_sequences" ("id", "mandal_id", "festival_id", "current_value", "updated_at")
      VALUES (${randomUUID()}::uuid, ${mandalId}::uuid, ${festivalId}::uuid, 0, now())
      ON CONFLICT ("mandal_id", "festival_id") DO NOTHING
    `;

    const rows = await tx.$queryRaw<SequenceRow[]>`
      UPDATE "slip_sequences"
      SET "current_value" = "current_value" + 1, "updated_at" = now()
      WHERE "mandal_id" = ${mandalId}::uuid AND "festival_id" = ${festivalId}::uuid
      RETURNING "current_value"
    `;

    if (!rows[0]) {
      throw new BadRequestException('Could not generate slip number.');
    }

    return Number(rows[0].current_value);
  }

  private validateCustomData(
    customFields: Array<{ key: string; label: string; required: boolean; type: CustomFieldType }>,
    customData: Record<string, unknown>,
  ) {
    for (const field of customFields) {
      const value = customData[field.key];

      if (field.required && (value === undefined || value === null || value === '')) {
        throw new BadRequestException(`${field.label} is required.`);
      }
    }
  }
}
