import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, Scope,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { RecordContributionDto } from './dto/record-contribution.dto';
import { GroupStatus } from '@mfi/shared';

interface GroupRow {
  id: string;
  group_ref: string;
  name: string;
  type: string;
  description: string | null;
  meeting_day: string | null;
  meeting_frequency: string | null;
  status: string;
  formed_at: Date;
  dissolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface MemberRow {
  id: string;
  group_id: string;
  client_id: string;
  role: string;
  joined_at: Date;
  left_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ContributionRow {
  id: string;
  group_id: string;
  meeting_date: Date;
  total_amount: bigint;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
}

interface CountRow { count: string }

function toGroupResponse(row: GroupRow, memberCount = 0) {
  return {
    id: row.id,
    groupRef: row.group_ref,
    name: row.name,
    type: row.type,
    description: row.description,
    meetingDay: row.meeting_day,
    meetingFrequency: row.meeting_frequency,
    status: row.status,
    memberCount,
    formedAt: row.formed_at,
    dissolvedAt: row.dissolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMemberResponse(row: MemberRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    clientId: row.client_id,
    role: row.role,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function toContributionResponse(row: ContributionRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    meetingDate: row.meeting_date,
    totalAmount: Number(row.total_amount),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function generateGroupRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `GRP-${year}-${rand}`;
}

@Injectable({ scope: Scope.REQUEST })
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private get s() { return this.tenantCtx.schemaName; }

  async create(dto: CreateGroupDto, createdBy: string) {
    const groupRef = generateGroupRef();
    const rows = await this.prisma.$queryRawUnsafe<GroupRow[]>(
      `INSERT INTO "${this.s}".groups
        (group_ref, name, type, description, meeting_day, meeting_frequency)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      groupRef, dto.name, dto.type,
      dto.description ?? null,
      dto.meetingDay ?? null,
      dto.meetingFrequency ?? null,
    );
    void createdBy;
    return toGroupResponse(rows[0]);
  }

  async list(options: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = options;
    const s = this.s;
    const offset = (page - 1) * limit;
    const conditions = ['g.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`g.status = $${idx++}`); params.push(status); }
    const where = conditions.join(' AND ');
    params.push(limit, offset);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<(GroupRow & { member_count: string })[]>(
        `SELECT g.*, COUNT(m.id) FILTER (WHERE m.is_active) AS member_count
           FROM "${s}".groups g
           LEFT JOIN "${s}".group_members m ON m.group_id = g.id
          WHERE ${where}
          GROUP BY g.id
          ORDER BY g.created_at DESC
          LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::text FROM "${s}".groups g WHERE ${where}`,
        ...params.slice(0, -2),
      ),
    ]);

    return {
      data: rows.map(r => toGroupResponse(r, parseInt(r.member_count, 10))),
      meta: { total: parseInt(countRows[0].count, 10), page, limit },
    };
  }

  async findOne(id: string) {
    const s = this.s;
    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<GroupRow[]>(
        `SELECT * FROM "${s}".groups WHERE id = $1::uuid AND deleted_at IS NULL`, id,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::text FROM "${s}".group_members WHERE group_id = $1::uuid AND is_active = TRUE`, id,
      ),
    ]);
    if (!rows.length) throw new NotFoundException('Group not found');
    return toGroupResponse(rows[0], parseInt(countRows[0].count, 10));
  }

  private async findOneRaw(id: string): Promise<GroupRow> {
    const rows = await this.prisma.$queryRawUnsafe<GroupRow[]>(
      `SELECT * FROM "${this.s}".groups WHERE id = $1::uuid AND deleted_at IS NULL`, id,
    );
    if (!rows.length) throw new NotFoundException('Group not found');
    return rows[0];
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.findOneRaw(id);
    const s = this.s;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.type !== undefined) { sets.push(`type = $${idx++}`); params.push(dto.type); }
    if (dto.description !== undefined) { sets.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.meetingDay !== undefined) { sets.push(`meeting_day = $${idx++}`); params.push(dto.meetingDay); }
    if (dto.meetingFrequency !== undefined) { sets.push(`meeting_frequency = $${idx++}`); params.push(dto.meetingFrequency); }

    params.push(id);
    const rows = await this.prisma.$queryRawUnsafe<GroupRow[]>(
      `UPDATE "${s}".groups SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      ...params,
    );
    return toGroupResponse(rows[0]);
  }

  async dissolve(id: string) {
    const group = await this.findOneRaw(id);
    if (group.status === GroupStatus.DISSOLVED) {
      throw new BadRequestException('Group is already dissolved');
    }
    const s = this.s;
    const rows = await this.prisma.$queryRawUnsafe<GroupRow[]>(
      `UPDATE "${s}".groups
       SET status = $1, dissolved_at = NOW(), updated_at = NOW()
       WHERE id = $2::uuid RETURNING *`,
      GroupStatus.DISSOLVED, id,
    );
    return toGroupResponse(rows[0]);
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async listMembers(groupId: string) {
    await this.findOneRaw(groupId);
    const rows = await this.prisma.$queryRawUnsafe<MemberRow[]>(
      `SELECT * FROM "${this.s}".group_members
       WHERE group_id = $1::uuid
       ORDER BY
         CASE role
           WHEN 'CHAIRPERSON' THEN 1
           WHEN 'SECRETARY' THEN 2
           WHEN 'TREASURER' THEN 3
           ELSE 4
         END, joined_at ASC`,
      groupId,
    );
    return rows.map(toMemberResponse);
  }

  async addMember(groupId: string, dto: AddMemberDto) {
    const group = await this.findOneRaw(groupId);
    if (group.status === GroupStatus.DISSOLVED) {
      throw new BadRequestException('Cannot add members to a dissolved group');
    }
    const s = this.s;

    const existing = await this.prisma.$queryRawUnsafe<MemberRow[]>(
      `SELECT * FROM "${s}".group_members
       WHERE group_id = $1::uuid AND client_id = $2::uuid AND is_active = TRUE`,
      groupId, dto.clientId,
    );
    if (existing.length) throw new ConflictException('Client is already an active member of this group');

    // Only one CHAIRPERSON allowed
    if (dto.role === 'CHAIRPERSON') {
      const chairs = await this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::text FROM "${s}".group_members
         WHERE group_id = $1::uuid AND role = 'CHAIRPERSON' AND is_active = TRUE`,
        groupId,
      );
      if (parseInt(chairs[0].count, 10) > 0) {
        throw new ConflictException('Group already has a Chairperson');
      }
    }

    const rows = await this.prisma.$queryRawUnsafe<MemberRow[]>(
      `INSERT INTO "${s}".group_members (group_id, client_id, role)
       VALUES ($1::uuid,$2::uuid,$3) RETURNING *`,
      groupId, dto.clientId, dto.role,
    );
    return toMemberResponse(rows[0]);
  }

