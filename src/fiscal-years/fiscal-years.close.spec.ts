import { DataSource, EntityManager } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { JournalLine } from '../journals/journal-line.entity';
import { FiscalYear } from './fiscal-year.entity';
import { FiscalYearsService } from './fiscal-years.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));

const companyId = '00000000-0000-4000-8000-000000000001';
const fiscalYearId = '00000000-0000-4000-8000-000000000002';
const periodId = '00000000-0000-4000-8000-000000000003';
const retainedEarningsId = '00000000-0000-4000-8000-000000000004';

function fiscalYear(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    fiscalYearId,
    companyId,
    yearName: 'FY2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isClosed: false,
    ...overrides,
  };
}

function fixture(options: {
  balances?: { accountId: string; accountCode: string; accountName: string; net: string }[];
  unposted?: number;
  year?: ReturnType<typeof fiscalYear>;
  closingJournals?: string[];
  closedPeriods?: number;
}) {
  const year = options.year ?? fiscalYear();
  const savedJournal: Record<string, unknown>[] = [];
  const savedLines: Record<string, unknown>[][] = [];
  const fiscalRepo = { findOne: jest.fn(async () => year) };
  const accountRepo = {
    findOne: jest.fn(async () => ({
      accountId: retainedEarningsId,
      companyId,
      accountCode: '320000',
      accountName: 'Retained earnings',
      isHeader: false,
      allowPosting: true,
      isActive: true,
      accountType: { code: 'EQUITY' },
    })),
  };
  const journalRepo = {
    create: (data: Record<string, unknown>) => data,
    save: jest.fn(async (data: Record<string, unknown>) => {
      const saved = { ...data, journalNumber: '42' };
      savedJournal.push(saved);
      return saved;
    }),
  };
  const lineRepo = {
    create: (data: Record<string, unknown>) => data,
    save: jest.fn(async (data: Record<string, unknown>[]) => {
      savedLines.push(data);
      return data;
    }),
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('COUNT(*)::int AS count FROM accounting.journal_entries'))
      return [{ count: options.unposted ?? 0 }];
    if (sql.includes('SELECT period_id AS "periodId"')) return [{ periodId }];
    if (sql.includes('WITH year_postings')) return options.balances ?? [];
    if (sql.includes('SELECT journal_entry_id AS "journalEntryId"'))
      return (options.closingJournals ?? []).map((journalEntryId) => ({ journalEntryId }));
    if (sql.includes('FROM updated')) return [{ count: options.closedPeriods ?? 12 }];
    if (sql.includes('UPDATE accounting.fiscal_years')) return [];
    if (sql.includes('INSERT INTO audit.audit_logs')) return [];
    if (sql.includes('DELETE FROM accounting.journal')) return [];
    throw new Error('Unexpected closing query: ' + sql);
  });
  const manager = {
    query,
    getRepository: (entity: unknown) => {
      if (entity === FiscalYear) return fiscalRepo;
      if (entity === Account) return accountRepo;
      if (entity === JournalEntry) return journalRepo;
      if (entity === JournalLine) return lineRepo;
      throw new Error('Unexpected repository');
    },
  } as unknown as EntityManager;
  const dataSource = {
    transaction: async (work: (manager: EntityManager) => unknown) => work(manager),
  } as unknown as DataSource;
  const service = new FiscalYearsService({} as never, {} as never, dataSource);
  return { service, savedJournal, savedLines, query };
}

describe('fiscal year closing', () => {
  it('zeroes revenue and expense and transfers the profit to retained earnings', async () => {
    const f = fixture({
      balances: [
        { accountId: 'rev-1', accountCode: '410000-00001', accountName: 'Sales', net: '-1000.00' },
        { accountId: 'exp-1', accountCode: '512000-00001', accountName: 'Rent', net: '400.00' },
      ],
    });
    const result = await f.service.closeYear(fiscalYearId, retainedEarningsId, 'user-1');

    expect(f.savedLines[0]).toEqual([
      expect.objectContaining({ accountId: 'rev-1', debitAmount: '1000.00', creditAmount: '0.00', lineNumber: 1 }),
      expect.objectContaining({ accountId: 'exp-1', debitAmount: '0.00', creditAmount: '400.00', lineNumber: 2 }),
      expect.objectContaining({ accountId: retainedEarningsId, debitAmount: '0.00', creditAmount: '600.00', lineNumber: 3 }),
    ]);
    expect(f.savedJournal[0]).toMatchObject({
      companyId,
      periodId,
      transactionDate: '2026-12-31',
      referenceNumber: 'YEC-FY2026',
      sourceType: 'YEAR_END_CLOSE',
      sourceId: fiscalYearId,
      status: 'POSTED',
      totalDebit: '1000.00',
      totalCredit: '1000.00',
    });
    expect(result).toMatchObject({ closedPeriods: 12, netProfit: '600.00' });
    expect(result.closingJournal).toMatchObject({ journalNumber: '42', lines: 3 });
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE accounting.fiscal_years SET is_closed = true'),
      [fiscalYearId],
    );
  });

  it('debits retained earnings when the year is a loss', async () => {
    const f = fixture({
      balances: [
        { accountId: 'rev-1', accountCode: '410000-00001', accountName: 'Sales', net: '-1000.00' },
        { accountId: 'exp-1', accountCode: '512000-00001', accountName: 'Rent', net: '1400.00' },
      ],
    });
    const result = await f.service.closeYear(fiscalYearId, retainedEarningsId, 'user-1');

    expect(f.savedLines[0][2]).toMatchObject({
      accountId: retainedEarningsId,
      debitAmount: '400.00',
      creditAmount: '0.00',
    });
    expect(f.savedJournal[0]).toMatchObject({ totalDebit: '1400.00', totalCredit: '1400.00' });
    expect(result).toMatchObject({ netProfit: '-400.00' });
  });

  it('locks the year without a journal when nothing needs closing', async () => {
    const f = fixture({ balances: [] });
    const result = await f.service.closeYear(fiscalYearId, retainedEarningsId, 'user-1');

    expect(f.savedJournal).toHaveLength(0);
    expect(result.closingJournal).toBeNull();
    expect(result).toMatchObject({ closedPeriods: 12, netProfit: '0.00' });
  });

  it('refuses to close a year with unposted journals', async () => {
    const f = fixture({ unposted: 3 });
    await expect(
      f.service.closeYear(fiscalYearId, retainedEarningsId, 'user-1'),
    ).rejects.toThrow('3 unposted journals in FY2026');
    expect(f.savedJournal).toHaveLength(0);
  });

  it('reopens the year and removes its closing journal', async () => {
    const f = fixture({
      year: fiscalYear({ isClosed: true }),
      closingJournals: ['closing-1'],
      closedPeriods: 12,
    });
    const result = await f.service.reopenYear(fiscalYearId, 'user-1');

    expect(result).toMatchObject({ deletedClosingJournals: 1, reopenedPeriods: 12 });
    expect(f.query).toHaveBeenCalledWith(
      'DELETE FROM accounting.journal_entry_lines WHERE journal_entry_id = ANY($1::uuid[])',
      [['closing-1']],
    );
    expect(f.query).toHaveBeenCalledWith(
      'DELETE FROM accounting.journal_entries WHERE journal_entry_id = ANY($1::uuid[])',
      [['closing-1']],
    );
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('SET is_open = true, is_closed = false'),
      [fiscalYearId],
    );
  });
});
