import {
  Controller, Post, Get, Body, Param, Query,
  Headers, RawBodyRequest, Req,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '@mfi/shared';
import type { SelcomCallbackPayload } from './selcom.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('requests')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER, UserRole.CASHIER)
  createPaymentRequest(
    @Body() dto: CreatePaymentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createPaymentRequest(dto, user.id);
  }

  @Get('requests')
  listByLoan(
    @Query('loanId') loanId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.listByLoan(loanId, Math.min(limit, 50));
  }

  // ── Selcom callback — PUBLIC, no JWT ──────────────────────────────────────
  // Selcom POSTs here after each payment attempt.
  // Must return 200 quickly; heavy processing happens synchronously but
  // is designed to be idempotent if Selcom retries.

  @Post('callback')
  @Public()
  async handleSelcomCallback(
    @Body() payload: SelcomCallbackPayload,
    @Headers('digest') digestHeader: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody?.toString('utf-8') ?? JSON.stringify(payload);
    return this.service.handleCallback(payload, rawBody, digestHeader);
  }

  // ── Manual status refresh (for loan detail page) ──────────────────────────

  @Get('requests/:id/status')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER, UserRole.CASHIER)
  async checkStatus(@Param('id') id: string) {
    void id;
    return { message: 'Use listByLoan to see latest status' };
  }
}
