import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, AuthenticatedUser, UserRole } from '@mfi/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload & { isPortalUser?: boolean }): Promise<AuthenticatedUser> {
    if (payload.isPortalUser) {
      // Portal tokens are validated by the portal controller directly; pass through with minimal shape
      return { id: payload.sub, email: '', roles: [], tenantId: (payload as { tenantId?: string }).tenantId };
    }

    if (payload.isSuperAdmin) {
      const admin = await this.prisma.platformAdmin.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, isActive: true },
      });
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Platform admin account is disabled or not found');
      }
      return {
        id: admin.id,
        email: admin.email,
        roles: [UserRole.SUPER_ADMIN],
        isSuperAdmin: true,
      };
    }

    const user = await this.prisma.tenantUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, tenantId: true, roles: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is disabled or not found');
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles as AuthenticatedUser['roles'],
    };
  }
}
