import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportPdfService } from './report-pdf.service';

@Module({
  imports: [TenantModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService],
})
export class ReportsModule {}
