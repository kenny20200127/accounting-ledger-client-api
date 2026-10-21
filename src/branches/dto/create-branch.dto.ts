import {
    IsEmail,
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Length,
} from 'class-validator';

export class CreateBranchDto {
    @IsUUID()
    companyId: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 50)
    branchCode: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 150)
    branchName: string;

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
    @IsEmail()
    @Length(0, 150)
    email?: string;

    @IsOptional()
    @IsString()
    @Length(0, 50)
    phone?: string;

    @IsOptional()
    @IsBoolean()
    isHeadOffice?: boolean;
}