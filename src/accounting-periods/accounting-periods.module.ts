import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountingPeriod } from './accounting-period.entity';
import { AccountingPeriodsController } from './accounting-periods.controller';
import { AccountingPeriodsService } from './accounting-periods.service';

import { FiscalYear } from '../fiscal-years/fiscal-year.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AccountingPeriod,
            FiscalYear,
        ]),
    ],
    controllers: [
        AccountingPeriodsController,
    ],
    providers: [
        AccountingPeriodsService,
    ],
    exports: [
        AccountingPeriodsService,
    ],
})
export class AccountingPeriodsModule { }
