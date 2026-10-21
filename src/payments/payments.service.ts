import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { BankAccount } from '../banking/bank-account.entity';
import { Company } from '../companies/company.entity';
import { Customer } from '../customers/customer.entity';
import { Invoice } from '../invoices/invoice.entity';
import { postLedgerLines } from '../ledger/ledger-posting';
import { JournalEntry } from '../journals/journal-entry.entity';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { CustomerPayment } from './customer-payment.entity';
import { nextPaymentNumber } from './payment-number';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(CustomerPayment)
    private readonly payments: Repository<CustomerPayment>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    @InjectRepository(BankAccount)
    private readonly bankAccounts: Repository<BankAccount>,
    @InjectRepository(JournalEntry)
    private readonly journals: Repository<JournalEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateCustomerPaymentDto): Promise<CustomerPayment> {
    if (dto.paymentNumber?.trim()) {
      throw new BadRequestException(
        'Payment numbers are generated automatically and cannot be set manually.',
      );
    }
    if (
      !(await this.companies.exists({ where: { companyId: dto.companyId } }))
    ) {
      throw new BadRequestException('Company does not exist.');
    }
    const customer = await this.customers.findOne({
      where: { customerId: dto.customerId },
    });
    if (!customer || customer.companyId !== dto.companyId) {
      throw new BadRequestException(
        'Customer must exist and belong to the selected company.',
      );
    }
    if (dto.bankAccountId) {
      const bankAccount = await this.bankAccounts.findOne({
        where: { bankAccountId: dto.bankAccountId },
      });
      if (!bankAccount || bankAccount.companyId !== dto.companyId) {
        throw new BadRequestException(
          'Bank account must exist and belong to the selected company.',
        );
      }
    }
    if (dto.journalEntryId) {
      const journal = await this.journals.findOne({
        where: { journalEntryId: dto.journalEntryId },
      });
      if (!journal || journal.companyId !== dto.companyId) {
        throw new BadRequestException(
          'Journal entry must exist and belong to the selected company.',
        );
      }
    }

    // Two concurrent creates can derive the same auto number; retry regenerates after the winner commits.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          let invoice: Invoice | null = null;
          if (dto.invoiceId) {
            invoice = await manager.getRepository(Invoice).findOne({
              where: { invoiceId: dto.invoiceId },
              lock: { mode: 'pessimistic_write' },
            });
            if (
              !invoice ||
              invoice.companyId !== dto.companyId ||
              invoice.customerId !== dto.customerId
            ) {
              throw new BadRequestException(
                'Invoice must exist and belong to the selected customer and company.',
              );
            }
            const remaining =
              toCents(invoice.totalAmount) - toCents(invoice.amountPaid);
            if (toCents(dto.amount) > remaining) {
              throw new BadRequestException(
                'Payment amount cannot exceed the invoice balance due.',
              );
            }
            invoice.amountPaid = centsToAmount(
              toCents(invoice.amountPaid) + toCents(dto.amount),
            );
            if (toCents(invoice.amountPaid) === toCents(invoice.totalAmount)) {
              invoice.status = 'PAID';
            } else {
              invoice.status = 'PARTIALLY_PAID';
            }
            await manager.getRepository(Invoice).save(invoice);
          }

          const payment = manager.getRepository(CustomerPayment).create({
            ...dto,
            paymentNumber: await nextPaymentNumber(
              manager.getRepository(CustomerPayment),
              dto.companyId,
              dto.paymentDate,
            ),
            invoiceId: dto.invoiceId ?? null,
            bankAccountId: dto.bankAccountId ?? null,
            journalEntryId: dto.journalEntryId ?? null,
            referenceNumber: dto.referenceNumber ?? null,
            notes: dto.notes ?? null,
            createdBy: dto.createdBy ?? null,
          });
          const saved = await manager.getRepository(CustomerPayment).save(payment);

          // Every payment posts to the ledger against its accounts: debit the
          // receiving bank/cash account, credit the customer's receivable.
          const lines: { accountId: string; debit: string; credit: string; remarks?: string | null }[] = [];
          if (saved.bankAccountId) {
            const bankAccount = await manager
              .getRepository(BankAccount)
              .findOne({ where: { bankAccountId: saved.bankAccountId } });
            if (bankAccount) {
              lines.push({ accountId: bankAccount.accountId, debit: saved.amount, credit: '0.00', remarks: saved.notes });
            }
          }
          if (customer.receivableAccountId) {
            lines.push({ accountId: customer.receivableAccountId, debit: '0.00', credit: saved.amount, remarks: saved.notes });
          }
          await postLedgerLines(manager, {
            companyId: saved.companyId,
            branchId: null,
            docType: 'RV',
            docDate: saved.paymentDate,
            refNo: saved.paymentNumber,
            createdBy: saved.createdBy,
            sourceKey: `payment:${saved.paymentId}`,
            lines,
          });
          return saved;
        });
      } catch (error) {
        const driverCode = (error as { driverError?: { code?: string } })
          .driverError?.code;
        if (error instanceof QueryFailedError && driverCode === '23505') {
          if (attempt >= 4) {
            throw new ConflictException(
              'Unable to allocate a unique payment number. Please retry.',
            );
          }
          continue;
        }
        throw error;
      }
    }
  }

  findAll(companyId: string, customerId?: string): Promise<CustomerPayment[]> {
    return this.payments.find({
      where: { companyId, ...(customerId ? { customerId } : {}) },
      order: { paymentDate: 'DESC', paymentNumber: 'ASC' },
    });
  }

  async findOne(id: string): Promise<CustomerPayment> {
    const payment = await this.payments.findOne({
      where: { paymentId: id },
    });
    if (!payment) throw new NotFoundException('Customer payment not found.');
    return payment;
  }
}

function toCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function centsToAmount(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
