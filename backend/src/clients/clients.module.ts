import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { StorageModule } from '../storage/storage.module';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [TenantModule, StorageModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
