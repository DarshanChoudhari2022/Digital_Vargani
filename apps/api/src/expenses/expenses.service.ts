import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseStatus } from '@prisma/client';
import { AuthContext } from '../auth/auth-context';
import { assertSameMandal } from '../auth/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseStatusDto } from './dto/update-expense-status.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(ctx: AuthContext, mandalId: string, dto: CreateExpenseCategoryDto) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.expenseCategory.create({
      data: {
        mandalId,
        name: dto.name,
      },
    });
  }

  async listCategories(ctx: AuthContext, mandalId: string) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
      where: { mandalId },
    });
  }

  async createExpense(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    dto: CreateExpenseDto,
  ) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.expense.create({
      data: {
        amount: dto.amount,
        billFileUrl: dto.billFileUrl,
        categoryId: dto.categoryId,
        createdBy: ctx.userId,
        expenseDate: new Date(dto.expenseDate),
        festivalId,
        mandalId,
        notes: dto.notes,
        status: dto.status ?? ExpenseStatus.SUBMITTED,
        vendorName: dto.vendorName,
      },
    });
  }

  async listExpenses(ctx: AuthContext, mandalId: string, festivalId: string) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.expense.findMany({
      include: {
        approver: { select: { id: true, name: true } },
        category: true,
        creator: { select: { id: true, name: true } },
      },
      orderBy: { expenseDate: 'desc' },
      where: { festivalId, mandalId },
    });
  }

  async updateStatus(
    ctx: AuthContext,
    mandalId: string,
    expenseId: string,
    dto: UpdateExpenseStatusDto,
  ) {
    assertSameMandal(ctx, mandalId);

    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, mandalId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    return this.prisma.expense.update({
      data: {
        approvedBy: dto.status === ExpenseStatus.APPROVED ? ctx.userId : null,
        status: dto.status,
      },
      where: { id: expenseId },
    });
  }
}
