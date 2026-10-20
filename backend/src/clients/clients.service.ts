import { Injectable, NotFoundException, Scope } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { StorageService } from '../storage/storage.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AddKycDocumentDto } from './dto/add-kyc-document.dto';

interface ClientRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  gender: string;
  phone: string;
  email: string | null;
  address: string;
  ward: string;
  district: string;
  region: string;
  national_id: string | null;
  occupation: string | null;
  employer: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relationship: string | null;
  created_at: Date;
  updated_at: Date;
}

interface KycRow {
  id: string;
  client_id: string;
  document_type: string;
  document_number: string;
  file_key: string;
  verified_at: Date | null;
  verified_by: string | null;
  created_at: Date;
}

function toClientResponse(row: ClientRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    phone: row.phone,
    email: row.email,
    address: row.address,
    ward: row.ward,
    district: row.district,
    region: row.region,
    nationalId: row.national_id,
    occupation: row.occupation,
    employer: row.employer,
    nextOfKinName: row.next_of_kin_name,
    nextOfKinPhone: row.next_of_kin_phone,
    nextOfKinRelationship: row.next_of_kin_relationship,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toKycResponse(row: KycRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    documentType: row.document_type,
    documentNumber: row.document_number,
    fileKey: row.file_key,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    createdAt: row.created_at,
  };
}

@Injectable({ scope: Scope.REQUEST })
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreateClientDto) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ClientRow[]>(
      `INSERT INTO "${s}".clients
        (first_name,last_name,date_of_birth,gender,phone,email,
         address,ward,district,region,
         national_id,occupation,employer,
         next_of_kin_name,next_of_kin_phone,next_of_kin_relationship)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      dto.firstName, dto.lastName, dto.dateOfBirth, dto.gender,
      dto.phone, dto.email ?? null,
      dto.address, dto.ward, dto.district, dto.region,
      dto.nationalId ?? null, dto.occupation ?? null, dto.employer ?? null,
      dto.nextOfKinName ?? null, dto.nextOfKinPhone ?? null, dto.nextOfKinRelationship ?? null,
    );
    return toClientResponse(rows[0]);
  }

  async list(search?: string, page = 1, limit = 20) {
    const s = this.tenantCtx.schemaName;
    const offset = (page - 1) * limit;
    const searchParam = search ? `%${search}%` : '%';

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<ClientRow[]>(
        `SELECT * FROM "${s}".clients
         WHERE deleted_at IS NULL
           AND (first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR national_id ILIKE $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        searchParam, limit, offset,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM "${s}".clients
         WHERE deleted_at IS NULL
           AND (first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR national_id ILIKE $1)`,
        searchParam,
      ),
    ]);

    return {
      data: rows.map(toClientResponse),
      meta: { total: parseInt(countRows[0].count, 10), page, limit },
    };
  }

  async findOne(id: string) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ClientRow[]>(
      `SELECT * FROM "${s}".clients WHERE id = $1::uuid AND deleted_at IS NULL`,
      id,
    );
    if (!rows.length) throw new NotFoundException('Client not found');
    return toClientResponse(rows[0]);
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    const s = this.tenantCtx.schemaName;

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fieldMap: [keyof UpdateClientDto, string][] = [
      ['firstName', 'first_name'],
      ['lastName', 'last_name'],
      ['dateOfBirth', 'date_of_birth'],
      ['gender', 'gender'],
      ['phone', 'phone'],
      ['email', 'email'],
      ['address', 'address'],
      ['ward', 'ward'],
      ['district', 'district'],
      ['region', 'region'],
      ['nationalId', 'national_id'],
      ['occupation', 'occupation'],
      ['employer', 'employer'],
      ['nextOfKinName', 'next_of_kin_name'],
      ['nextOfKinPhone', 'next_of_kin_phone'],
      ['nextOfKinRelationship', 'next_of_kin_relationship'],
    ];

    for (const [dtoField, col] of fieldMap) {
      if (dto[dtoField] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(dto[dtoField] ?? null);
      }
    }

    if (!sets.length) return this.findOne(id);

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const rows = await this.prisma.$queryRawUnsafe<ClientRow[]>(
      `UPDATE "${s}".clients SET ${sets.join(', ')} WHERE id = $${idx}::uuid AND deleted_at IS NULL RETURNING *`,
      ...params,
    );
    return toClientResponse(rows[0]);
  }

  async softDelete(id: string) {
    const s = this.tenantCtx.schemaName;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}".clients SET deleted_at = NOW() WHERE id = $1::uuid AND deleted_at IS NULL`,
      id,
    );
  }

  async listKyc(clientId: string) {
    await this.findOne(clientId);
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<KycRow[]>(
      `SELECT * FROM "${s}".kyc_documents WHERE client_id = $1::uuid ORDER BY created_at DESC`,
      clientId,
    );
    return rows.map(toKycResponse);
  }

  async addKycDocument(
    clientId: string,
    dto: AddKycDocumentDto,
    file: Express.Multer.File,
  ) {
    await this.findOne(clientId);
    const s = this.tenantCtx.schemaName;

    const ext = file.originalname.split('.').pop() ?? 'bin';
    const fileKey = `kyc/${clientId}/${Date.now()}-${dto.documentType.toLowerCase()}.${ext}`;

    await this.storage.uploadBuffer(fileKey, file.buffer, file.mimetype);

    const rows = await this.prisma.$queryRawUnsafe<KycRow[]>(
      `INSERT INTO "${s}".kyc_documents (client_id, document_type, document_number, file_key)
       VALUES ($1::uuid, $2, $3, $4) RETURNING *`,
      clientId, dto.documentType, dto.documentNumber, fileKey,
    );
    return toKycResponse(rows[0]);
  }

  async getKycDownloadUrl(clientId: string, docId: string) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<KycRow[]>(
      `SELECT * FROM "${s}".kyc_documents WHERE id = $1::uuid AND client_id = $2::uuid`,
      docId, clientId,
    );
    if (!rows.length) throw new NotFoundException('KYC document not found');
    const url = await this.storage.getSignedUrl(rows[0].file_key);
    return { url };
  }

  async verifyKyc(clientId: string, docId: string, officerId: string) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<KycRow[]>(
      `UPDATE "${s}".kyc_documents
       SET verified_at = NOW(), verified_by = $1, updated_at = NOW()
       WHERE id = $2::uuid AND client_id = $3::uuid
       RETURNING *`,
      officerId, docId, clientId,
    );
    if (!rows.length) throw new NotFoundException('KYC document not found');
    return toKycResponse(rows[0]);
  }
}
