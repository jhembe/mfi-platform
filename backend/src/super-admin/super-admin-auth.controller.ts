import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('super-admin/auth')
export class SuperAdminAuthController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: SuperAdminLoginDto) {
    return this.superAdminService.login(dto);
  }

  @Post('bootstrap')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  bootstrap(@Body() dto: CreatePlatformAdminDto) {
    return this.superAdminService.bootstrapFirstAdmin(dto);
  }
}
