import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { RecordContributionDto } from './dto/record-contribution.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, FeatureKey, AuthenticatedUser } from '@mfi/shared';

@Controller('groups')
@RequireFeature(FeatureKey.GROUPS)
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.list({ status, page, limit: Math.min(limit, 100) });
  }

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/dissolve')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER)
  dissolve(@Param('id') id: string) {
    return this.service.dissolve(id);
  }

  // ── Members ────────────────────────────────────────────────────────────────

  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.service.listMembers(id);
  }

  @Post(':id/members')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.service.addMember(id, dto);
  }

  @Delete(':id/members/:memberId')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER)
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.service.removeMember(id, memberId);
  }

  // ── Contributions ──────────────────────────────────────────────────────────

  @Get(':id/contributions')
  listContributions(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.listContributions(id, page, Math.min(limit, 100));
  }

  @Post(':id/contributions')
  @Roles(UserRole.TENANT_ADMIN, UserRole.BRANCH_MANAGER, UserRole.LOAN_OFFICER, UserRole.CASHIER)
  recordContribution(
    @Param('id') id: string,
    @Body() dto: RecordContributionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.recordContribution(id, dto, user.id);
  }
}
