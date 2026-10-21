import { CompanyListQueryDto } from '../common/company-list-query.dto';
import { findCompanyList } from '../common/find-company-list';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { Customer } from '../customers/customer.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { nextInvoiceNumber } from './invoice-number';
import { InvoiceDocument } from './invoice-pdf.service';
import { InvoiceLine } from './invoice-line.entity';
import { Invoice } from './invoice.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly invoiceLines: Repository<InvoiceLine>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(JournalEntry)
    private readonly journals: Repository<JournalEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    if (!dto.lines.length) {
      throw new BadRequestException(
        'An invoice must contain at least one line.',
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
    if (
      !customer ||
      customer.companyId !== dto.companyId ||
      !customer.isActive
    ) {
      throw new BadRequestException(
        'Customer must exist, be active, and belong to the selected company.',
      );
    }
    if (dto.dueDate && dto.dueDate < dto.invoiceDate) {
      throw new BadRequestException(
        'Due date cannot be earlier than the invoice date.',
      );
    }

    if (dto.branchId) {
      const branch = await this.branches.findOne({
        where: { branchId: dto.branchId },
      });
      if (!branch || branch.companyId !== dto.companyId || !branch.isActive) {
        throw new BadRequestException(
          'Branch must exist, be active, and belong to the selected company.',
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

    const accountIds = [
      ...new Set(dto.lines.map((line) => line.revenueAccountId)),
    ];
    const accounts = await this.accounts.find({
      where: accountIds.map((accountId) => ({ accountId })),
      relations: { accountType: true },
    });
    for (const accountId of accountIds) {
      const account = accounts.find(
        (candidate) => candidate.accountId === accountId,
      );
      if (!account) {
        throw new BadRequestException(
          `Revenue account ${accountId} does not exist.`,
        );
      }
      const label = `${account.accountCode} ${account.accountName}`;
      if (account.accountType?.code !== 'REVENUE') {
        throw new BadRequestException(
          `Account ${label} is of type ${account.accountType?.code ?? 'unknown'}, not revenue. Invoices require a REVENUE account.`,
        );
      }
      if (account.companyId !== dto.companyId) {
        throw new BadRequestException(
          `Account ${label} does not belong to the selected company.`,
        );
      }
      if (account.isHeader) {
        throw new BadRequestException(
          `Account ${label} is a header account and cannot be posted to. Select one of its detail accounts instead.`,
        );
      }
      if (!account.allowPosting) {
        throw new BadRequestException(
          `Account ${label} is not marked as a posting account.`,
        );
      }
      if (!account.isActive) {
        throw new BadRequestException(`Account ${label} is inactive.`);
      }
    }

    const calculated = dto.lines.map((line) => calculateLine(line));
    const subtotalCents = calculated.reduce(
      (sum, line) => sum + line.subtotalCents,
      0n,
    );
    const discountCents = calculated.reduce(
      (sum, line) => sum + line.discountCents,
      0n,
    );
    const taxCents = calculated.reduce((sum, line) => sum + line.taxCents, 0n);
    const totalCents = subtotalCents - discountCents + taxCents;
    if (totalCents < 0n) {
      throw new BadRequestException('Invoice total cannot be negative.');
    }
    // numeric(20,2) columns hold at most 18 integer digits; overflow rejects the insert server-side.
    const maxCents = 10n ** 20n - 1n;
    const amounts = [
      ...calculated.flatMap((line) => [
        line.subtotalCents,
        line.discountCents,
        line.taxCents,
        line.lineTotalCents,
      ]),
      subtotalCents,
      discountCents,
      taxCents,
      totalCents,
    ];
    if (amounts.some((amount) => amount > maxCents)) {
      throw new BadRequestException(
        'Invoice amounts exceed the supported range.',
      );
    }

    if (dto.invoiceNumber?.trim()) {
      throw new BadRequestException(
        'Invoice numbers are generated automatically and cannot be set manually.',
      );
    }
    // Two concurrent creates can derive the same auto number; retry regenerates after the winner commits.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const invoiceRepo = manager.getRepository(Invoice);
          const lineRepo = manager.getRepository(InvoiceLine);
          const invoice = await invoiceRepo.save(
            invoiceRepo.create({
              companyId: dto.companyId,
              branchId: dto.branchId ?? null,
              customerId: dto.customerId,
              invoiceNumber: await nextInvoiceNumber(
                invoiceRepo,
                dto.companyId,
                dto.invoiceDate,
              ),
              invoiceDate: dto.invoiceDate,
              dueDate: dto.dueDate ?? null,
              subtotal: centsToAmount(subtotalCents),
              discountAmount: centsToAmount(discountCents),
              taxAmount: centsToAmount(taxCents),
              totalAmount: centsToAmount(totalCents),
              amountPaid: '0.00',
              status: dto.status ?? 'DRAFT',
              journalEntryId: dto.journalEntryId ?? null,
              createdBy: dto.createdBy ?? null,
            }),
          );

          await lineRepo.save(
            dto.lines.map((line, index) =>
              lineRepo.create({
                invoiceId: invoice.invoiceId,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discountAmount: line.discountAmount ?? '0.00',
                taxAmount: line.taxAmount ?? '0.00',
                revenueAccountId: line.revenueAccountId,
                lineTotal: centsToAmount(calculated[index].lineTotalCents),
              }),
            ),
          );

          return invoiceRepo.findOne({
            where: { invoiceId: invoice.invoiceId },
            relations: { lines: true },
          }) as Promise<Invoice>;
        });
      } catch (error) {
        const driverCode = (error as { driverError?: { code?: string } })
          .driverError?.code;
        if (error instanceof QueryFailedError && driverCode === '23505') {
          if (attempt >= 4) {
            throw new ConflictException(
              'Unable to allocate a unique invoice number. Please retry.',
            );
          }
          continue;
        }
        throw error;
      }
    }
  }

  findAll(query: CompanyListQueryDto) {
    return findCompanyList(
      this.invoices,
      query,
      {
        relations: { lines: true },
        order: { invoiceDate: 'DESC', invoiceNumber: 'ASC', invoiceId: 'DESC' },
      },
      ['invoiceNumber', 'status'],
    );
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoices.findOne({
      where: { invoiceId: id },
      relations: { lines: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  }

  async findForDocument(id: string): Promise<InvoiceDocument> {
    const invoice = await this.invoices.findOne({
      where: { invoiceId: id },
      relations: { company: true, customer: true, branch: true, lines: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return {
      companyName: invoice.company.companyName,
      companyAddress: [
        invoice.company.address,
        invoice.company.city,
        invoice.company.state,
        invoice.company.country,
      ]
        .filter(Boolean)
        .join(', '),
      taxNumber: invoice.company.taxIdentificationNumber ?? undefined,
      logoData: invoice.company.logoData,
      primaryColor: invoice.company.primaryColor,
      secondaryColor: invoice.company.secondaryColor,
      currency: invoice.company.baseCurrency,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      customerName: invoice.customer.customerName,
      customerAddress: invoice.customer.billingAddress,
      customerEmail: invoice.customer.email,
      customerPhone: invoice.customer.phone,
      customerTaxNumber: invoice.customer.taxNumber,
      lines: invoice.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxAmount: line.taxAmount,
        lineTotal: line.lineTotal,
      })),
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      generatedAt: new Date().toISOString(),
    };
  }
}

function calculateLine(line: CreateInvoiceDto['lines'][number]) {
  const quantityScaled = decimalToScaledInteger(line.quantity, 4);
  const unitPriceCents = decimalToScaledInteger(line.unitPrice, 2);
  const subtotalCents = (quantityScaled * unitPriceCents + 5000n) / 10000n;
  const discountCents = decimalToScaledInteger(line.discountAmount ?? '0', 2);
  const taxCents = decimalToScaledInteger(line.taxAmount ?? '0', 2);
  if (discountCents > subtotalCents) {
    throw new BadRequestException('Line discount cannot exceed its subtotal.');
  }
  return {
    subtotalCents,
    discountCents,
    taxCents,
    lineTotalCents: subtotalCents - discountCents + taxCents,
  };
}

function decimalToScaledInteger(value: string, scale: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt((fraction + '0'.repeat(scale)).slice(0, scale))
  );
}

function centsToAmount(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
