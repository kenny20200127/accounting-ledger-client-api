import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateAccountTypeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  code: string;

  @IsIn(['1', '2', '3', '4', '5'])
  codePrefix: '1' | '2' | '3' | '4' | '5';

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsIn(['DEBIT', 'CREDIT'])
  normalBalance: 'DEBIT' | 'CREDIT';

  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;
}
