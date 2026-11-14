import { DataSource } from 'typeorm';
import { assertPostingDateOpen } from './posting-date';

const companyId = '00000000-0000-4000-8000-000000000001';

function managerReturning(rows: unknown[]) {
  const query = jest.fn(async () => rows);
  return { query } as unknown as DataSource;
}

describe('assertPostingDateOpen', () => {
  it('allows a date outside every accounting period', async () => {
    await expect(
      assertPostingDateOpen(managerReturning([]), companyId, '2026-11-14'),
    ).resolves.toBeUndefined();
  });

  it('allows an open period in an open fiscal year', async () => {
    await expect(
      assertPostingDateOpen(
        managerReturning([
          {
            periodName: 'Nov 2026',
            isOpen: true,
            isClosed: false,
            yearName: 'FY2026',
            fiscalYearClosed: false,
          },
        ]),
        companyId,
        '2026-11-14',
      ),
    ).resolves.toBeUndefined();
  });

  it('blocks a closed month', async () => {
    await expect(
      assertPostingDateOpen(
        managerReturning([
          {
            periodName: 'Oct 2026',
            isOpen: false,
            isClosed: true,
            yearName: 'FY2026',
            fiscalYearClosed: false,
          },
        ]),
        companyId,
        '2026-10-31',
        'Document date',
      ),
    ).rejects.toThrow('Document date 2026-10-31 falls in accounting period Oct 2026, which is closed.');
  });

  it('blocks a closed fiscal year', async () => {
    await expect(
      assertPostingDateOpen(
        managerReturning([
          {
            periodName: 'Nov 2026',
            isOpen: true,
            isClosed: false,
            yearName: 'FY2026',
            fiscalYearClosed: true,
          },
        ]),
        companyId,
        '2026-11-14',
      ),
    ).rejects.toThrow('falls in fiscal year FY2026, which is closed.');
  });

  it('blocks when any overlapping period is closed', async () => {
    await expect(
      assertPostingDateOpen(
        managerReturning([
          {
            periodName: 'Nov 2026',
            isOpen: true,
            isClosed: false,
            yearName: 'FY2026',
            fiscalYearClosed: false,
          },
          {
            periodName: 'Nov 2026 (alternate)',
            isOpen: false,
            isClosed: true,
            yearName: 'FY2026/2027',
            fiscalYearClosed: false,
          },
        ]),
        companyId,
        '2026-11-14',
      ),
    ).rejects.toThrow('Nov 2026 (alternate)');
  });
});
