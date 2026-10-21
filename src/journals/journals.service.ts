import { CompanyListQueryDto } from '../common/company-list-query.dto';
import { findCompanyList } from '../common/find-company-list';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { JournalEntry } from './journal-entry.entity';
import { JournalLine } from './journal-line.entity';
import { CreateJournalDto } from './dto/create-journal.dto';

@Injectable()
export class JournalsService {
  constructor(
    @InjectRepository(JournalEntry) private readonly journals: Repository<JournalEntry>,
    @InjectRepository(JournalLine) private readonly lines: Repository<JournalLine>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountingPeriod) private readonly periods: Repository<AccountingPeriod>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateJournalDto): Promise<JournalEntry> {
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
      throw new BadRequestException('Company does not exist.');
    }
    const period = await this.periods.findOne({
      where: { periodId: dto.periodId },
      relations: { fiscalYear: true },
    });
    if (!period || !period.isOpen || period.isClosed) {
      throw new BadRequestException('Accounting period does not exist or is closed.');
    }
    if (period.fiscalYear.companyId !== dto.companyId) {
      throw new BadRequestException('Accounting period must belong to the selected company.');
    }
    if (dto.transactionDate < period.startDate || dto.transactionDate > period.endDate) {
      throw new BadRequestException('Transaction date must be within the selected accounting period.');
    }
    if (dto.branchId) {
      const branch = await this.branches.findOne({ where: { branchId: dto.branchId } });
      if (!branch || branch.companyId !== dto.companyId) {
        throw new BadRequestException('Branch must belong to the selected company.');
      }
    }

    const accountIds = [...new Set(dto.lines.map(x => x.accountId))];
    const accounts = await this.accounts.findBy({ accountId: In(accountIds) });
    if (accounts.length !== accountIds.length) throw new BadRequestException('One or more accounts do not exist.');
    if (accounts.some(a => a.companyId !== dto.companyId || !a.isActive || !a.allowPosting || a.isHeader)) {
      throw new BadRequestException('Every journal account must be active, allow posting, and belong to this company.');
    }

    for (const line of dto.lines) {
      const debit = Number(line.debitAmount);
      const credit = Number(line.creditAmount);
      if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 ||
        (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        throw new BadRequestException('Each line must have either a positive debit or a positive credit, but not both.');
      }
    }

    return this.dataSource.transaction(async manager => {
      const journalRepo = manager.getRepository(JournalEntry);
      const lineRepo = manager.getRepository(JournalLine);
      const journal = journalRepo.create({
        companyId: dto.companyId,
        branchId: dto.branchId,
        periodId: dto.periodId,
        transactionDate: dto.transactionDate,
        referenceNumber: dto.referenceNumber,
        description: dto.description,
        createdBy: dto.createdBy,
        status: 'DRAFT',
        totalDebit: '0.00',
        totalCredit: '0.00',
      });
      const saved = await journalRepo.save(journal);
      const savedLines = dto.lines.map((line, i) => lineRepo.create({
        journalEntryId: saved.journalEntryId,
        accountId: line.accountId,
        lineNumber: i + 1,
        description: line.description,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        referenceNumber: line.referenceNumber,
      }));
      await lineRepo.save(savedLines);
      const created = await journalRepo.findOne({ where: { journalEntryId: saved.journalEntryId }, relations: { lines: true } });
      if (!created) throw new NotFoundException('Created journal entry could not be reloaded.');
      return created;
    });
  }
  findAll(query: CompanyListQueryDto) {
    return findCompanyList(this.journals, query, { relations: { lines: true }, order: { transactionDate: 'DESC', createdAt: 'DESC', journalEntryId: 'DESC' } }, ['referenceNumber', 'description']);
  }


  async findOne(id: string): Promise<JournalEntry> {
    const journal = await this.journals.findOne({ where: { journalEntryId: id }, relations: { lines: true } });
    if (!journal) throw new NotFoundException('Journal entry not found.');
    return journal;
  }

  async post(id: string, userId?: string): Promise<JournalEntry> {
    return this.dataSource.transaction(async manager => {
      const jr = manager.getRepository(JournalEntry);
      const lr = manager.getRepository(JournalLine);
      const journal = await jr.findOne({ where: { journalEntryId: id }, lock: { mode: 'pessimistic_write' } });
      if (!journal) throw new NotFoundException('Journal entry not found.');
      if (journal.status !== 'DRAFT' && journal.status !== 'APPROVED') {
        throw new BadRequestException('Only draft or approved journals can be posted.');
      }
      const period = await manager.getRepository(AccountingPeriod).findOne({ where: { periodId: journal.periodId } });
      if (!period || !period.isOpen || period.isClosed ||
        journal.transactionDate < period.startDate || journal.transactionDate > period.endDate) {
        throw new BadRequestException('The accounting period is closed or the transaction date is outside the period.');
      }
      const lines = await lr.find({ where: { journalEntryId: id }, order: { lineNumber: 'ASC' } });
      if (lines.length < 2) throw new BadRequestException('A journal must contain at least two lines.');
      const debitCents = lines.reduce((sum, l) => sum + toCents(l.debitAmount), 0n);
      const creditCents = lines.reduce((sum, l) => sum + toCents(l.creditAmount), 0n);
      if (debitCents <= 0n || debitCents !== creditCents) {
        throw new BadRequestException('Journal is not balanced. Total debits must equal total credits and be greater than zero.');
      }
      journal.totalDebit = centsToAmount(debitCents);
      journal.totalCredit = centsToAmount(creditCents);
      journal.status = 'POSTED';
      journal.postedBy = userId;
      journal.postedAt = new Date();
      await jr.save(journal);
      const posted = await jr.findOne({ where: { journalEntryId: id }, relations: { lines: true } });
      if (!posted) throw new NotFoundException('Posted journal entry could not be reloaded.');
      return posted;
    });
  }

  async reverse(id: string, userId?: string): Promise<JournalEntry> {
    const original = await this.findOne(id);
    if (original.status !== 'POSTED') throw new BadRequestException('Only posted journals can be reversed.');
    if (original.reversedJournalId) throw new BadRequestException('This journal has already been reversed.');

    const reversal = await this.dataSource.transaction(async manager => {
      const jr = manager.getRepository(JournalEntry);
      const lr = manager.getRepository(JournalLine);
      const period = await manager.getRepository(AccountingPeriod).findOne({ where: { periodId: original.periodId } });
      if (!period || !period.isOpen || period.isClosed) throw new BadRequestException('The original accounting period is closed. Open a period for reversal.');
      const journal = await jr.save(jr.create({
        companyId: original.companyId, branchId: original.branchId, periodId: original.periodId,
        transactionDate: new Date().toISOString().slice(0, 10),
        referenceNumber: `REV-${original.referenceNumber ?? original.journalNumber}`,
        description: `Reversal of journal ${original.journalNumber}: ${original.description}`,
        status: 'DRAFT', createdBy: userId, totalDebit: '0.00', totalCredit: '0.00',
      }));
      await lr.save(original.lines.map((line, i) => lr.create({
        journalEntryId: journal.journalEntryId, accountId: line.accountId, lineNumber: i + 1,
        description: `Reversal: ${line.description ?? original.description}`,
        debitAmount: line.creditAmount, creditAmount: line.debitAmount,
        referenceNumber: line.referenceNumber,
      })));
      return journal;
    });
    const posted = await this.post(reversal.journalEntryId, userId);
    await this.journals.update({ journalEntryId: id }, { status: 'REVERSED', reversedJournalId: posted.journalEntryId });
    return posted;
  }
}

function toCents(value: string): bigint {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}
function centsToAmount(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
