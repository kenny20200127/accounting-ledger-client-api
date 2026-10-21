import { nextInvoiceNumber } from './invoice-number';

interface StubFindOptions {
  where: { companyId: string; invoiceNumber: { value: string } };
}

function stubRepo(numbers: string[]) {
  const calls: StubFindOptions[] = [];
  const find = (options: StubFindOptions) => {
    calls.push(options);
    // Mirror the SQL behaviour: the Like pattern filters which rows are visible.
    const prefix = options.where.invoiceNumber.value.replace(/%$/, '');
    const matches = numbers
      .filter((invoiceNumber) => invoiceNumber.startsWith(prefix))
      .map((invoiceNumber) => ({ invoiceNumber }));
    return Promise.resolve(matches);
  };
  return { calls, find: find as unknown as never };
}

describe('nextInvoiceNumber', () => {
  const companyId = '00000000-0000-4000-8000-000000000001';

  it('starts at 0001 for a date with no invoices', async () => {
    const repo = stubRepo([]);
    await expect(
      nextInvoiceNumber(repo as never, companyId, '2026-10-19'),
    ).resolves.toBe('INV-20261019-0001');
    expect(repo.calls).toHaveLength(1);
  });

  it('continues after the highest sequence, ignoring gaps and other dates', async () => {
    const repo = stubRepo([
      'INV-20261019-0003',
      'INV-20261019-0010',
      'INV-20261019-0007',
      'INV-20261018-0099',
      'INV-20261020-0002',
    ]);
    await expect(
      nextInvoiceNumber(repo as never, companyId, '2026-10-19'),
    ).resolves.toBe('INV-20261019-0011');
  });

  it('ignores numbers with a non-numeric suffix after the prefix', async () => {
    const repo = stubRepo([
      'INV-20261019-0002',
      'INV-20261019-000A',
      'INV-20261019-custom',
    ]);
    await expect(
      nextInvoiceNumber(repo as never, companyId, '2026-10-19'),
    ).resolves.toBe('INV-20261019-0003');
  });

  it('scopes the lookup to the requesting company via the where clause', async () => {
    const repo = stubRepo([]);
    await nextInvoiceNumber(repo, companyId, '2026-10-19');
    const where = repo.calls[0].where;
    expect(where.companyId).toBe(companyId);
    expect(where.invoiceNumber.value).toBe('INV-20261019-%');
  });
});
