import { IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class UpdateMainAccountDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @IsOptional()
  @IsUUID()
  balanceSheetId?: string;

  @IsOptional()
  @IsUUID()
  accountSubtypeId?: string;

  // Rejected by the service: account codes and account types are immutable.
  @IsOptional()
  @IsString()
  mainCode?: string;
}
