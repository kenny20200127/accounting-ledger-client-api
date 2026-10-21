import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateSupplierDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @Matches(/^[A-Za-z0-9_-]+$/)
  supplierCode: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  supplierName: string;

  @IsOptional()
  @IsEmail()
  @Length(0, 150)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsUUID()
  payableAccountId?: string;
}