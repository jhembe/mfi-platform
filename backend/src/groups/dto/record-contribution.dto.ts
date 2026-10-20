import { IsString, IsNumber, IsPositive, IsOptional, IsDateString } from 'class-validator';

export class RecordContributionDto {
  @IsDateString() meetingDate!: string;
  @IsNumber() @IsPositive() totalAmount!: number;
  @IsString() @IsOptional() notes?: string;
}
