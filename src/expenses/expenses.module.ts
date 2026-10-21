import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { Expense } from './expense.entity';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Expense, Company, Branch, Account, JournalEntry]),
	],
	controllers: [ExpensesController],
	providers: [ExpensesService],
	exports: [ExpensesService],
})
export class ExpensesModule {}
