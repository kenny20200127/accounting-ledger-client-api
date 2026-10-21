import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';

export class CreateJournalLineDto {
  @IsUUID() accountId: string;
  @IsOptional() @IsString() description?: string;
  @Matches(/^\d{1,18}(\.\d{1,2})?$/) debitAmount: string;
  @Matches(/^\d{1,18}(\.\d{1,2})?$/) creditAmount: string;
  @IsOptional() @IsString() referenceNumber?: string;
}

export class CreateJournalDto {
  @IsUUID() companyId: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsUUID() periodId: string;
  @IsDateString() transactionDate: string;
  @IsOptional() @IsString() referenceNumber?: string;
  @IsString() @Length(2, 1000) description: string;
  @IsOptional() @IsUUID() createdBy?: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => CreateJournalLineDto)
  lines: CreateJournalLineDto[];
}
