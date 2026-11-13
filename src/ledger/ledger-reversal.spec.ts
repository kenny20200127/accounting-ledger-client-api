import { DataSource, EntityManager } from 'typeorm';
import { LedgerService } from './ledger.service';

jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => undefined }));

const companyId = '00000000-0000-4000-8000-000000000001';
const accountDebit = '00000000-0000-4000-8000-000000000011';
const accountCredit = '00000000-0000-4000-8000-000000000012';

type DocRow = {
  historyId: string;
  companyId: string;
  accountId: string;
  branchId: string | null;
  docNo: string;
  docType: string;
  refNo: string | null;
  docDate: string;
  debitAmount: string;
  creditAmount: string;
  remarks: string | null;
  legacyRef: string | null;
  reversedByDocNo: string | null;
  reversalOfDocNo: string | null;
};

function docRow(overrides: Partial<DocRow> = {}): DocRow {
  return {
    historyId: '1',
    companyId,
    accountId: accountDebit,
    branchId: null,
    docNo: 'JV-20261113-0001',
    docType: 'JV',
    refNo: null,
    docDate: '2026-11-13',
    debitAmount: '100.00',
    creditAmount: '0.00',
    remarks: null,
    legacyRef: null,
    reversedByDocNo: null,
    reversalOfDocNo: null,
    ...overrides,
  };
}

function fixture(rows: DocRow[]) {
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('SELECT history_id AS "historyId" FROM ledger.histories'))
      return [{ historyId: rows[0]?.historyId ?? '1' }];
    if (sql.includes('FOR UPDATE')) return rows;
    if (sql.includes('CURRENT_DATE')) return [{ today: '2026-11-13' }];
    if (sql.includes('INSERT INTO ledger.ledgers')) return [];
    if (sql.includes('UPDATE ledger.histories')) return [];
    throw new Error('Unexpected ledger reversal query: ' + sql);
  });
  const saved: Record<string, unknown>[] = [];
  const repo = {
    find: jest.fn(async () => [{ docNo: 'JV-20261113-0001' }]),
    create: (data: Record<string, unknown>) => data,
    save: jest.fn(async (entities: Record<string, unknown>[]) => {
      saved.push(...entities);
      return entities.map((entity, index) => ({
        ...entity,
        historyId: String(index + 1),
      }));
    }),
  };
  const manager = {
    query,
    getRepository: () => repo,
  } as unknown as EntityManager;
  const dataSource = {
    transaction: async (work: (manager: EntityManager) => unknown) => work(manager),
  } as unknown as DataSource;
  const service = new LedgerService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    dataSource,
  );
  return { service, query, repo, saved };
}

describe('ledger batch reversal', () => {
  it('posts an offsetting document and links the original', async () => {
    const f = fixture([
      docRow(),
      docRow({
        historyId: '2',
        accountId: accountCredit,
        debitAmount: '0.00',
        creditAmount: '100.00',
      }),
    ]);
    await expect(f.service.reverseBatch('1', 'user-1')).resolves.toEqual({
      docNo: 'JV-20261113-0001',
      reversalDocNo: 'JV-20261113-0002',
      docType: 'JV',
      docDate: '2026-11-13',
      period: '202611',
      lines: [
        { historyId: '1', accountId: accountDebit, transactionType: 'CR', amount: '100.00' },
        { historyId: '2', accountId: accountCredit, transactionType: 'DB', amount: '100.00' },
      ],
    });
    expect(f.saved).toHaveLength(2);
    expect(f.saved[0]).toMatchObject({
      accountId: accountDebit,
      debitAmount: '0.00',
      creditAmount: '100.00',
      netAmount: '-100.00',
      docNo: 'JV-20261113-0002',
      reversalOfDocNo: 'JV-20261113-0001',
      remarks: 'Reversal of JV-20261113-0001',
    });
    expect(f.saved[1]).toMatchObject({
      accountId: accountCredit,
      debitAmount: '100.00',
      creditAmount: '0.00',
      netAmount: '100.00',
    });
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('SET reversed_by_doc_no = $3'),
      [companyId, 'JV-20261113-0001', 'JV-20261113-0002', 'user-1'],
    );
  });

  it('updates running ledger balances with the opposite movement', async () => {
    const f = fixture([
      docRow(),
      docRow({
        historyId: '2',
        accountId: accountCredit,
        debitAmount: '0.00',
        creditAmount: '100.00',
      }),
    ]);
    await f.service.reverseBatch('1', 'user-1');
    const aggregate = f.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ledger.ledgers'),
    );
    expect(aggregate?.[1]).toEqual([
      companyId,
      accountDebit,
      null,
      '0.00',
      '100.00',
      1,
      'user-1',
    ]);
  });

  it('dates a reversal on the original date when the document is post-dated', async () => {
    const f = fixture([
      docRow({ docDate: '2026-12-01' }),
      docRow({
        historyId: '2',
        accountId: accountCredit,
        docDate: '2026-12-01',
        debitAmount: '0.00',
        creditAmount: '100.00',
      }),
    ]);
    await expect(f.service.reverseBatch('1', 'user-1')).resolves.toMatchObject({
      docDate: '2026-12-01',
      period: '202612',
      reversalDocNo: 'JV-20261201-0002',
    });
    expect(f.saved[0]).toMatchObject({
      docDate: '2026-12-01',
      period: '202612',
    });
  });

  it('rejects a document that was already reversed', async () => {
    const f = fixture([docRow({ reversedByDocNo: 'JV-20261113-0002' })]);
    await expect(f.service.reverseBatch('1', 'user-1')).rejects.toThrow(
      'has already been reversed by JV-20261113-0002',
    );
    expect(f.repo.save).not.toHaveBeenCalled();
  });

  it('rejects a reversal document', async () => {
    const f = fixture([docRow({ reversalOfDocNo: 'JV-20261113-0001' })]);
    await expect(f.service.reverseBatch('1', 'user-1')).rejects.toThrow(
      'is a reversal and cannot be reversed',
    );
  });

  it('rejects documents posted by another source', async () => {
    const f = fixture([docRow({ legacyRef: 'AUTO::payment:1::0' })]);
    await expect(f.service.reverseBatch('1', 'user-1')).rejects.toThrow(
      'Only documents posted from Ledger Capture can be reversed.',
    );
  });

  it('rejects an unbalanced document', async () => {
    const f = fixture([docRow()]);
    await expect(f.service.reverseBatch('1', 'user-1')).rejects.toThrow(
      'is not balanced',
    );
  });
});
