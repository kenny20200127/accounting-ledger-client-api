import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
export class ReportOptionsQuery {
  @IsUUID('4') companyId: string;
}
export class FinancialReportQuery extends ReportOptionsQuery {
  @IsIn(['trial-balance', 'trial-balance-detail', 'profit-loss', 'account-balances', 'chart-of-accounts', 'main-accounts'])
  report: 'trial-balance' | 'trial-balance-detail' | 'profit-loss' | 'account-balances' | 'chart-of-accounts' | 'main-accounts' = 'trial-balance';
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) asOf: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsOptional() @IsUUID('4') fiscalYearId?: string;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.split(',').map((v: string) => v.trim()) : value)
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(50, { each: true }) groupCodes?: string[];
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean() includeZero = true;
}
