import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { FinancialReportQuery } from './financial-report-query.dto';
import { FinancialReportsService } from './financial-reports.service';

jest.mock('@nestjs/typeorm', () => ({ InjectDataSource: () => () => undefined }));

const companyId = '00000000-0000-4000-8000-000000000001';
const branchId = '00000000-0000-4000-8000-000000000002';
const base = { companyId, asOf: '2026-03-31', includeZero: true };

function balance(overrides: Partial<{
  accountCode: string; accountName: string; accountType: string; isHeader: boolean;
  parentCode: string | null; mainCode: string; mainDescription: string;
  month: string; ytd: string; closing: string; activity: number; monthActivity: number;
}> = {}) {
  return {
    accountCode: '156000-00001', accountName: 'Cash account', accountType: 'ASSET',
    isHeader: false, parentCode: null, mainCode: '156000', mainDescription: 'Cash and bank',
    month: '0.00', ytd: '0.00', closing: '0.00', activity: 0, monthActivity: 0,
    ...overrides,
  };
}

function fixture(balances: ReturnType<typeof balance>[]) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM core.companies')) return [{ companyName: 'Test company', address: '', currency: 'NGN' }];
    if (sql.includes('FROM core.branches')) return [{ branch_name: 'Test branch' }];
    if (sql.includes('FROM accounting.fiscal_years')) return [{ start: '2026-01-01', end: '2026-12-31' }];
    if (sql.includes('WITH posted_lines')) return balances;
    if (sql.includes('SELECT COUNT(*)::int AS count')) return [{ count: 0 }];
    if (sql.includes('to_regclass')) return [{ exists: false }];
    throw new Error('Unexpected report query');
  });
  return { service: new FinancialReportsService({ query } as unknown as DataSource), query };
}

function accounts() {
  return [
    balance({ accountCode: '156000-00000', accountName: 'Old header name', isHeader: true }),
    balance({ month: '100.25', ytd: '100.25', closing: '1100.25', activity: 2, monthActivity: 1 }),
    balance({ accountCode: '157000-00002', accountName: 'Bank overdraft', month: '-40.10', ytd: '-40.10', closing: '-40.10', activity: 1, monthActivity: 1 }),
    balance({ accountCode: '156000-00003', accountName: 'Capital account', accountType: 'EQUITY', mainCode: '310000', mainDescription: 'Capital', month: '-60.15', ytd: '-60.15', closing: '-1060.15', activity: 2, monthActivity: 1 }),
    balance({ accountCode: 'ZERO', accountName: 'Unused account', mainCode: '999000', mainDescription: 'Unused main' }),
  ];
}

