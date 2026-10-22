import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  expenseNumber?: string;

  @IsDateString()
  expenseDate: string;

  @IsString()
  @Length(1, 10000)
  description: string;

  @IsUUID()
  expenseAccountId: string;

  // The account credited by the payment voucher — mandatory so the ledger never
  // gets a one-sided expense posting.
  @IsUUID()
  paymentAccountId: string;

  @IsNumberString()
  @Matches(/^(?=.*[1-9])\d+(\.\d{1,2})?$/)
  amount: string;

  @IsOptional()
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  taxAmount?: string;

  @IsOptional()
  @IsUUID()
  journalEntryId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  status?: string;

  @IsOptional()
  @IsUUID()
  createdBy?: string;
}