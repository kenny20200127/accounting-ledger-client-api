
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdministrationModule } from './administration/administration.module';
import { CompaniesModule } from './companies/companies.module';
import { BranchesModule } from './branches/branches.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { FiscalYearsModule } from './fiscal-years/fiscal-years.module';
import { AccountingPeriodsModule } from './accounting-periods/accounting-periods.module';
import { AccountsModule } from './accounts/accounts.module';
import { JournalsModule } from './journals/journals.module';
import { LedgerModule } from './ledger/ledger.module';
import { CustomersModule } from './customers/customers.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { BankingModule } from './banking/banking.module';
import { ExpensesModule } from './expenses/expenses.module';
import { FixedAssetsModule } from './fixed-assets/fixed-assets.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.getOrThrow<string>('DB_HOST');
        const username = config.getOrThrow<string>('DB_USERNAME');
        const password = config.getOrThrow<string>('DB_PASSWORD');
        const database = config.getOrThrow<string>('DB_DATABASE');

        const port = Number(config.get<string>('DB_PORT') ?? 5432);

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error('DB_PORT must be a valid port number.');
        }

        const sslEnabled =
          config.get<string>('DB_SSL')?.toLowerCase() === 'true';

        return {
          type: 'postgres' as const,
          host,
          port,
          username,
          password,
          database,

          ssl: sslEnabled
            ? { rejectUnauthorized: false }
            : false,

          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),

    AdministrationModule,
    CompaniesModule,
    BranchesModule,
    UsersModule,
    RolesModule,
    FiscalYearsModule,
    AccountingPeriodsModule,
    AccountsModule,
    JournalsModule,
    LedgerModule,
    CustomersModule,
    SuppliersModule,
    InvoicesModule,
    PaymentsModule,
    BankingModule,
    ExpensesModule,
    FixedAssetsModule,
    ReportsModule,
    AuditModule,
    AuthModule,
  ],
})
export class AppModule { }
