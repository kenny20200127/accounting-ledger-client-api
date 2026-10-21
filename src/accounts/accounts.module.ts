import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './account.entity';
import { AccountCategory } from './account-category.entity';
import { AccountType } from './account-type.entity';
import { Company } from '../companies/company.entity';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountCategoriesController } from './account-categories.controller';
import { AccountCategoriesService } from './account-categories.service';
import { AccountTypesController } from './account-types.controller';
import { AccountTypesService } from './account-types.service';

@Module({
  imports: [TypeOrmModule.forFeature([Account, AccountType, AccountCategory, Company])],
  controllers: [AccountsController, AccountTypesController, AccountCategoriesController],
  providers: [AccountsService, AccountTypesService, AccountCategoriesService],
  exports: [AccountsService, AccountTypesService, AccountCategoriesService],
})
export class AccountsModule {}
