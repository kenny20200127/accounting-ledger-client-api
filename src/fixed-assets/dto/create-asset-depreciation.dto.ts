import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateAssetDepreciationDto {
  @IsUUID()
  periodId: string;

  @IsDateString()
  depreciationDate: string;

  @IsNumberString()
  @Matches(/^(?=.*[1-9])\d+(\.\d{1,2})?$/)
  amount: string;

  @IsOptional()
  @IsUUID()
  journalEntryId?: string;
}