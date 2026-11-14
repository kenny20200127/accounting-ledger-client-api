import { IsUUID } from 'class-validator';

export class GeneratePeriodsDto {
  @IsUUID()
  fiscalYearId: string;
}
