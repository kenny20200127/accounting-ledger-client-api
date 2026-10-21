import { IsDateString, IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class CreateFiscalYearDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  yearName: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}