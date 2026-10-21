import {
    IsEmail,
    IsNumberString,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Matches,
} from 'class-validator';

export class CreateCustomerDto {
    @IsUUID()
    companyId: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 50)
    @Matches(/^[A-Za-z0-9_-]+$/)
    customerCode: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 200)
    customerName: string;

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
    billingAddress?: string;

    @IsOptional()
    @IsUUID()
    receivableAccountId?: string;

    @IsOptional()
    @IsNumberString()
    @Matches(/^\d+(\.\d{1,2})?$/)
    creditLimit?: string;
}