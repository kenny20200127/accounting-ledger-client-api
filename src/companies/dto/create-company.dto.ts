import {
  IsEmail,
  IsInt,
  Min,
  Max,
  IsUrl,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateCompanyDto {
  @IsOptional()
  @IsString()
  @Length(0, 100)
  industry?: string;
  @IsOptional()
  @IsString()
  @Length(0, 255)
  website?: string;
  @IsOptional()
  @IsString()
  @Length(0, 150)
  contactPerson?: string;
  @IsOptional()
  @IsString()
  @Length(0, 100)
  contactTitle?: string;
  @IsOptional()
  @IsString()
  @Length(0, 30)
  postalCode?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) primaryColor?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) secondaryColor?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) fiscalYearStartMonth?: number;
  @IsOptional() @IsInt() @Min(1) @Max(28) fiscalYearStartDay?: number;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Matches(/^[A-Za-z0-9_-]+$/)
  companyCode: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  companyName: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  taxIdentificationNumber?: string;

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
  address?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  state?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(3, 10)
  @Matches(/^[A-Za-z]+$/)
  baseCurrency?: string;
}
