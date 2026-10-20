import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '../redis/redis.module';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { generateSecret as totpGenerateSecret, generateURI as totpGenerateURI, verifySync as totpVerifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload, TokenPair, AuthenticatedUser } from '@mfi/shared';
import { LoginDto } from './dto/login.dto';

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const TOTP_TEMP_TTL_SECONDS = 5 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async login(dto: LoginDto, tenantId: string): Promise<TokenPair | { requires2fa: true; tempToken: string }> {
    const user = await this.prisma.tenantUser.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.totpEnabled && user.totpSecret) {
      const tempToken = uuidv4();
      await this.redis.setex(`totp_pending:${tempToken}`, TOTP_TEMP_TTL_SECONDS, user.id);
      return { requires2fa: true, tempToken };
    }

    await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokenPair({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles as AuthenticatedUser['roles'],
    });
  }

  async verify2fa(tempToken: string, code: string): Promise<TokenPair> {
    const userId = await this.redis.get(`totp_pending:${tempToken}`);
    if (!userId) throw new UnauthorizedException('Session expired. Please log in again.');

    const user = await this.prisma.tenantUser.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || !user.totpSecret) throw new UnauthorizedException('Invalid session');

    const valid = totpVerifySync({ token: code, secret: user.totpSecret }).valid;
    if (!valid) throw new UnauthorizedException('Invalid authenticator code');

    await this.redis.del(`totp_pending:${tempToken}`);
    await this.prisma.tenantUser.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

    return this.issueTokenPair({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles as AuthenticatedUser['roles'],
    });
  }

  async setup2fa(userId: string): Promise<{ secret: string; qrCodeUrl: string; otpauthUrl: string }> {
    const user = await this.prisma.tenantUser.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw new ConflictException('Two-factor authentication is already enabled');

    const secret = totpGenerateSecret();
    const appName = this.configService.get<string>('APP_NAME', 'MFI Platform');
    const otpauthUrl = totpGenerateURI({ issuer: appName, label: user.email, secret });
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily in Redis until confirmed
    await this.redis.setex(`totp_setup:${userId}`, 10 * 60, secret);

    return { secret, qrCodeUrl, otpauthUrl };
  }

  async enable2fa(userId: string, code: string): Promise<void> {
    const secret = await this.redis.get(`totp_setup:${userId}`);
    if (!secret) throw new BadRequestException('Setup session expired. Please start setup again.');

    const valid = totpVerifySync({ token: code, secret }).valid;
    if (!valid) throw new BadRequestException('Invalid code. Please try again.');

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: true },
    });
    await this.redis.del(`totp_setup:${userId}`);
  }

  async disable2fa(userId: string, password: string, code: string): Promise<void> {
    const user = await this.prisma.tenantUser.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabled || !user.totpSecret) throw new BadRequestException('Two-factor authentication is not enabled');

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw new BadRequestException('Incorrect password');

    const codeValid = totpVerifySync({ token: code, secret: user.totpSecret }).valid;
    if (!codeValid) throw new BadRequestException('Invalid authenticator code');

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    });
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const userId = await this.redis.get(`refresh:${refreshToken}`);
    if (!userId) {
      throw new UnauthorizedException('Refresh token expired or invalid');
    }

    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account disabled');
    }

    await this.redis.del(`refresh:${refreshToken}`);

    return this.issueTokenPair({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles as AuthenticatedUser['roles'],
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.redis.del(`refresh:${refreshToken}`);
  }

  async forgotPassword(email: string, tenantId: string): Promise<void> {
    const user = await this.prisma.tenantUser.findUnique({
      where: { tenantId_email: { tenantId, email } },
      include: { tenant: { select: { name: true } } },
    });

    // Always return success to prevent user enumeration
    if (!user || !user.isActive) return;

    const resetToken = uuidv4();
    await this.redis.setex(`pwd_reset:${resetToken}`, PASSWORD_RESET_TTL_SECONDS, user.id);

    const appUrl = this.configService.get<string>('APP_URL', 'https://mfi.mahembega.com');
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    await this.mailService.sendPasswordReset(email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.redis.get(`pwd_reset:${token}`);
    if (!userId) {
      throw new BadRequestException('Reset token is invalid or has expired');
    }

    const user = await this.prisma.tenantUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    await this.redis.del(`pwd_reset:${token}`);

    // Invalidate all active refresh tokens for this user
    const refreshKeys = await this.redis.keys('refresh:*');
    for (const key of refreshKeys) {
      const stored = await this.redis.get(key);
      if (stored === userId) await this.redis.del(key);
    }
  }

  async getTenantBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, brandPrimary: true, brandSecondary: true, logoUrl: true, status: true },
    });
    if (!tenant) throw new NotFoundException('Organisation not found');
    if (tenant.status === 'SUSPENDED') throw new ForbiddenException('Organisation account is suspended');
    return tenant;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.tenantUser.findUniqueOrThrow({ where: { id: userId } });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
  }

  private async issueTokenPair(user: AuthenticatedUser): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload as unknown as Record<string, unknown>, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN', '15m')) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = uuidv4();
    await this.redis.setex(`refresh:${refreshToken}`, REFRESH_TTL_SECONDS, user.id);

    return { accessToken, refreshToken };
  }
}
