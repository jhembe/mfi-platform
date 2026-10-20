import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';
import { JwtPayload, FeatureKey } from '@mfi/shared';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.tenantId) {
      return next();
    }

    const features = await this.prisma.tenantFeature.findMany({
      where: { tenantId: payload.tenantId, enabled: true },
      select: { featureKey: true },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { schemaName: true },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    const featureKeys = features.map((f) => f.featureKey as FeatureKey);

    this.tenantContext.set({
      tenantId: payload.tenantId,
      schemaName: tenant.schemaName,
      features: featureKeys,
    });

    (req as Request & { tenantFeatures: FeatureKey[] }).tenantFeatures = featureKeys;

    next();
  }
}
