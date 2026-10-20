import { IsString, Length } from 'class-validator';

export class Enable2faDto {
  @IsString() @Length(6, 6) code!: string;
}

export class Verify2faDto {
  @IsString() tempToken!: string;
  @IsString() @Length(6, 6) code!: string;
}

export class Disable2faDto {
  @IsString() password!: string;
  @IsString() @Length(6, 6) code!: string;
}
