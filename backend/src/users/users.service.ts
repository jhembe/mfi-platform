import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/user.dto';
import { UserRole } from '@mfi/shared';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const users = await this.prisma.tenantUser.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        roles: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    });
    return users;
  }

  async get(tenantId: string, id: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        roles: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.prisma.tenantUser.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing) throw new ConflictException('A user with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.tenantUser.create({
      data: {
        tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        roles: dto.roles,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        roles: true, isActive: true, createdAt: true, updatedAt: true,
      },
    });
    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.get(tenantId, id);
    return this.prisma.tenantUser.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.roles && { roles: dto.roles }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        roles: true, isActive: true, updatedAt: true,
      },
    });
  }

  async deactivate(tenantId: string, id: string, requesterId: string) {
    if (id === requesterId) throw new ForbiddenException('You cannot deactivate your own account');
    await this.get(tenantId, id);
    return this.prisma.tenantUser.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });
  }

  async activate(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.tenantUser.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, email: true, isActive: true },
    });
  }

  async resetPassword(tenantId: string, id: string, dto: ResetPasswordDto) {
    await this.get(tenantId, id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.tenantUser.update({ where: { id }, data: { passwordHash } });
    return { success: true };
  }

  async stats(tenantId: string) {
    const [total, active, byRole] = await Promise.all([
      this.prisma.tenantUser.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.tenantUser.count({ where: { tenantId, deletedAt: null, isActive: true } }),
      this.prisma.tenantUser.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
        select: { roles: true },
      }),
    ]);

    const roleCounts: Record<string, number> = {};
    for (const u of byRole) {
      for (const r of u.roles) {
        roleCounts[r] = (roleCounts[r] ?? 0) + 1;
      }
    }

    return { total, active, inactive: total - active, byRole: roleCounts };
  }
}
