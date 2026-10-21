import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { LedgerController } from './ledger.controller';
import { Ledger } from './ledger.entity';
import { LedgerHistory } from './ledger-history.entity';
import { LedgerService } from './ledger.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ledger, LedgerHistory, Company, Account, Branch])],
  controllers: [LedgerController],
  providers: [LedgerService],
})
export class LedgerModule {}
