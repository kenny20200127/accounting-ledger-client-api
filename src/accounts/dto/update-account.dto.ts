import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  accountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  // Rejected by the service: the account code follows its main account.
  @IsOptional()
  @IsString()
  accountCode?: string;

  @IsOptional()
  @IsUUID()
  mainAccountId?: string;
}
