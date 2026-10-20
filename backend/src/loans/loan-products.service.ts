import { Injectable, NotFoundException, Scope } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateLoanProductDto } from './dto/create-loan-product.dto';
import { UpdateLoanProductDto } from './dto/update-loan-product.dto';

interface ProductRow {
  id: string;
  name: string;
  min_amount: bigint;
  max_amount: bigint;
  min_term_months: number;
  max_term_months: number;
  interest_method: string;
  interest_rate: string;
  repayment_frequency: string;
  processing_fee_percent: string;
  penalty_rate_percent: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function toProductResponse(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    minAmount: Number(row.min_amount),
    maxAmount: Number(row.max_amount),
    minTermMonths: row.min_term_months,
    maxTermMonths: row.max_term_months,
    interestMethod: row.interest_method,
    interestRate: parseFloat(row.interest_rate),
    repaymentFrequency: row.repayment_frequency,
    processingFeePercent: parseFloat(row.processing_fee_percent),
    penaltyRatePercent: parseFloat(row.penalty_rate_percent),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ scope: Scope.REQUEST })
export class LoanProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async create(dto: CreateLoanProductDto) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `INSERT INTO "${s}".loan_products
        (name,min_amount,max_amount,min_term_months,max_term_months,
         interest_method,interest_rate,repayment_frequency,
         processing_fee_percent,penalty_rate_percent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      dto.name, BigInt(dto.minAmount), BigInt(dto.maxAmount),
      dto.minTermMonths, dto.maxTermMonths,
      dto.interestMethod, dto.interestRate, dto.repaymentFrequency,
      dto.processingFeePercent, dto.penaltyRatePercent,
    );
    return toProductResponse(rows[0]);
  }

  async list(activeOnly = true) {
    const s = this.tenantCtx.schemaName;
    const whereClause = activeOnly ? `WHERE is_active = TRUE AND deleted_at IS NULL` : `WHERE deleted_at IS NULL`;
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `SELECT * FROM "${s}".loan_products ${whereClause} ORDER BY name ASC`,
    );
    return rows.map(toProductResponse);
  }

  async findOne(id: string) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `SELECT * FROM "${s}".loan_products WHERE id = $1::uuid AND deleted_at IS NULL`,
      id,
    );
    if (!rows.length) throw new NotFoundException('Loan product not found');
    return toProductResponse(rows[0]);
  }

  async findOneRaw(id: string): Promise<ProductRow> {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `SELECT * FROM "${s}".loan_products WHERE id = $1::uuid AND deleted_at IS NULL`,
      id,
    );
    if (!rows.length) throw new NotFoundException('Loan product not found');
    return rows[0];
  }

  async update(id: string, dto: UpdateLoanProductDto) {
    await this.findOne(id);
    const s = this.tenantCtx.schemaName;

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: [keyof UpdateLoanProductDto, string, (v: unknown) => unknown][] = [
      ['name', 'name', (v) => v],
      ['minAmount', 'min_amount', (v) => BigInt(v as number)],
      ['maxAmount', 'max_amount', (v) => BigInt(v as number)],
      ['minTermMonths', 'min_term_months', (v) => v],
      ['maxTermMonths', 'max_term_months', (v) => v],
      ['interestMethod', 'interest_method', (v) => v],
      ['interestRate', 'interest_rate', (v) => v],
      ['repaymentFrequency', 'repayment_frequency', (v) => v],
      ['processingFeePercent', 'processing_fee_percent', (v) => v],
      ['penaltyRatePercent', 'penalty_rate_percent', (v) => v],
      ['isActive', 'is_active', (v) => v],
    ];

    for (const [dtoField, col, transform] of map) {
      if (dto[dtoField] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(transform(dto[dtoField]));
      }
    }

    if (!sets.length) return this.findOne(id);

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `UPDATE "${s}".loan_products SET ${sets.join(', ')} WHERE id = $${idx}::uuid AND deleted_at IS NULL RETURNING *`,
      ...params,
    );
    return toProductResponse(rows[0]);
  }

  async deactivate(id: string) {
    const s = this.tenantCtx.schemaName;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}".loan_products SET deleted_at = NOW() WHERE id = $1::uuid`,
      id,
    );
  }
}
