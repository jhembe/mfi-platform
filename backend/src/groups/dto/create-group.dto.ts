import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { GroupType } from '@mfi/shared';

export class CreateGroupDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEnum(GroupType) type!: GroupType;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() meetingDay?: string;
  @IsString() @IsOptional() meetingFrequency?: string;
}
