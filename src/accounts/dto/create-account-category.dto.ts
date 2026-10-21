import { IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAccountCategoryDto {
  @IsUUID()
  accountTypeId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}