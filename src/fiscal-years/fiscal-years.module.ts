import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { Company } from '../companies/company.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { JournalLine } from '../journals/journal-line.entity';
import { FiscalYear } from './fiscal-year.entity';
import { FiscalYearsController } from './fiscal-years.controller';
import { FiscalYearsService } from './fiscal-years.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			FiscalYear,
			Company,
			AccountingPeriod,
			Account,
			JournalEntry,
			JournalLine,
		]),
	],
	controllers: [FiscalYearsController],
	providers: [FiscalYearsService],
	exports: [FiscalYearsService],
})
export class FiscalYearsModule {}
