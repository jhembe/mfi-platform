import {
  Controller, Get, Post, Body, Param, Query,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { LoanAccountsService } from './loan-accounts.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { RecordRepaymentDto } from './dto/record-repayment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, FeatureKey, AuthenticatedUser } from '@mfi/shared';
import { IsString, IsNotEmpty } from 'class-validator';

class WriteOffDto {
  @IsString() @IsNotEmpty() reason!: string;
}

@Controller('loans')
@RequireFeature(FeatureKey.LOANS)
export class LoanAccountsController {
  constructor(private readonly loanAccountsService: LoanAccountsService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  create(@Body() dto: CreateLoanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.loanAccountsService.create(dto, user.id);
  }

  @Get()
  list(
    @Query('clientId') clientId?: string,
    @Query('officerId') officerId?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.loanAccountsService.list({ clientId, officerId, status, page, limit: Math.min(limit, 100) });
  }

  @Get('stats')
  getStats() {
    return this.loanAccountsService.getStats();
  }

  @Get('officer-stats')
  getOfficerStats(@CurrentUser() user: AuthenticatedUser) {
    return this.loanAccountsService.getOfficerStats(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loanAccountsService.findOne(id);
  }

  @Post(':id/submit')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  submit(@Param('id') id: string) {
    return this.loanAccountsService.submit(id);
  }

  @Post(':id/approve')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.loanAccountsService.approve(id, user.id);
  }

  @Post(':id/reject')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  reject(@Param('id') id: string) {
    return this.loanAccountsService.reject(id);
  }

  @Post(':id/disburse')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.CASHIER)
  disburse(
    @Param('id') id: string,
    @Body() dto: DisburseLoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loanAccountsService.disburse(id, dto, user.id);
  }

  @Get(':id/schedule')
  getSchedule(@Param('id') id: string) {
    return this.loanAccountsService.getSchedule(id);
  }

  @Get(':id/ledger')
  getLedger(@Param('id') id: string) {
    return this.loanAccountsService.getLedger(id);
  }

  @Post(':id/repayments')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.LOAN_OFFICER)
  recordRepayment(
    @Param('id') id: string,
    @Body() dto: RecordRepaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loanAccountsService.recordRepayment(id, dto, user.id);
  }

  @Post(':id/write-off')
  @Roles(UserRole.TENANT_ADMIN)
  writeOff(@Param('id') id: string, @Body() dto: WriteOffDto) {
    return this.loanAccountsService.writeOff(id, dto.reason);
  }

  @Post(':id/send-reminder')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  async sendReminder(@Param('id') id: string) {
    await this.loanAccountsService.sendRepaymentReminder(id);
    return { success: true };
  }
}
