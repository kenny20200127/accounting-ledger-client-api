import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateCustomerPaymentDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  paymentNumber?: string;

  @IsDateString()
  paymentDate: string;

  @IsNumberString()
  @Matches(/^(?=.*[1-9])\d+(\.\d{1,2})?$/)
  amount: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  paymentMethod: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  referenceNumber?: string;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsUUID()
  journalEntryId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
