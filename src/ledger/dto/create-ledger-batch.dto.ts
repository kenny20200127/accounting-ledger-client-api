import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LedgerBatchLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accountCode: string;

  @IsNumberString()
  @Matches(/^(?=.*[1-9])\d+(\.\d{1,2})?$/)
  amount: string;

  @IsIn(['DB', 'CR'])
  transactionType: 'DB' | 'CR';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  remarks?: string;
}

export class CreateLedgerBatchDto {
  @IsUUID('4')
  companyId: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  docType: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  refNo?: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  docDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LedgerBatchLineDto)
  lines: LedgerBatchLineDto[];
}
