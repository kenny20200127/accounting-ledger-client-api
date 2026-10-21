import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { Company } from '../companies/company.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { BankAccount } from './bank-account.entity';
import { BankTransaction } from './bank-transaction.entity';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';

@Module({
    imports: [TypeOrmModule.forFeature([BankAccount, BankTransaction, Account, Company, JournalEntry])],
    controllers: [BankingController],
    providers: [BankingService],
    exports: [BankingService],
})
export class BankingModule { }
