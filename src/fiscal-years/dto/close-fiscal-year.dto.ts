import { IsUUID } from 'class-validator';

export class CloseFiscalYearDto {
  @IsUUID()
  retainedEarningsAccountId: string;
}
