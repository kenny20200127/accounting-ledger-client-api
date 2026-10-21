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
import { postLedgerLines } from '../ledger/ledger-posting';
import { JournalEntry } from '../journals/journal-entry.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Expense } from './expense.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(JournalEntry)
    private readonly journals: Repository<JournalEntry>,
    private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateExpenseDto): Promise<Expense> {
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
      throw new BadRequestException('Company does not exist.');
    }

    if (dto.branchId) {
      const branch = await this.branches.findOne({
        where: { branchId: dto.branchId },
      });
      if (!branch || branch.companyId !== dto.companyId) {
        throw new BadRequestException(
          'Branch must exist and belong to the selected company.',
        );
      }
    }

    const accountIds = [dto.expenseAccountId, dto.paymentAccountId].filter(
      (accountId): accountId is string => Boolean(accountId),
    );
    const accounts = await this.accounts.findBy(
      accountIds.map(accountId => ({ accountId })),
    );
    if (accounts.length !== new Set(accountIds).size) {
      throw new BadRequestException('One or more expense accounts do not exist.');
    }
    if (accounts.some(account => account.companyId !== dto.companyId)) {
      throw new BadRequestException(
        'Expense accounts must belong to the selected company.',
      );
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

    const taxAmount = dto.taxAmount ?? '0.00';
    const totalAmount = centsToAmount(toCents(dto.amount) + toCents(taxAmount));

    // Auto-generate expense number if not supplied
    const expenseNumber = dto.expenseNumber?.trim() || await generateExpenseNumber(this.expenses, dto.companyId);

    const expense = this.expenses.create({
      ...dto,
      expenseNumber,
      taxAmount,
      totalAmount,
      status: dto.status ?? 'DRAFT',
      branchId: dto.branchId ?? null,
      paymentAccountId: dto.paymentAccountId ?? null,
      journalEntryId: dto.journalEntryId ?? null,
      createdBy: dto.createdBy ?? null,
    });

    try {
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(Expense).save(expense);
        // Every expense posts to the ledger against its accounts: debit the
        // expense account, credit the payment account when one is set.
        const lines = [
          { accountId: saved.expenseAccountId, debit: saved.totalAmount, credit: '0.00', remarks: saved.description },
        ];
        if (saved.paymentAccountId) {
          lines.push({ accountId: saved.paymentAccountId, debit: '0.00', credit: saved.totalAmount, remarks: saved.description });
        }
        await postLedgerLines(manager, {
          companyId: saved.companyId,
          branchId: saved.branchId,
          docType: 'PV',
          docDate: saved.expenseDate,
          refNo: saved.expenseNumber,
          createdBy: saved.createdBy,
          sourceKey: `expense:${saved.expenseId}`,
          lines,
        });
        return saved;
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === '23505'
      ) {
        throw new ConflictException(
          'An expense with this number already exists for the company.',
        );
      }
      throw error;
    }
  }

  findAll(companyId: string): Promise<Expense[]> {
    return this.expenses.find({
      where: { companyId },
      order: { expenseDate: 'DESC', expenseNumber: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Expense> {
    const expense = await this.expenses.findOne({
      where: { expenseId: id },
    });
    if (!expense) throw new NotFoundException('Expense not found.');
    return expense;
  }
}

function toCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function centsToAmount(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

async function generateExpenseNumber(
  repo: import('typeorm').Repository<Expense>,
  companyId: string,
): Promise<string> {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  // Count existing expenses for this company today to build a sequence
  const todayStart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const count = await repo.count({
    where: { companyId, expenseDate: todayStart as unknown as string },
  });
  const seq = String(count + 1).padStart(4, '0');
  return `EXP-${datePart}-${seq}`;
}