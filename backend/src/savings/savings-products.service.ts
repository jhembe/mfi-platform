import { Injectable, NotFoundException, Scope } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateSavingsProductDto } from './dto/create-savings-product.dto';
import { UpdateSavingsProductDto } from './dto/update-savings-product.dto';

interface ProductRow {
  id: string;
  name: string;
  min_balance: bigint;
  interest_rate: string;
  interest_frequency: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function toResponse(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    minBalance: Number(row.min_balance),
    interestRate: parseFloat(row.interest_rate),
    interestFrequency: row.interest_frequency,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ scope: Scope.REQUEST })
export class SavingsProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async list(all = false) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `SELECT * FROM "${s}".savings_products
       WHERE deleted_at IS NULL ${all ? '' : "AND is_active = TRUE"}
       ORDER BY name ASC`,
    );
    return rows.map(toResponse);
  }

  async findOneRaw(id: string): Promise<ProductRow> {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `SELECT * FROM "${s}".savings_products WHERE id = $1::uuid AND deleted_at IS NULL`,
      id,
    );
    if (!rows.length) throw new NotFoundException('Savings product not found');
    return rows[0];
  }

  async findOne(id: string) {
    return toResponse(await this.findOneRaw(id));
  }

  async create(dto: CreateSavingsProductDto) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `INSERT INTO "${s}".savings_products
        (name, min_balance, interest_rate, interest_frequency, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      dto.name,
      BigInt(Math.round(dto.minBalance)),
      dto.interestRate,
      dto.interestFrequency,
      dto.description ?? null,
    );
    return toResponse(rows[0]);
  }

  async update(id: string, dto: UpdateSavingsProductDto) {
    await this.findOneRaw(id);
    const s = this.tenantCtx.schemaName;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.minBalance !== undefined) { sets.push(`min_balance = $${idx++}`); params.push(BigInt(Math.round(dto.minBalance))); }
    if (dto.interestRate !== undefined) { sets.push(`interest_rate = $${idx++}`); params.push(dto.interestRate); }
    if (dto.interestFrequency !== undefined) { sets.push(`interest_frequency = $${idx++}`); params.push(dto.interestFrequency); }
    if (dto.description !== undefined) { sets.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(dto.isActive); }

    params.push(id);
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `UPDATE "${s}".savings_products SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      ...params,
    );
    return toResponse(rows[0]);
  }

  async deactivate(id: string) {
    await this.findOneRaw(id);
    const s = this.tenantCtx.schemaName;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}".savings_products SET is_active = FALSE, deleted_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
      id,
    );
  }
}
