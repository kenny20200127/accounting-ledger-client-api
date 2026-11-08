import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateMainAccountDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  accountTypeId: string;

  @IsUUID()
  balanceSheetId: string;

  @IsUUID()
  accountSubtypeId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  description: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  shortName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @Length(1, 20)
  @Matches(/^\d+$/, { message: 'Main account code must contain digits only.' })
  mainCode?: string;
}
