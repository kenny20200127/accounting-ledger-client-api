import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  @Matches(/^[A-Za-z0-9._-]+$/)
  username: string;

  @IsEmail()
  @Length(3, 255)
  email: string;

  @IsString()
  @Length(12, 128)
  password: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds: string[];
}