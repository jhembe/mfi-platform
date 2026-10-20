import { IsUUID, IsEnum } from 'class-validator';
import { GroupMemberRole } from '@mfi/shared';

export class AddMemberDto {
  @IsUUID() clientId!: string;
  @IsEnum(GroupMemberRole) role!: GroupMemberRole;
}
