import { IsIn, IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateAccountTypeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  code: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsIn(['DEBIT', 'CREDIT'])
  normalBalance: 'DEBIT' | 'CREDIT';
}