import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { FeatureKey, JwtPayload } from '@mfi/shared';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { FeatureUpdateItemDto } from './dto/set-features.dto';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';

@Injectable()
export class SuperAdminService {
  private readonly tenantSqlTemplate: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const templatePath = path.join(process.cwd(), 'prisma', 'tenant-schema-template.sql');
    this.tenantSqlTemplate = fs.readFileSync(templatePath, 'utf-8');
  }

  async login(dto: SuperAdminLoginDto): Promise<{ accessToken: string }> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: admin.id,
      email: admin.email,
      isSuperAdmin: true,
    };

    const accessToken = this.jwtService.sign(payload as unknown as Record<string, unknown>, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '4h' as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    return { accessToken };
  }

  async listTenants() {
    return this.prisma.tenant.findMany({
      where: { deletedAt: null },
      include: { features: true, subscription: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTenant(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Tenant with slug "${dto.slug}" already exists`);
    }

    const schemaName = `tenant_${dto.slug.replace(/-/g, '_')}`;

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          schemaName,
          brandPrimary: dto.brandPrimary,
          brandSecondary: dto.brandSecondary,
          features: {
            create: Object.values(FeatureKey).map((key) => ({
              featureKey: key,
              enabled: false,
            })),
          },
        },
        include: { features: true },
      });
      return created;
    });

    await this.provisionTenantSchema(schemaName);

    return tenant;
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id, deletedAt: null } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.brandPrimary !== undefined && { brandPrimary: dto.brandPrimary }),
        ...(dto.brandSecondary !== undefined && { brandSecondary: dto.brandSecondary }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.status && { status: dto.status }),
      },
      include: { features: true, subscription: true },
    });
  }

  async setFeatures(tenantId: string, features: FeatureUpdateItemDto[]) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.prisma.$transaction(
      features.map((f) =>
        this.prisma.tenantFeature.upsert({
          where: { tenantId_featureKey: { tenantId, featureKey: f.featureKey } },
          update: { enabled: f.enabled, enabledAt: f.enabled ? new Date() : null },
          create: { tenantId, featureKey: f.featureKey, enabled: f.enabled, enabledAt: f.enabled ? new Date() : null },
        }),
      ),
    );
  }

  async createPlatformAdmin(dto: CreatePlatformAdminDto) {
    const existing = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Platform admin with email "${dto.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const admin = await this.prisma.platformAdmin.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
    });

    return admin;
  }

  private async provisionTenantSchema(schemaName: string): Promise<void> {
    const sql = this.tenantSqlTemplate.replace(/:schema_name/g, schemaName);

    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await this.prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        throw new InternalServerErrorException(
          `Failed to provision tenant schema "${schemaName}": ${(err as Error).message}`,
        );
      }
    }
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
      include: { features: true, subscription: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async bootstrapFirstAdmin(dto: CreatePlatformAdminDto) {
    const count = await this.prisma.platformAdmin.count();
    if (count > 0) {
      throw new BadRequestException('Bootstrap is only allowed when no platform admins exist');
    }
    return this.createPlatformAdmin(dto);
  }
}
