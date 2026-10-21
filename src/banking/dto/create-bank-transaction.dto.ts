import {
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateBankTransactionDto {
  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @IsOptional()
  @IsString()
  @Length(0, 150)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['DEBIT', 'CREDIT'])
  transactionType: 'DEBIT' | 'CREDIT';

  @IsNumberString()
  @Matches(/^(?=.*[1-9])\d+(\.\d{1,2})?$/)
  amount: string;

  @IsOptional()
  @IsUUID()
  journalEntryId?: string;
}