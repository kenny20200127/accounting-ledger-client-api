import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Matches,
} from 'class-validator';

export class CreateBankAccountDto {
    @IsUUID()
    companyId: string;

    @IsUUID()
    accountId: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 150)
    bankName: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 200)
    accountName: string;

    @IsOptional()
    @IsString()
    @Length(1, 100)
    accountNumber?: string;

    @IsOptional()
    @IsString()
    @Length(3, 10)
    @Matches(/^[A-Za-z]+$/)
    currency?: string;

    @IsOptional()
    @IsString()
    @Matches(/^-?\d+(\.\d{1,2})?$/)
    openingBalance?: string;
}