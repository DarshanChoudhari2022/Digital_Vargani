import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ExpenseStatus, FestivalStatus, Prisma, SlipStatus, UserRole } from '@prisma/client';
import { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(ctx: AuthContext) {
    if (ctx.role === UserRole.SUPER_ADMIN) {
      return this.bootstrapOwner(ctx);
    }

    if (!ctx.mandalId) {
      throw new NotFoundException('Mandal workspace not found.');
    }

    return this.bootstrapMandal(ctx);
  }

  private async bootstrapOwner(ctx: AuthContext) {
    const [mandalRows, totalMandals, totalMembers, totalSlips] = await this.prisma.$transaction([
      this.prisma.mandal.findMany({
        include: {
          _count: {
            select: {
              members: true,
              slips: true,
              users: true,
            },
          },
          users: {
            orderBy: { createdAt: 'asc' },
            select: {
              createdAt: true,
              email: true,
              id: true,
              lastLoginAt: true,
              name: true,
              phone: true,
              role: true,
              status: true,
            },
            where: { role: UserRole.MANDAL_ADMIN },
          },
          festivals: {
            orderBy: { startDate: 'desc' },
            select: {
              id: true,
              name: true,
              status: true,
              targetAmount: true,
              templates: {
                include: {
                  versions: {
                    orderBy: { version: 'desc' },
                    where: { isActive: true },
                  },
                },
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
              type: true,
            },
            take: 1,
            where: { status: FestivalStatus.ACTIVE },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        where: { status: AccountStatus.ACTIVE },
      }),
      this.prisma.mandal.count({ where: { status: AccountStatus.ACTIVE } }),
      this.prisma.member.count({ where: { status: AccountStatus.ACTIVE } }),
      this.prisma.varganiSlip.count({ where: { status: SlipStatus.ACTIVE } }),
    ]);

    return {
      kind: 'OWNER',
      generatedAt: new Date().toISOString(),
      mandals: {
        items: mandalRows,
        meta: {
          limit: 100,
          page: 1,
          total: totalMandals,
          totalPages: Math.ceil(totalMandals / 100),
        },
      },
      metrics: {
        totalMandals,
        totalMembers,
        totalSlips,
      },
      user: await this.getUser(ctx.userId),
    };
  }

  private async bootstrapMandal(ctx: AuthContext) {
    const mandalId = ctx.mandalId as string;
    const mandal = await this.prisma.mandal.findUnique({
      where: { id: mandalId },
    });

    if (!mandal) {
      throw new NotFoundException('Mandal workspace not found.');
    }

    const activeFestival = await this.prisma.festival.findFirst({
      orderBy: { startDate: 'desc' },
      where: { mandalId, status: FestivalStatus.ACTIVE },
    });

    if (!activeFestival) {
      return {
        activeForm: null,
        festival: null,
        generatedAt: new Date().toISOString(),
        groups: [],
        kind: 'MANDAL',
        mandal,
        members: [],
        metrics: emptyMandalMetrics(),
        report: emptyReport(),
        slips: { items: [], meta: { limit: 50, page: 1, total: 0, totalPages: 0 } },
        templates: [],
        user: await this.getUser(ctx.userId),
      };
    }

    const visibleSlipWhere: Prisma.VarganiSlipWhereInput = {
      collectedByUserId: ctx.role === UserRole.MEMBER ? ctx.userId : undefined,
      festivalId: activeFestival.id,
      mandalId,
    };

    const [
      currentMember,
      customFields,
      groups,
      members,
      templates,
      slips,
      slipTotal,
      activeSlipAmount,
      pendingSlipAmount,
      approvedExpenseAmount,
      paidCollectors,
      memberTotal,
      users,
      auditEvents,
    ] = await this.prisma.$transaction([
      this.prisma.member.findFirst({
        include: { group: true },
        where: { festivalId: activeFestival.id, mandalId, userId: ctx.userId },
      }),
      this.prisma.customField.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        where: { festivalId: activeFestival.id, mandalId },
      }),
      this.prisma.memberGroup.findMany({
        include: {
          leader: { select: { id: true, name: true, phone: true } },
          _count: { select: { members: true, slips: true } },
        },
        orderBy: { name: 'asc' },
        where: { festivalId: activeFestival.id, mandalId },
      }),
      this.prisma.member.findMany({
        include: {
          group: { select: { areaName: true, id: true, name: true } },
          user: {
            select: { email: true, id: true, name: true, phone: true, role: true, status: true },
          },
        },
        orderBy: { displayName: 'asc' },
        take: 200,
        where: { festivalId: activeFestival.id, mandalId },
      }),
      this.prisma.slipTemplate.findMany({
        include: {
          versions: {
            orderBy: { version: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        where: { festivalId: activeFestival.id, mandalId },
      }),
      this.prisma.varganiSlip.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        where: visibleSlipWhere,
      }),
      this.prisma.varganiSlip.count({ where: visibleSlipWhere }),
      this.prisma.varganiSlip.aggregate({
        _count: { id: true },
        _sum: { amount: true },
        where: { festivalId: activeFestival.id, mandalId, status: SlipStatus.ACTIVE },
      }),
      this.prisma.varganiSlip.aggregate({
        _count: { id: true },
        _sum: { amount: true },
        where: { festivalId: activeFestival.id, mandalId, status: SlipStatus.PENDING },
      }),
      this.prisma.expense.aggregate({
        _count: { id: true },
        _sum: { amount: true },
        where: { festivalId: activeFestival.id, mandalId, status: ExpenseStatus.APPROVED },
      }),
      this.prisma.varganiSlip.findMany({
        distinct: ['collectedByUserId'],
        select: { collectedByUserId: true },
        where: {
          festivalId: activeFestival.id,
          mandalId,
          status: SlipStatus.ACTIVE,
        },
      }),
      this.prisma.member.count({ where: { festivalId: activeFestival.id, mandalId } }),
      this.prisma.user.findMany({
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          createdAt: true,
          email: true,
          id: true,
          lastLoginAt: true,
          name: true,
          phone: true,
          role: true,
          status: true,
        },
        take: 100,
        where: { mandalId },
      }),
      this.prisma.auditEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        where: { mandalId },
      }),
    ]);

    const totalCollection = Number(activeSlipAmount._sum.amount ?? 0);
    const totalExpenses = Number(approvedExpenseAmount._sum.amount ?? 0);
    const memberPaidCount = paidCollectors.length;

    return {
      activeForm: {
        customFields,
        festival: activeFestival,
        member: currentMember,
        systemFields: [
          'contributorName',
          'contributorPhone',
          'contributorAddress',
          'shopName',
          'amount',
          'paymentMode',
          'areaName',
        ],
      },
      auditEvents,
      festival: activeFestival,
      generatedAt: new Date().toISOString(),
      groups,
      kind: 'MANDAL',
      mandal,
      members,
      metrics: {
        balance: totalCollection - totalExpenses,
        memberPaidCount,
        memberPendingAmount: Math.max(0, Number(pendingSlipAmount._sum.amount ?? 0)),
        memberPendingCount: Math.max(0, memberTotal - memberPaidCount),
        memberTotal,
        slipPaidAmount: totalCollection,
        slipPaidCount: activeSlipAmount._count.id,
        slipPendingAmount: Number(pendingSlipAmount._sum.amount ?? 0),
        slipPendingCount: pendingSlipAmount._count.id,
        totalExpenses,
      },
      report: {
        balance: totalCollection - totalExpenses,
        byGroup: [],
        byMember: [],
        byPaymentMode: [],
        slipCount: activeSlipAmount._count.id,
        totalCollection,
        totalExpenses,
      },
      slips: {
        items: slips,
        meta: {
          limit: 50,
          page: 1,
          total: slipTotal,
          totalPages: Math.ceil(slipTotal / 50),
        },
      },
      templates,
      user: await this.getUser(ctx.userId),
      users,
    };
  }

  private getUser(userId: string) {
    return this.prisma.user.findUnique({
      select: {
        createdAt: true,
        email: true,
        id: true,
        lastLoginAt: true,
        mandalId: true,
        name: true,
        phone: true,
        role: true,
        status: true,
      },
      where: { id: userId },
    });
  }
}

function emptyReport() {
  return {
    balance: 0,
    byGroup: [],
    byMember: [],
    byPaymentMode: [],
    slipCount: 0,
    totalCollection: 0,
    totalExpenses: 0,
  };
}

function emptyMandalMetrics() {
  return {
    balance: 0,
    memberPaidCount: 0,
    memberPendingAmount: 0,
    memberPendingCount: 0,
    memberTotal: 0,
    slipPaidAmount: 0,
    slipPaidCount: 0,
    slipPendingAmount: 0,
    slipPendingCount: 0,
    totalExpenses: 0,
  };
}
