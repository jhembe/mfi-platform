import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Enable2faDto, Verify2faDto, Disable2faDto } from './dto/totp.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser, TokenPair } from '@mfi/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<TokenPair | { requires2fa: true; tempToken: string }> {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Missing X-Tenant-ID header');
    return this.authService.login(dto, tenantId);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request): Promise<void> {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) throw new BadRequestException('Missing X-Tenant-ID header');
    return this.authService.forgotPassword(dto.email, tenantId);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Get('tenant/:slug')
  @Public()
  async getTenantBySlug(@Param('slug') slug: string) {
    return this.authService.getTenantBySlug(slug);
  }

  // ─── TOTP / 2FA ───────────────────────────────────────────────────────────

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard)
  setup2fa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setup2fa(user.id);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  enable2fa(@CurrentUser() user: AuthenticatedUser, @Body() dto: Enable2faDto) {
    return this.authService.enable2fa(user.id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  disable2fa(@CurrentUser() user: AuthenticatedUser, @Body() dto: Disable2faDto) {
    return this.authService.disable2fa(user.id, dto.password, dto.code);
  }

  @Post('2fa/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verify2fa(@Body() dto: Verify2faDto) {
    return this.authService.verify2fa(dto.tempToken, dto.code);
  }
}
