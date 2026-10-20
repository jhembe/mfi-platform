import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SetFeaturesDto } from './dto/set-features.dto';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';

@Controller('super-admin')
@UseGuards(PlatformAdminGuard)
export class SuperAdminTenantsController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('tenants')
  listTenants() {
    return this.superAdminService.listTenants();
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.superAdminService.getTenant(id);
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  createTenant(@Body() dto: CreateTenantDto) {
    return this.superAdminService.createTenant(dto);
  }

  @Patch('tenants/:id')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.superAdminService.updateTenant(id, dto);
  }

  @Post('tenants/:id/features')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setFeatures(@Param('id') id: string, @Body() dto: SetFeaturesDto) {
    await this.superAdminService.setFeatures(id, dto.features);
  }

  @Post('platform-admins')
  @HttpCode(HttpStatus.CREATED)
  createPlatformAdmin(@Body() dto: CreatePlatformAdminDto) {
    return this.superAdminService.createPlatformAdmin(dto);
  }
}
