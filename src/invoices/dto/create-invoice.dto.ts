import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceLineDto } from './create-invoice-line.dto';

export class CreateInvoiceDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  invoiceNumber?: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  invoiceDate: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'SENT'])
  status?: string;

  @IsOptional()
  @IsUUID()
  journalEntryId?: string;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines: CreateInvoiceLineDto[];
}