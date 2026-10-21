import {
IsDateString,
IsInt,
IsNotEmpty,
IsString,
IsUUID,
Length,
Max,
Min,
} from 'class-validator';

export class CreateAccountingPeriodDto {
@IsUUID()
fiscalYearId: string;

@IsString()
@IsNotEmpty()
@Length(1, 50)
periodName: string;

@IsInt()
@Min(1)
@Max(53)
periodNumber: number;

@IsDateString()
startDate: string;

@IsDateString()
endDate: string;
}
