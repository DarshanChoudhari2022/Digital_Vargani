import { Injectable } from '@nestjs/common';
import { Prisma, SlipStatus } from '@prisma/client';
import { AuthContext } from '../auth/auth-context';
import { assertSameMandal } from '../auth/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionReportQueryDto } from './dto/collection-report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCollectionReport(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    query: CollectionReportQueryDto,
  ) {
    assertSameMandal(ctx, mandalId);

    const createdAt =
      query.dateFrom || query.dateTo
        ? {
            gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
            lte: query.dateTo ? new Date(query.dateTo) : undefined,
          }
        : undefined;

    const where: Prisma.VarganiSlipWhereInput = {
      areaName: query.areaName,
      collectedByUserId: query.memberId,
      createdAt,
      festivalId,
      groupId: query.groupId,
      mandalId,
      paymentMode: query.paymentMode,
      status: SlipStatus.ACTIVE,
    };

    const [summary, byMember, byGroup, byPaymentMode, expenses] = await this.prisma.$transaction([
      this.prisma.varganiSlip.aggregate({
        _count: { id: true },
        _sum: { amount: true },
        where,
      }),
      this.prisma.varganiSlip.groupBy({
        _count: { id: true },
        _sum: { amount: true },
        by: ['collectedByUserId'],
        orderBy: { collectedByUserId: 'asc' },
        where,
      }),
      this.prisma.varganiSlip.groupBy({
        _count: { id: true },
        _sum: { amount: true },
        by: ['groupId'],
        orderBy: { groupId: 'asc' },
        where,
      }),
      this.prisma.varganiSlip.groupBy({
        _count: { id: true },
        _sum: { amount: true },
        by: ['paymentMode'],
        orderBy: { paymentMode: 'asc' },
        where,
      }),
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          festivalId,
          mandalId,
          status: 'APPROVED',
        },
      }),
    ]);

    const totalCollection = Number(summary._sum.amount ?? 0);
    const totalExpenses = Number(expenses._sum.amount ?? 0);

    return {
      balance: totalCollection - totalExpenses,
      byGroup,
      byMember,
      byPaymentMode,
      slipCount: summary._count.id,
      totalCollection,
      totalExpenses,
    };
  }
}
