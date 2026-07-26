import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthContext } from '../auth/auth-context';
import { assertSameMandal } from '../auth/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvents(ctx: AuthContext, mandalId: string, query: AuditEventsQueryDto) {
    assertSameMandal(ctx, mandalId);

    const skip = (query.page - 1) * query.limit;
    const where: Prisma.AuditEventWhereInput = {
      action: query.action,
      actorUserId: query.actorUserId,
      entityId: query.entityId,
      entityType: query.entityType,
      mandalId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        include: {
          actor: { select: { id: true, name: true, phone: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        where,
      }),
      this.prisma.auditEvent.count({ where }),
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
}
