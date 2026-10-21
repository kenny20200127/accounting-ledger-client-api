import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAccountDto {
  @IsUUID() companyId: string;
  @IsUUID() accountTypeId: string;
  @IsOptional() @IsUUID() parentAccountId?: string;
  @IsOptional() @IsUUID() accountCategoryId?: string;
  @IsString() @Length(1, 50) accountCode: string;
  @IsString() @Length(1, 150) accountName: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isHeader?: boolean;
  @IsOptional() @IsBoolean() isControlAccount?: boolean;
  @IsOptional() @IsBoolean() allowPosting?: boolean;
}
