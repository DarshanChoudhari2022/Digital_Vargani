import { ConflictException, Injectable } from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { AuthContext } from '../auth/auth-context';
import { assertSameMandal } from '../auth/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateMemberDto } from './dto/create-member.dto';

const allowedMemberRoles = new Set<UserRole>([
  UserRole.KHAJINDAR,
  UserRole.GROUP_LEADER,
  UserRole.MEMBER,
]);

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(ctx: AuthContext, mandalId: string, festivalId: string, dto: CreateGroupDto) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.memberGroup.create({
      data: {
        areaName: dto.areaName,
        festivalId,
        leaderUserId: dto.leaderUserId,
        mandalId,
        name: dto.name,
      },
    });
  }

  async listGroups(ctx: AuthContext, mandalId: string, festivalId: string) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.memberGroup.findMany({
      include: {
        leader: { select: { id: true, name: true, phone: true } },
        _count: { select: { members: true, slips: true } },
      },
      orderBy: { name: 'asc' },
      where: { festivalId, mandalId },
    });
  }

  async createMember(ctx: AuthContext, mandalId: string, festivalId: string, dto: CreateMemberDto) {
    assertSameMandal(ctx, mandalId);

    if (!allowedMemberRoles.has(dto.role)) {
      throw new ConflictException('Invalid mandal member role.');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email?.toLowerCase() }, { phone: dto.phone }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Member email or phone already exists.');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email?.toLowerCase(),
          mandalId,
          name: dto.name,
          passwordHash: await argon2.hash(dto.password),
          phone: dto.phone,
          role: dto.role,
          status: AccountStatus.ACTIVE,
        },
      });

      const member = await tx.member.create({
        data: {
          areaName: dto.areaName,
          displayName: dto.name,
          festivalId,
          groupId: dto.groupId,
          mandalId,
          phone: dto.phone,
          status: AccountStatus.ACTIVE,
          userId: user.id,
        },
      });

      return {
        member,
        user: {
          email: user.email,
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: user.status,
        },
      };
    });
  }

  async listMembers(ctx: AuthContext, mandalId: string, festivalId: string) {
    assertSameMandal(ctx, mandalId);

    return this.prisma.member.findMany({
      include: {
        group: { select: { id: true, name: true, areaName: true } },
        user: {
          select: { id: true, name: true, phone: true, email: true, role: true, status: true },
        },
      },
      orderBy: { displayName: 'asc' },
      where: { festivalId, mandalId },
    });
  }
}
