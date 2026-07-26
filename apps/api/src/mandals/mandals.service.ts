import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMandalDto } from './dto/create-mandal.dto';
import { ListMandalsQueryDto } from './dto/list-mandals-query.dto';
import { UpdateMandalStatusDto } from './dto/update-mandal-status.dto';

type JsonWriteValue = never;

interface MandalListWhere {
  OR?: Array<{
    city?: { contains: string; mode: 'insensitive' };
    locality?: { contains: string; mode: 'insensitive' };
    name?: { contains: string; mode: 'insensitive' };
    slug?: { contains: string; mode: 'insensitive' };
  }>;
  status?: AccountStatus;
}

@Injectable()
export class MandalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMandalDto) {
    const slug = dto.slug ?? slugify(dto.name);

    if (!slug) {
      throw new ConflictException('Mandal slug could not be generated.');
    }

    const existingMandal = await this.prisma.mandal.findUnique({ where: { slug } });

    if (existingMandal) {
      throw new ConflictException('Mandal slug already exists.');
    }

    const existingAdmin = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.admin.email.toLowerCase() }, { phone: dto.admin.phone }],
      },
    });

    if (existingAdmin) {
      throw new ConflictException('Admin email or phone is already used.');
    }

    return this.prisma.$transaction(async (tx) => {
      const mandal = await tx.mandal.create({
        data: {
          address: dto.address,
          city: dto.city,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          locality: dto.locality,
          name: dto.name,
          plan: dto.plan ?? 'starter',
          slug,
          state: dto.state,
          status: AccountStatus.ACTIVE,
        },
      });

      const admin = await tx.user.create({
        data: {
          email: dto.admin.email.toLowerCase(),
          mandalId: mandal.id,
          name: dto.admin.name,
          passwordHash: await argon2.hash(dto.admin.password),
          phone: dto.admin.phone,
          role: UserRole.MANDAL_ADMIN,
          status: AccountStatus.ACTIVE,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'created',
          after: this.toJson({ mandalId: mandal.id, adminUserId: admin.id }),
          entityId: mandal.id,
          entityType: 'mandal',
          mandalId: mandal.id,
        },
      });

      return {
        admin: this.serializeAdmin(admin),
        mandal,
      };
    });
  }

  async list(query: ListMandalsQueryDto) {
    const where: MandalListWhere = {
      status: query.status,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { locality: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mandal.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        where,
      }),
      this.prisma.mandal.count({ where }),
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

  async getById(id: string) {
    const mandal = await this.prisma.mandal.findUnique({
      include: {
        users: {
          select: {
            createdAt: true,
            email: true,
            id: true,
            name: true,
            phone: true,
            role: true,
            status: true,
          },
          where: {
            role: UserRole.MANDAL_ADMIN,
          },
        },
        _count: {
          select: {
            festivals: true,
            members: true,
            slips: true,
          },
        },
      },
      where: { id },
    });

    if (!mandal) {
      throw new NotFoundException('Mandal not found.');
    }

    return mandal;
  }

  async updateStatus(id: string, dto: UpdateMandalStatusDto) {
    const mandal = await this.prisma.mandal.findUnique({ where: { id } });

    if (!mandal) {
      throw new NotFoundException('Mandal not found.');
    }

    const updated = await this.prisma.mandal.update({
      data: { status: dto.status },
      where: { id },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'status_updated',
        after: this.toJson({ status: updated.status }),
        before: this.toJson({ status: mandal.status }),
        entityId: id,
        entityType: 'mandal',
        mandalId: id,
      },
    });

    return updated;
  }

  private serializeAdmin(admin: {
    createdAt: Date;
    email: string | null;
    id: string;
    name: string;
    phone: string | null;
    role: UserRole;
    status: AccountStatus;
  }) {
    return {
      createdAt: admin.createdAt,
      email: admin.email,
      id: admin.id,
      name: admin.name,
      phone: admin.phone,
      role: admin.role,
      status: admin.status,
    };
  }

  private toJson(value: unknown): JsonWriteValue {
    return value as JsonWriteValue;
  }
}
