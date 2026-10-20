import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseBoolPipe, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/create-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, FeatureKey, AuthenticatedUser } from '@mfi/shared';

@Controller('accounting')
@RequireFeature(FeatureKey.ACCOUNTING)
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  // ── Stats ──────────────────────────────────────────────────────────────────

  @Get('stats')
  getStats() { return this.service.getStats(); }

  // ── Trial Balance ──────────────────────────────────────────────────────────

  @Get('trial-balance')
  trialBalance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) { return this.service.trialBalance(from, to); }

  // ── Chart of Accounts ──────────────────────────────────────────────────────

  @Get('accounts')
  listAccounts(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ) { return this.service.listAccounts(includeInactive); }

  @Post('accounts')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  createAccount(@Body() dto: CreateAccountDto) {
    return this.service.createAccount(dto);
  }

  @Get('accounts/:id')
  getAccount(@Param('id') id: string) {
    return this.service.getAccount(id);
  }

  @Patch('accounts/:id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.service.updateAccount(id, dto);
  }

  @Get('accounts/:id/statement')
  getAccountStatement(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) { return this.service.getAccountStatement(id, from, to); }

  // ── Journal Entries ────────────────────────────────────────────────────────

  @Get('journal-entries')
  listJournalEntries(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) { return this.service.listJournalEntries({ status, page, limit: Math.min(limit, 100) }); }

  @Post('journal-entries')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.AUDITOR)
  createJournalEntry(
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.service.createJournalEntry(dto, user.id); }

  @Get('journal-entries/:id')
  getJournalEntry(@Param('id') id: string) {
    return this.service.getJournalEntry(id);
  }

  @Post('journal-entries/:id/void')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  voidJournalEntry(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.service.voidJournalEntry(id, reason, user.id); }
}
