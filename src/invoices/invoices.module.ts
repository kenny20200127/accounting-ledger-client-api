import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { Customer } from '../customers/customer.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { InvoiceLine } from './invoice-line.entity';
import { Invoice } from './invoice.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Invoice,
			InvoiceLine,
			Company,
			Branch,
			Customer,
			Account,
			JournalEntry,
		]),
	],
	controllers: [InvoicesController],
	providers: [InvoicesService, InvoicePdfService],
	exports: [InvoicesService],
})
export class InvoicesModule {}
