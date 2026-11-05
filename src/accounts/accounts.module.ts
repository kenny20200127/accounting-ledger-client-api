import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './account.entity';
import { AccountCategory } from './account-category.entity';
import { AccountSubtype } from './account-subtype.entity';
import { AccountType } from './account-type.entity';
import { BalanceSheetClassification } from './balance-sheet-classification.entity';
import { MainAccount } from './main-account.entity';
import { Company } from '../companies/company.entity';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountCategoriesController } from './account-categories.controller';
import { AccountCategoriesService } from './account-categories.service';
import { AccountSubtypesController } from './account-subtypes.controller';
import { AccountSubtypesService } from './account-subtypes.service';
import { AccountTypesController } from './account-types.controller';
import { AccountTypesService } from './account-types.service';
import { BalanceSheetsController } from './balance-sheets.controller';
import { BalanceSheetsService } from './balance-sheets.service';
import { MainAccountsController } from './main-accounts.controller';
import { MainAccountsService } from './main-accounts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      AccountType,
      AccountCategory,
      AccountSubtype,
      BalanceSheetClassification,
      MainAccount,
      Company,
    ]),
  ],
  controllers: [
    AccountsController,
    AccountTypesController,
    AccountCategoriesController,
    AccountSubtypesController,
    BalanceSheetsController,
    MainAccountsController,
  ],
  providers: [
    AccountsService,
    AccountTypesService,
    AccountCategoriesService,
    AccountSubtypesService,
    BalanceSheetsService,
    MainAccountsService,
  ],
  exports: [
    AccountsService,
    AccountTypesService,
    AccountCategoriesService,
    AccountSubtypesService,
    BalanceSheetsService,
    MainAccountsService,
  ],
})
export class AccountsModule {}
