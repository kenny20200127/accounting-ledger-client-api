import { DataSource } from 'typeorm';
import { LedgerService } from './ledger.service';

jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => undefined }));

const companyId = '00000000-0000-4000-8000-000000000001';

function fixture() {
  const query = jest.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes('COUNT(DISTINCT h.doc_no)'))
      return [
        {
          asOf: '2026-11-10',
          todayTransactions: 2,
          weekTransactions: 5,
          monthTransactions: 9,
          yearTransactions: 40,
          todayPosted: '100.00',
          weekPosted: '400.00',
          monthPosted: '900.00',
          yearPosted: '4000.00',
        },
      ];
    throw new Error('Unexpected ledger stats query: ' + sql + ' ' + String(params));
  });
  const service = new LedgerService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { query } as unknown as DataSource,
  );
  return { service, query };
}

describe('ledger dashboard statistics', () => {
  it('scopes counts to the company and returns each period', async () => {
    const f = fixture();
    await expect(f.service.stats(companyId)).resolves.toEqual({
      asOf: '2026-11-10',
      today: { transactions: 2, posted: '100.00' },
      week: { transactions: 5, posted: '400.00' },
      month: { transactions: 9, posted: '900.00' },
      year: { transactions: 40, posted: '4000.00' },
    });
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM ledger.histories h'),
      [companyId],
    );
  });

  it('counts distinct documents and bounds each period from the current date', async () => {
    const f = fixture();
    await f.service.stats(companyId);
    const sql = String(f.query.mock.calls[0][0]);
    expect(sql).toContain('COUNT(DISTINCT h.doc_no)');
    expect(sql).toContain('h.doc_date = CURRENT_DATE');
    expect(sql).toContain("date_trunc('week', CURRENT_DATE)");
    expect(sql).toContain("date_trunc('month', CURRENT_DATE)");
    expect(sql).toContain("date_trunc('year', CURRENT_DATE)");
    expect(sql).toContain('SUM(h.debit_amount)');
  });
});
