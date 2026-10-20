import {
  IsString, IsNotEmpty, IsArray, ValidateNested, IsUUID,
  IsNumber, IsPositive, IsOptional, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JournalLineDto {
  @IsUUID() accountId!: string;
  @IsNumber() @IsPositive() debitAmount!: number;
  @IsNumber() @IsPositive() creditAmount!: number;
  @IsString() @IsOptional() description?: string;
}

export class CreateJournalEntryDto {
  @IsDateString() entryDate!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsString() @IsOptional() reference?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}
