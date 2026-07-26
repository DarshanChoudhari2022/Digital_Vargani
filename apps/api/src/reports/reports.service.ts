import { Injectable } from '@nestjs/common';
import { PaymentMode, SlipStatus } from '@prisma/client';
import { AuthContext } from '../auth/auth-context';
import { assertSameMandal } from '../auth/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionReportQueryDto } from './dto/collection-report-query.dto';

interface SlipReportWhere {
  areaName?: string;
  collectedByUserId?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  festivalId: string;
  groupId?: string;
  mandalId: string;
  paymentMode?: PaymentMode;
  status: SlipStatus;
}

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

    const where: SlipReportWhere = {
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

  async exportCollectionReportCsv(
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

    const where: SlipReportWhere = {
      areaName: query.areaName,
      collectedByUserId: query.memberId,
      createdAt,
      festivalId,
      groupId: query.groupId,
      mandalId,
      paymentMode: query.paymentMode,
      status: SlipStatus.ACTIVE,
    };

    const slips = await this.prisma.varganiSlip.findMany({
      include: {
        collector: { select: { name: true, phone: true } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      where,
    });

    const rows = slips.map((slip) => [
      slip.slipNumber,
      slip.createdAt.toISOString(),
      slip.contributorName,
      slip.shopName ?? '',
      slip.contributorPhone ?? '',
      slip.contributorAddress ?? '',
      slip.areaName ?? '',
      slip.group?.name ?? '',
      slip.collector.name,
      slip.collector.phone ?? '',
      slip.paymentMode,
      Number(slip.amount).toFixed(2),
    ]);

    return toCsv([
      [
        'Slip Number',
        'Created At',
        'Contributor Name',
        'Shop Name',
        'Phone',
        'Address',
        'Area',
        'Group',
        'Collected By',
        'Collector Phone',
        'Payment Mode',
        'Amount',
      ],
      ...rows,
    ]);
  }
}

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}
