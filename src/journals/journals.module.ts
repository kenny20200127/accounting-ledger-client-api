import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalEntry } from './journal-entry.entity';
import { JournalLine } from './journal-line.entity';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';

@Module({
  imports: [TypeOrmModule.forFeature([JournalEntry, JournalLine, Account, AccountingPeriod, Branch, Company])],
  controllers: [JournalsController],
  providers: [JournalsService],
  exports: [JournalsService],
})
export class JournalsModule { }
