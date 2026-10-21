import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { Company } from '../companies/company.entity';
import { Supplier } from './supplier.entity';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
	imports: [TypeOrmModule.forFeature([Supplier, Company, Account])],
	controllers: [SuppliersController],
	providers: [SuppliersService],
	exports: [SuppliersService],
})
export class SuppliersModule {}