describe('trial balance reports', () => {
  it('lists actual chart codes and names without netting sibling accounts in detail', async () => {
    const { service } = fixture(accounts());
    const report = await service.generate({ ...base, report: 'trial-balance-detail' });
    expect(report.title).toBe('Detail Trial Balance');
    expect(report.columns[0].label).toBe('Chart Account No.');
    expect(report.rows.map(row => row.accountCode)).toEqual(['156000-00001', '156000-00003', '157000-00002', 'ZERO']);
    expect(report.rows[0]).toMatchObject({ description: 'Cash account', monthDebit: '100.25', monthCredit: '0.00', ytdDebit: '1100.25', ytdCredit: '0.00' });
    expect(report.rows.find(row => row.accountCode === '157000-00002')).toMatchObject({ monthDebit: '0.00', monthCredit: '40.10', ytdCredit: '40.10' });
    expect(report.totals[0].values).toEqual({ monthDebit: '100.25', monthCredit: '100.25', ytdDebit: '1100.25', ytdCredit: '1100.25' });
    expect(report.balanced).toBe(true);
  });

  it('groups summary by assigned main account, not chart prefixes or parent labels', async () => {
    const { service } = fixture(accounts());
    const report = await service.generate({ ...base, report: 'trial-balance' });
    expect(report.title).toBe('Summary Trial Balance');
    expect(report.columns[0].label).toBe('Main Account No.');
    expect(report.rows.map(row => row.accountCode)).toEqual(['156000', '310000', '999000']);
    expect(report.rows[0]).toMatchObject({ description: 'Cash and bank', monthDebit: '60.15', monthCredit: '0.00', ytdDebit: '1060.15', ytdCredit: '0.00' });
    expect(report.rows[1]).toMatchObject({ description: 'Capital', monthCredit: '60.15', ytdCredit: '1060.15' });
    expect(report.totals[0].values).toEqual({ monthDebit: '60.15', monthCredit: '60.15', ytdDebit: '1060.15', ytdCredit: '1060.15' });
    expect(report.balanced).toBe(true);
  });

  it.each(['trial-balance', 'trial-balance-detail'] as const)('filters zero displayed balances for %s but retains brought-forward balances', async reportKind => {
    const { service } = fixture([
      balance({ closing: '10.00', activity: 1 }),
      balance({ accountCode: 'ZERO', mainCode: '999000', ytd: '20.00' }),
    ]);
    const report = await service.generate({ ...base, report: reportKind, includeZero: false });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ monthDebit: '0.00', ytdDebit: '10.00' });
    expect(report.balanced).toBe(false);
  });

  it('nets offsetting chart balances only in summary before applying the zero filter', async () => {
    const { service } = fixture([
      balance({ month: '12.34', closing: '12.34', activity: 1 }),
      balance({ accountCode: '156000-00002', month: '-12.34', closing: '-12.34', activity: 1 }),
    ]);
    const detail = await service.generate({ ...base, report: 'trial-balance-detail', includeZero: false });
    const summary = await service.generate({ ...base, report: 'trial-balance', includeZero: false });
    expect(detail.rows).toHaveLength(2);
    expect(summary.rows).toHaveLength(0);
    expect(detail.balanced).toBe(true);
    expect(summary.balanced).toBe(true);
    expect((await service.generate({ ...base, report: 'trial-balance' })).rows).toHaveLength(1);
  });

  it.each(['trial-balance', 'trial-balance-detail'] as const)('retains real header postings without rolling children up twice for %s', async reportKind => {
    const { service } = fixture([
      balance({ accountCode: '156000-00000', isHeader: true, month: '5.00', closing: '5.00', activity: 1 }),
      balance({ month: '10.00', closing: '10.00', activity: 1 }),
    ]);
    const report = await service.generate({ ...base, report: reportKind });
    expect(report.rows).toHaveLength(reportKind === 'trial-balance' ? 1 : 2);
    expect(report.totals[0].values.monthDebit).toBe('15.00');
    expect(report.balanced).toBe(false);
  });

  it.each(['trial-balance', 'trial-balance-detail'] as const)('returns balanced zero totals for an empty %s', async reportKind => {
    const { service } = fixture([]);
    const report = await service.generate({ ...base, report: reportKind });
    expect(report.rows).toEqual([]);
    expect(report.totals[0].values).toEqual({ monthDebit: '0.00', monthCredit: '0.00', ytdDebit: '0.00', ytdCredit: '0.00' });
    expect(report.balanced).toBe(true);
    expect(report.warnings).toContain('No posted transactions exist for the selected month.');
  });

  it.each(['trial-balance', 'trial-balance-detail'] as const)('preserves company, branch, date, and both posting sources for %s', async reportKind => {
    const { service, query } = fixture([]);
    await service.generate({ ...base, report: reportKind, branchId });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WITH posted_lines'), [companyId, '2026-03-31', '2026-03-01', '2026-01-01', branchId]);
    const sql = query.mock.calls.find(([text]) => text.includes('WITH posted_lines'))![0];
    expect(sql).toContain('j.company_id=$1');
    expect(sql).toContain('h.company_id=$1');
    expect(sql).toContain('j.branch_id=$5');
    expect(sql).toContain('h.branch_id=$5');
    expect(sql).toContain('FROM ledger.histories h');
    expect(sql).toContain('ma.main_code AS "mainCode"');
    expect(sql).toContain('ma.company_id=a.company_id');
    await expect(service.generate({ ...base, report: reportKind, groupCodes: ['156000'] })).rejects.toThrow('Account-group filtering');
  });

  it('preserves profit and loss calculations', async () => {
    const { service } = fixture([
      balance({ accountCode: '410000-00001', accountType: 'REVENUE', mainCode: '410000', mainDescription: 'Income', month: '-100.00', ytd: '-200.00', closing: '-200.00', activity: 2 }),
      balance({ accountCode: '512000-00001', accountType: 'EXPENSE', mainCode: '512000', mainDescription: 'Operating expenses', month: '25.00', ytd: '50.00', closing: '50.00', activity: 2 }),
    ]);
    const report = await service.generate({ ...base, report: 'profit-loss' });
    expect(report.totals[0].values).toEqual({ monthAmount: '-75.00', ytdAmount: '-150.00' });
  });
});

describe('financial report query', () => {
  it.each(['trial-balance', 'trial-balance-detail'])('accepts %s and transforms filters', async report => {
    const query = plainToInstance(FinancialReportQuery, { ...base, report, includeZero: 'false' });
    expect(await validate(query)).toEqual([]);
    expect(query.includeZero).toBe(false);
  });

  it('rejects unsupported report kinds', async () => {
    const query = plainToInstance(FinancialReportQuery, { ...base, report: 'unknown' });
    expect((await validate(query)).some(error => error.property === 'report')).toBe(true);
  });
});
