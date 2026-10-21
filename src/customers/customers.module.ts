import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { Company } from '../companies/company.entity';
import { CustomerPayment } from '../payments/customer-payment.entity';
import { Customer } from './customer.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
    imports: [TypeOrmModule.forFeature([Customer, Company, Account, CustomerPayment])],
    controllers: [CustomersController],
    providers: [CustomersService],
    exports: [CustomersService],
})
export class CustomersModule { }
