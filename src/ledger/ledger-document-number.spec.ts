import { nextLedgerDocumentNumber } from './ledger-document-number';

interface StubFindOptions {
  where: { companyId: string; docNo: { value: string } };
}

function stubRepo(numbers: string[]) {
  const calls: StubFindOptions[] = [];
  const find = (options: StubFindOptions) => {
    calls.push(options);
    // Mirror the SQL behaviour: the Like pattern filters which rows are visible.
    const prefix = options.where.docNo.value.replace(/%$/, '');
    const matches = numbers
      .filter((docNo) => docNo.startsWith(prefix))
      .map((docNo) => ({ docNo }));
    return Promise.resolve(matches);
  };
  return { calls, find: find as unknown as never };
}

describe('nextLedgerDocumentNumber', () => {
  const companyId = '00000000-0000-4000-8000-000000000001';

  it('starts at 0001 for a document type and date with no postings', async () => {
    await expect(
      nextLedgerDocumentNumber(stubRepo([]) as never, companyId, 'JV', '2026-10-19'),
    ).resolves.toBe('JV-20261019-0001');
  });

  it('continues after the highest sequence, ignoring gaps and other dates', async () => {
    await expect(
      nextLedgerDocumentNumber(
        stubRepo([
          'JV-20261019-0003',
          'JV-20261019-0010',
          'JV-20261019-0007',
          'JV-20261018-0099',
          'BV-20261019-0005',
        ]) as never,
        companyId,
        'JV',
        '2026-10-19',
      ),
    ).resolves.toBe('JV-20261019-0011');
  });

  it('ignores numbers with a non-numeric suffix after the prefix', async () => {
    await expect(
      nextLedgerDocumentNumber(
        stubRepo(['JV-20261019-0002', 'JV-20261019-000A', 'JV-20261019-manual']) as never,
        companyId,
        'JV',
        '2026-10-19',
      ),
    ).resolves.toBe('JV-20261019-0003');
  });

  it('scopes the lookup to the requesting company via the where clause', async () => {
    const repo = stubRepo([]);
    await nextLedgerDocumentNumber(repo, companyId, 'JV', '2026-10-19');
    const where = repo.calls[0].where;
    expect(where.companyId).toBe(companyId);
    expect(where.docNo.value).toBe('JV-20261019-%');
  });
});
