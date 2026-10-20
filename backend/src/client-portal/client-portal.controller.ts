import { Controller, Post, Get, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClientPortalService } from './client-portal.service';
import { PortalRegisterDto, PortalLoginDto, PortalSelectTenantDto } from './dto/portal.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { FeatureKey } from '@mfi/shared';

@Controller('portal')
export class ClientPortalController {
  constructor(
    private readonly service: ClientPortalService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private extractClientId(authHeader: string | undefined): string {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token');
    try {
      const payload = this.jwtService.verify<{ clientId: string; isPortalUser: boolean }>(
        authHeader.slice(7), { secret: this.config.getOrThrow('JWT_SECRET') },
      );
      if (!payload.isPortalUser) throw new UnauthorizedException('Not a portal token');
      return payload.clientId;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  @Post('register')
  @Public()
  register(@Body() dto: PortalRegisterDto) {
    return this.service.register(dto);
  }

  @Post('login')
  @Public()
  login(@Body() dto: PortalLoginDto) {
    return this.service.login(dto);
  }

  @Post('login/select-tenant')
  @Public()
  loginSelectTenant(@Body() dto: PortalSelectTenantDto) {
    return this.service.loginSelectTenant(dto.tenantId, dto.phone, dto.pin);
  }

  @Get('me')
  @RequireFeature(FeatureKey.CLIENT_PORTAL)
  me(@Headers('authorization') auth: string | undefined) {
    return this.service.me(this.extractClientId(auth));
  }

  @Get('loans')
  @RequireFeature(FeatureKey.CLIENT_PORTAL)
  myLoans(@Headers('authorization') auth: string | undefined) {
    return this.service.myLoans(this.extractClientId(auth));
  }

  @Get('loans/:loanId/schedule')
  @RequireFeature(FeatureKey.CLIENT_PORTAL)
  mySchedule(
    @Param('loanId') loanId: string,
    @Headers('authorization') auth: string | undefined,
  ) {
    return this.service.myLoanSchedule(this.extractClientId(auth), loanId);
  }

  @Get('savings')
  @RequireFeature(FeatureKey.CLIENT_PORTAL)
  mySavings(@Headers('authorization') auth: string | undefined) {
    return this.service.mySavings(this.extractClientId(auth));
  }
}
