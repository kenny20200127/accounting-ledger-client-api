import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccount } from '../banking/bank-account.entity';
import { Company } from '../companies/company.entity';
import { Customer } from '../customers/customer.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { Invoice } from '../invoices/invoice.entity';
import { CustomerPayment } from './customer-payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			CustomerPayment,
			Company,
			Customer,
			Invoice,
			BankAccount,
			JournalEntry,
		]),
	],
	controllers: [PaymentsController],
	providers: [PaymentsService],
	exports: [PaymentsService],
})
export class PaymentsModule {}
