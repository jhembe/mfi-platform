import {
  Injectable, Scope, Inject, UnauthorizedException,
  ConflictException, NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { PortalRegisterDto, PortalLoginDto } from './dto/portal.dto';

interface PortalUser { id: string; client_id: string; phone: string; pin_hash: string; is_active: boolean; }
export interface ClientRow { id: string; first_name: string; last_name: string; phone: string; }
interface LoanRow {
  id: string; loan_ref: string; status: string; principal_amount: bigint;
  outstanding_balance: bigint; interest_rate: string; term_months: number;
  disbursed_at: string | null; maturity_date: string | null;
}
interface SavingsRow { id: string; account_number: string; status: string; balance: bigint; product_name: string; }
interface ScheduleRow { installment_no: number; due_date: string; total_due: bigint; paid_amount: bigint; status: string; }

@Injectable({ scope: Scope.REQUEST })
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REQUEST) private readonly request: Request,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private get schema() { return this.tenantCtx.schemaName; }

  private async resolveTenantBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, schemaName: true, status: true },
    });
    if (!tenant) throw new NotFoundException('Organisation not found');
    return tenant;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/^\+/, '').replace(/^0/, '255');
  }

  private issuePortalToken(portalUserId: string, clientId: string, tenantId: string): string {
    return this.jwtService.sign(
      { sub: portalUserId, clientId, tenantId, isPortalUser: true },
      { expiresIn: '24h', secret: this.config.getOrThrow('JWT_SECRET') },
    );
  }

  async register(dto: PortalRegisterDto) {
    const tenant = await this.resolveTenantBySlug(dto.tenantSlug);
    const schema = tenant.schemaName;

    const normalized = this.normalizePhone(dto.phone);
    const [client] = await this.prisma.$queryRawUnsafe<ClientRow[]>(
      `SELECT id, first_name, last_name, phone FROM "${schema}".clients
       WHERE REPLACE(phone, '+', '') = $1 AND deleted_at IS NULL`,
      normalized,
    );
    if (!client) throw new NotFoundException('No client found with this phone number. Please contact your branch.');

    const existing = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "${schema}".portal_users WHERE client_id = $1::uuid`,
      client.id,
    );
    if (existing.length > 0) throw new ConflictException('A portal account already exists for this phone number.');

    const pinHash = await bcrypt.hash(dto.pin, 10);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schema}".portal_users (client_id, phone, pin_hash) VALUES ($1::uuid, $2, $3)`,
      client.id, dto.phone, pinHash,
    );

    // Index phone → tenant so clients can log in without knowing the slug
    await this.prisma.portalPhoneIndex.upsert({
      where: { phone_tenantId: { phone: normalized, tenantId: tenant.id } },
      create: { phone: normalized, tenantId: tenant.id },
      update: {},
    });

    return { message: 'Portal account created. You can now log in.' };
  }

  async login(dto: PortalLoginDto): Promise<
    | { accessToken: string; clientId: string; tenantId: string }
    | { requiresTenantSelection: true; tenants: { id: string; name: string; logoUrl: string | null; brandPrimary: string | null }[] }
  > {
    const normalized = this.normalizePhone(dto.phone);

    // Slug-based login (direct portal URL — existing behaviour)
    if (dto.tenantSlug) {
      return this.loginWithSlug(dto.tenantSlug, normalized, dto.pin);
    }

    // Slug-free login — look up phone in the index
    const entries = await this.prisma.portalPhoneIndex.findMany({
      where: { phone: normalized },
      include: { tenant: { select: { id: true, slug: true, name: true, logoUrl: true, brandPrimary: true, schemaName: true, status: true } } },
    });

    if (entries.length === 0) throw new UnauthorizedException('Invalid phone or PIN');

    if (entries.length === 1) {
      return this.loginIntoTenant(entries[0].tenant, normalized, dto.pin);
    }

    // Multiple tenants — verify PIN works against at least one before exposing tenant list
    const validEntries: typeof entries = [];
    for (const entry of entries) {
      try {
        await this.verifyPinInSchema(entry.tenant.schemaName, normalized, dto.pin);
        validEntries.push(entry);
      } catch {
        // PIN not valid in this schema — skip
      }
    }
    if (validEntries.length === 0) throw new UnauthorizedException('Invalid phone or PIN');

    return {
      requiresTenantSelection: true,
      tenants: validEntries.map(e => ({
        id: e.tenant.id,
        slug: e.tenant.slug,
        name: e.tenant.name,
        logoUrl: e.tenant.logoUrl,
        brandPrimary: e.tenant.brandPrimary,
      })),
    };
  }

  async loginSelectTenant(tenantId: string, phone: string, pin: string) {
    const normalized = this.normalizePhone(phone);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, slug: true, schemaName: true, status: true, name: true, logoUrl: true, brandPrimary: true },
    });
    return this.loginIntoTenant(tenant, normalized, pin);
  }

  private async loginWithSlug(slug: string, normalizedPhone: string, pin: string) {
    const tenant = await this.resolveTenantBySlug(slug);
    return this.loginIntoTenant(
      { id: tenant.id, slug: tenant.slug, schemaName: tenant.schemaName, status: tenant.status, name: '', logoUrl: null, brandPrimary: null },
      normalizedPhone, pin,
    );
  }

  private async verifyPinInSchema(schema: string, normalizedPhone: string, pin: string): Promise<PortalUser> {
    const [user] = await this.prisma.$queryRawUnsafe<PortalUser[]>(
      `SELECT id, client_id, phone, pin_hash, is_active FROM "${schema}".portal_users WHERE REPLACE(phone, '+', '') = $1`,
      normalizedPhone,
    );
    if (!user) throw new UnauthorizedException('Invalid phone or PIN');
    if (!user.is_active) throw new UnauthorizedException('Your portal account has been disabled');
    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) throw new UnauthorizedException('Invalid phone or PIN');
    return user;
  }

  private async loginIntoTenant(
    tenant: { id: string; schemaName: string; status: string; name: string; logoUrl: string | null; brandPrimary: string | null; slug?: string },
    normalizedPhone: string,
    pin: string,
  ) {
    if (tenant.status === 'SUSPENDED') throw new UnauthorizedException('This organisation account is suspended');
    const user = await this.verifyPinInSchema(tenant.schemaName, normalizedPhone, pin);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "${tenant.schemaName}".portal_users SET last_login = NOW() WHERE id = $1::uuid`,
      user.id,
    );

    const token = this.issuePortalToken(user.id, user.client_id, tenant.id);
    return { accessToken: token, clientId: user.client_id, tenantId: tenant.id, tenantSlug: tenant.slug };
  }

  async me(clientId: string) {
    const [client] = await this.prisma.$queryRawUnsafe<ClientRow[]>(
      `SELECT id, first_name, last_name, phone FROM "${this.schema}".clients WHERE id = $1::uuid AND deleted_at IS NULL`,
      clientId,
    );
    if (!client) throw new NotFoundException('Client not found');
    return { id: client.id, firstName: client.first_name, lastName: client.last_name, phone: client.phone };
  }

  async myLoans(clientId: string) {
    const loans = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `SELECT id, loan_ref, status, principal_amount, outstanding_balance,
              interest_rate::text, term_months, disbursed_at, maturity_date
       FROM "${this.schema}".loan_accounts
       WHERE client_id = $1::uuid AND deleted_at IS NULL ORDER BY created_at DESC`,
      clientId,
    );
    return loans.map(l => ({
      id: l.id, loanRef: l.loan_ref, status: l.status, interestRate: l.interest_rate,
      termMonths: l.term_months, disbursedAt: l.disbursed_at, maturityDate: l.maturity_date,
      principalAmount: Number(l.principal_amount), outstandingBalance: Number(l.outstanding_balance),
    }));
  }

  async myLoanSchedule(clientId: string, loanId: string) {
    const [loan] = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "${this.schema}".loan_accounts WHERE id = $1::uuid AND client_id = $2::uuid AND deleted_at IS NULL`,
      loanId, clientId,
    );
    if (!loan) throw new NotFoundException('Loan not found');

    const rows = await this.prisma.$queryRawUnsafe<ScheduleRow[]>(
      `SELECT installment_no, due_date, total_due, paid_amount, status
       FROM "${this.schema}".repayment_schedule WHERE loan_id = $1::uuid ORDER BY installment_no`,
      loanId,
    );
    return rows.map(r => ({
      installmentNo: r.installment_no, dueDate: r.due_date, status: r.status,
      totalDue: Number(r.total_due), paidAmount: Number(r.paid_amount),
    }));
  }

  async mySavings(clientId: string) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<SavingsRow[]>(
        `SELECT sa.id, sa.account_ref, sa.status, sa.balance, sp.name as product_name
         FROM "${this.schema}".savings_accounts sa
         JOIN "${this.schema}".savings_products sp ON sp.id = sa.product_id
         WHERE sa.client_id = $1::uuid AND sa.deleted_at IS NULL ORDER BY sa.created_at DESC`,
        clientId,
      );
      return rows.map(r => ({ ...r, balance: Number(r.balance) }));
    } catch {
      return [];
    }
  }
}
