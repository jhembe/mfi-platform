import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportPdfService } from './report-pdf.service';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { FeatureKey, UserRole } from '@mfi/shared';

@Controller('reports')
@RequireFeature(FeatureKey.REPORTS)
@Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.AUDITOR)
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly pdfService: ReportPdfService,
  ) {}

  @Get('portfolio')
  portfolio(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.portfolioReport(from, to);
  }

  @Get('disbursements')
  disbursements(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.disbursementsReport(from, to);
  }

  @Get('collections')
  collections(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.collectionsReport(from, to);
  }

  @Get('savings')
  savings(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.savingsReport(from, to);
  }

  @Get('clients')
  clients() {
    return this.service.clientsReport();
  }

  @Get('bot')
  bot(@Query('from') from = '', @Query('to') to = '') {
    return this.service.botReport(from, to);
  }

  @Get('pdf')
  async pdf(
    @Query('type') type: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const { buffer, filename } = await this.pdfService.generatePdf(type, from, to);
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res!.end(buffer);
  }
}
