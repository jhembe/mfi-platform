import { Module } from '@nestjs/common';
import { ClientPortalService } from './client-portal.service';
import { ClientPortalController } from './client-portal.controller';
import { TenantModule } from '../tenant/tenant.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [TenantModule, JwtModule],
  controllers: [ClientPortalController],
  providers: [ClientPortalService],
})
export class ClientPortalModule {}
