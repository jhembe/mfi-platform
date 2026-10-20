import { IsString, IsEnum, IsOptional } from 'class-validator';
import { GroupType } from '@mfi/shared';

export class UpdateGroupDto {
  @IsString() @IsOptional() name?: string;
  @IsEnum(GroupType) @IsOptional() type?: GroupType;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() meetingDay?: string;
  @IsString() @IsOptional() meetingFrequency?: string;
}
