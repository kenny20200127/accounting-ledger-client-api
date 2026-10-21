import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/company.entity';
import { FiscalYear } from './fiscal-year.entity';
import { FiscalYearsController } from './fiscal-years.controller';
import { FiscalYearsService } from './fiscal-years.service';

@Module({
	imports: [TypeOrmModule.forFeature([FiscalYear, Company])],
	controllers: [FiscalYearsController],
	providers: [FiscalYearsService],
	exports: [FiscalYearsService],
})
export class FiscalYearsModule {}
