import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { Company } from '../companies/company.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { JournalLine } from '../journals/journal-line.entity';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { FiscalYear } from './fiscal-year.entity';

@Injectable()
export class FiscalYearsService {
  constructor(
    @InjectRepository(FiscalYear)
    private readonly fiscalYears: Repository<FiscalYear>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateFiscalYearDto): Promise<FiscalYear> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('Fiscal year start date must be before its end date.');
    }
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
      throw new BadRequestException('Company does not exist.');
    }
    try {
      return await this.fiscalYears.save(
        this.fiscalYears.create({ ...dto, isClosed: false }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).driverError?.code === '23505') {
        throw new ConflictException('This fiscal year name already exists for the company.');
      }
      throw error;
    }
  }

  findAll(companyId: string): Promise<FiscalYear[]> {
    return this.fiscalYears.find({
      where: { companyId },
      order: { startDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<FiscalYear> {
    const fiscalYear = await this.fiscalYears.findOne({ where: { fiscalYearId: id } });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found.');
    return fiscalYear;
  }

  // Closes every month still open in the year, posts one closing journal that
  // zeroes revenue and expense accounts into retained earnings, then locks the
  // fiscal year. Journal rows are tagged so reports can treat them specially.
  async closeYear(
    fiscalYearId: string,
    retainedEarningsAccountId: string,
    userId?: string,
  ) {
    if (!retainedEarningsAccountId)
      throw new BadRequestException('Select the retained earnings account.');

    return this.dataSource.transaction(async (manager) => {
      const fiscalYear = await manager
        .getRepository(FiscalYear)
        .findOne({ where: { fiscalYearId }, lock: { mode: 'pessimistic_write' } });
      if (!fiscalYear) throw new NotFoundException('Fiscal year not found.');
      if (fiscalYear.isClosed)
        throw new BadRequestException('This fiscal year is already closed.');

      const [{ count }] = await manager.query(
        `SELECT COUNT(*)::int AS count FROM accounting.journal_entries
         WHERE company_id = $1 AND transaction_date BETWEEN $2 AND $3
           AND status IN ('DRAFT', 'PENDING', 'APPROVED')`,
        [fiscalYear.companyId, fiscalYear.startDate, fiscalYear.endDate],
      );
      if (count > 0)
        throw new BadRequestException(
          `${count} unposted journal${count === 1 ? '' : 's'} in ${fiscalYear.yearName}. Post or cancel ${count === 1 ? 'it' : 'them'} before closing the year.`,
        );

      const account = await manager.getRepository(Account).findOne({
        where: { accountId: retainedEarningsAccountId },
        relations: { accountType: true },
      });
      if (
        !account ||
        account.companyId !== fiscalYear.companyId ||
        account.accountType?.code !== 'EQUITY' ||
        account.isHeader ||
        !account.allowPosting ||
        !account.isActive
      ) {
        throw new BadRequestException(
          'Retained earnings must be an active posting account of type EQUITY for this company.',
        );
      }

      const [periodRow] = await manager.query(
        `SELECT period_id AS "periodId" FROM accounting.accounting_periods
         WHERE fiscal_year_id = $1 AND start_date <= $2 AND end_date >= $2
         ORDER BY start_date LIMIT 1`,
        [fiscalYearId, fiscalYear.endDate],
      );
      const [lastPeriod] = periodRow
        ? [periodRow]
        : await manager.query(
            `SELECT period_id AS "periodId" FROM accounting.accounting_periods
             WHERE fiscal_year_id = $1 ORDER BY end_date DESC LIMIT 1`,
            [fiscalYearId],
          );
      if (!lastPeriod)
        throw new BadRequestException(
          'Create accounting periods for this fiscal year before closing it.',
        );

      const balances: {
        accountId: string;
        accountCode: string;
        accountName: string;
        net: string;
      }[] = await manager.query(
        `WITH year_postings AS (
           SELECT l.account_id, l.debit_amount - l.credit_amount AS net
           FROM accounting.journal_entry_lines l
           JOIN accounting.journal_entries j ON j.journal_entry_id = l.journal_entry_id
           WHERE j.company_id = $1 AND j.transaction_date BETWEEN $2 AND $3
             AND j.status IN ('POSTED', 'REVERSED')
             AND j.source_type IS DISTINCT FROM 'YEAR_END_CLOSE'
             AND NOT EXISTS (
               SELECT 1 FROM accounting.legacy_migration_records r
               WHERE r.journal_entry_id = j.journal_entry_id
             )
           UNION ALL
           SELECT h.account_id, h.debit_amount - h.credit_amount
           FROM ledger.histories h
           WHERE h.company_id = $1 AND h.doc_date BETWEEN $2 AND $3
         )
         SELECT a.account_id AS "accountId", a.account_code AS "accountCode",
                a.account_name AS "accountName", SUM(p.net)::numeric(20,2)::text AS net
         FROM year_postings p
         JOIN accounting.accounts a ON a.account_id = p.account_id
         JOIN accounting.account_types t ON t.account_type_id = a.account_type_id
         WHERE t.code IN ('REVENUE', 'EXPENSE')
         GROUP BY a.account_id, a.account_code, a.account_name
         HAVING SUM(p.net) <> 0
         ORDER BY a.account_code`,
        [fiscalYear.companyId, fiscalYear.startDate, fiscalYear.endDate],
      );

      let debitTotal = 0n;
      let creditTotal = 0n;
      const lines = balances.map((row) => {
        const net = toCents(row.net);
        const debit = net < 0n ? -net : 0n;
        const credit = net > 0n ? net : 0n;
        debitTotal += debit;
        creditTotal += credit;
        return {
          accountId: row.accountId,
          description: `Close ${row.accountCode} ${row.accountName} for ${fiscalYear.yearName}`,
          debitAmount: centsToAmount(debit),
          creditAmount: centsToAmount(credit),
        };
      });

      const profit = debitTotal - creditTotal;
      if (lines.length) {
        lines.push({
          accountId: account.accountId,
          description: `Year-end result transferred to ${account.accountCode} ${account.accountName}`,
          debitAmount: centsToAmount(profit < 0n ? -profit : 0n),
          creditAmount: centsToAmount(profit > 0n ? profit : 0n),
        });
      }

      let journal: JournalEntry | null = null;
      if (lines.length) {
        const jr = manager.getRepository(JournalEntry);
        const lr = manager.getRepository(JournalLine);
        journal = await jr.save(
          jr.create({
            companyId: fiscalYear.companyId,
            branchId: null,
            periodId: lastPeriod.periodId,
            transactionDate: fiscalYear.endDate,
            referenceNumber: `YEC-${fiscalYear.yearName}`,
            description: `Year-end closing entry for ${fiscalYear.yearName}`,
            sourceType: 'YEAR_END_CLOSE',
            sourceId: fiscalYear.fiscalYearId,
            status: 'POSTED',
            totalDebit: centsToAmount(debitTotal + (profit < 0n ? -profit : 0n)),
            totalCredit: centsToAmount(creditTotal + (profit > 0n ? profit : 0n)),
            postedAt: new Date(),
            postedBy: userId ?? null,
            createdBy: userId ?? null,
          }),
        );
        await lr.save(
          lines.map((line, index) =>
            lr.create({
              journalEntryId: journal!.journalEntryId,
              accountId: line.accountId,
              lineNumber: index + 1,
              description: line.description,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
            }),
          ),
        );
      }

      const [closed] = await manager.query(
        `WITH updated AS (
           UPDATE accounting.accounting_periods
           SET is_open = false, is_closed = true, closed_at = now(), closed_by = $2
           WHERE fiscal_year_id = $1 AND (is_open OR NOT is_closed)
           RETURNING 1
         )
         SELECT COUNT(*)::int AS count FROM updated`,
        [fiscalYearId, userId ?? null],
      );
      await manager.query(
        'UPDATE accounting.fiscal_years SET is_closed = true WHERE fiscal_year_id = $1',
        [fiscalYearId],
      );
      await manager.query(
        'INSERT INTO audit.audit_logs(company_id,user_id,action,record_id,new_values) VALUES($1,$2,$3,$4,$5)',
        [
          fiscalYear.companyId,
          userId ?? null,
          'FISCAL_YEAR_CLOSED',
          fiscalYearId,
          JSON.stringify({
            yearName: fiscalYear.yearName,
            closingJournalId: journal?.journalEntryId ?? null,
            netProfit: centsToAmount(profit),
            closedPeriods: closed.count,
          }),
        ],
      );

      return {
        fiscalYear: { ...fiscalYear, isClosed: true },
        closedPeriods: closed.count,
        netProfit: centsToAmount(profit),
        closingJournal: journal
          ? {
              journalEntryId: journal.journalEntryId,
              journalNumber: journal.journalNumber,
              totalDebit: journal.totalDebit,
              totalCredit: journal.totalCredit,
              lines: lines.length,
            }
          : null,
      };
    });
  }

  async reopenYear(fiscalYearId: string, userId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const fiscalYear = await manager
        .getRepository(FiscalYear)
        .findOne({ where: { fiscalYearId }, lock: { mode: 'pessimistic_write' } });
      if (!fiscalYear) throw new NotFoundException('Fiscal year not found.');
      if (!fiscalYear.isClosed)
        throw new BadRequestException('This fiscal year is not closed.');

      const journals: { journalEntryId: string }[] = await manager.query(
        `SELECT journal_entry_id AS "journalEntryId" FROM accounting.journal_entries
         WHERE company_id = $1 AND source_type = 'YEAR_END_CLOSE' AND source_id = $2`,
        [fiscalYear.companyId, fiscalYearId],
      );
      const journalIds = journals.map((journal) => journal.journalEntryId);
      if (journalIds.length) {
        await manager.query(
          'DELETE FROM accounting.journal_entry_lines WHERE journal_entry_id = ANY($1::uuid[])',
          [journalIds],
        );
        await manager.query(
          'DELETE FROM accounting.journal_entries WHERE journal_entry_id = ANY($1::uuid[])',
          [journalIds],
        );
      }

      const [reopened] = await manager.query(
        `WITH updated AS (
           UPDATE accounting.accounting_periods
           SET is_open = true, is_closed = false, closed_at = NULL, closed_by = NULL
           WHERE fiscal_year_id = $1
           RETURNING 1
         )
         SELECT COUNT(*)::int AS count FROM updated`,
        [fiscalYearId],
      );
      await manager.query(
        'UPDATE accounting.fiscal_years SET is_closed = false WHERE fiscal_year_id = $1',
        [fiscalYearId],
      );
      await manager.query(
        'INSERT INTO audit.audit_logs(company_id,user_id,action,record_id,new_values) VALUES($1,$2,$3,$4,$5)',
        [
          fiscalYear.companyId,
          userId ?? null,
          'FISCAL_YEAR_REOPENED',
          fiscalYearId,
          JSON.stringify({
            yearName: fiscalYear.yearName,
            deletedClosingJournals: journalIds.length,
            reopenedPeriods: reopened.count,
          }),
        ],
      );

      return {
        fiscalYear: { ...fiscalYear, isClosed: false },
        deletedClosingJournals: journalIds.length,
        reopenedPeriods: reopened.count,
      };
    });
  }
}

function toCents(value: string | number): bigint {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}
function centsToAmount(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}