  async removeMember(groupId: string, memberId: string) {
    await this.findOneRaw(groupId);
    const s = this.s;
    const rows = await this.prisma.$queryRawUnsafe<MemberRow[]>(
      `UPDATE "${s}".group_members
       SET is_active = FALSE, left_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid AND group_id = $2::uuid AND is_active = TRUE
       RETURNING *`,
      memberId, groupId,
    );
    if (!rows.length) throw new NotFoundException('Active member not found');
    return toMemberResponse(rows[0]);
  }

  // ── Contributions ──────────────────────────────────────────────────────────

  async listContributions(groupId: string, page = 1, limit = 20) {
    await this.findOneRaw(groupId);
    const s = this.s;
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<ContributionRow[]>(
        `SELECT * FROM "${s}".group_contributions
         WHERE group_id = $1::uuid
         ORDER BY meeting_date DESC LIMIT $2 OFFSET $3`,
        groupId, limit, offset,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::text FROM "${s}".group_contributions WHERE group_id = $1::uuid`,
        groupId,
      ),
    ]);

    return {
      data: rows.map(toContributionResponse),
      meta: { total: parseInt(countRows[0].count, 10), page, limit },
    };
  }

  async recordContribution(groupId: string, dto: RecordContributionDto, createdBy: string) {
    const group = await this.findOneRaw(groupId);
    if (group.status === GroupStatus.DISSOLVED) {
      throw new BadRequestException('Cannot record contributions for a dissolved group');
    }
    const s = this.s;
    const rows = await this.prisma.$queryRawUnsafe<ContributionRow[]>(
      `INSERT INTO "${s}".group_contributions
        (group_id, meeting_date, total_amount, notes, created_by)
       VALUES ($1::uuid,$2::date,$3,$4,$5::uuid) RETURNING *`,
      groupId, dto.meetingDate, BigInt(dto.totalAmount),
      dto.notes ?? null, createdBy,
    );
    return toContributionResponse(rows[0]);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getStats() {
    const s = this.s;
    const [groupRows, memberRows, contribRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ active: string; total: string }]>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'ACTIVE')::text AS active,
           COUNT(*)::text AS total
         FROM "${s}".groups WHERE deleted_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM "${s}".group_members WHERE is_active = TRUE`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; total: string }]>(
        `SELECT COUNT(*)::text AS count,
                COALESCE(SUM(total_amount),0)::text AS total
         FROM "${s}".group_contributions
         WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')`,
      ),
    ]);

    return {
      activeGroups: parseInt(groupRows[0].active, 10),
      totalGroups: parseInt(groupRows[0].total, 10),
      activeMembers: parseInt(memberRows[0].count, 10),
      contributionsThisMonth: {
        count: parseInt(contribRows[0].count, 10),
        total: Number(contribRows[0].total),
      },
    };
  }
}
