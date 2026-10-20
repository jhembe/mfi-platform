import {
  Controller, Get, Post, Body, Param, Query,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { SavingsAccountsService } from './savings-accounts.service';
import { CreateSavingsAccountDto } from './dto/create-savings-account.dto';
import { TransactionDto } from './dto/transaction.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, FeatureKey, AuthenticatedUser } from '@mfi/shared';

@Controller('savings')
@RequireFeature(FeatureKey.SAVINGS)
export class SavingsAccountsController {
  constructor(private readonly service: SavingsAccountsService) {}

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get()
  list(
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.list({ clientId, status, page, limit: Math.min(limit, 100) });
  }

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.LOAN_OFFICER)
  open(@Body() dto: CreateSavingsAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.open(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/transactions')
  getTransactions(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.service.getTransactions(id, page, Math.min(limit, 100));
  }

  @Post(':id/deposit')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.CASHIER, UserRole.LOAN_OFFICER)
  deposit(
    @Param('id') id: string,
    @Body() dto: TransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deposit(id, dto, user.id);
  }

  @Post(':id/withdraw')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.CASHIER)
  withdraw(
    @Param('id') id: string,
    @Body() dto: TransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.withdraw(id, dto, user.id);
  }

  @Post(':id/freeze')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  freeze(@Param('id') id: string) {
    return this.service.freeze(id);
  }

  @Post(':id/unfreeze')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  unfreeze(@Param('id') id: string) {
    return this.service.unfreeze(id);
  }

  @Post(':id/close')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  close(@Param('id') id: string) {
    return this.service.close(id);
  }
}
