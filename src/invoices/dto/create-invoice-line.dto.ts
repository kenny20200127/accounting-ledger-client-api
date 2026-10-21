import {
  IsNumberString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateInvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 10000)
  description: string;

  @IsNumberString()
  @Matches(/^(?=.*[1-9])\d*(\.\d{1,4})?$/)
  quantity: string;

  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  unitPrice: string;

  @IsOptional()
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  discountAmount?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  taxAmount?: string;

  @IsUUID()
  revenueAccountId: string;
}