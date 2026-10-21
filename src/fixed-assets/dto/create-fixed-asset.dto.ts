import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateFixedAssetDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @Matches(/^[A-Za-z0-9_-]+$/)
  assetCode: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  assetName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  purchaseDate: string;

  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  purchaseCost: string;

  @IsOptional()
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  salvageValue?: string;

  @Min(1)
  usefulLifeMonths: number;

  @IsUUID()
  assetAccountId: string;

  @IsUUID()
  depreciationAccountId: string;

  @IsUUID()
  accumulatedDepreciationAccountId: string;
}