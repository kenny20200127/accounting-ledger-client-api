import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyDto } from '../companies/dto/create-company.dto';
export class FirstAdminDto {
  @IsString() @Length(3, 100) @Matches(/^[A-Za-z0-9._-]+$/) username: string;
  @IsEmail() @Length(3, 255) email: string;
  @IsString() @Length(12, 128) password: string;
  @IsOptional() @IsString() @Length(1, 100) firstName?: string;
  @IsOptional() @IsString() @Length(1, 100) lastName?: string;
}
export class OnboardCompanyDto extends CreateCompanyDto {
  @ValidateNested() @Type(() => FirstAdminDto) firstAdmin: FirstAdminDto;
  @IsOptional() @IsBoolean() seedStandardAccounts?: boolean;
}
export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9._-]+$/)
  username?: string;
  @IsOptional() @IsString() @Length(1, 100) firstName?: string;
  @IsOptional() @IsString() @Length(1, 100) lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
export class ResetPasswordDto {
  @IsString() @Length(12, 128) password: string;
}
export class MenuPermissionDto {
  @IsUUID() menuId: string;
  @IsBoolean() canView: boolean;
  @IsBoolean() canCreate: boolean;
  @IsBoolean() canEdit: boolean;
  @IsBoolean() canDelete: boolean;
  @IsBoolean() canApprove: boolean;
}
export class SaveRoleDto {
  @IsUUID() companyId: string;
  @IsString() @Length(2, 100) roleName: string;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuPermissionDto)
  permissions: MenuPermissionDto[];
}
