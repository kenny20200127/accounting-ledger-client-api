import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateBalanceSheetDto {
  @IsString()
  @Length(1, 200)
  description: string;

  // Rejected by the service: generated codes and account types are immutable.
  @IsOptional()
  @IsString()
  code?: string;
}
