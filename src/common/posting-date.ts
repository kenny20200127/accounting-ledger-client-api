import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

type CoveringPeriod = {
  periodName: string;
  isOpen: boolean;
  isClosed: boolean;
  yearName: string;
  fiscalYearClosed: boolean;
};

// A date may fall in more than one period when fiscal years overlap, so a
// closed match anywhere blocks the posting.
export async function assertPostingDateOpen(
  manager: EntityManager | DataSource,
  companyId: string,
  date: string,
  label = 'Transaction date',
): Promise<void> {
  const rows: CoveringPeriod[] = await manager.query(
    `SELECT p.period_name AS "periodName", p.is_open AS "isOpen", p.is_closed AS "isClosed",
            f.year_name AS "yearName", f.is_closed AS "fiscalYearClosed"
     FROM accounting.accounting_periods p
     JOIN accounting.fiscal_years f ON f.fiscal_year_id = p.fiscal_year_id
     WHERE f.company_id = $1 AND $2::date BETWEEN p.start_date AND p.end_date
     ORDER BY p.start_date`,
    [companyId, date],
  );
  const closedYear = rows.find((row) => row.fiscalYearClosed);
  if (closedYear)
    throw new BadRequestException(
      `${label} ${date} falls in fiscal year ${closedYear.yearName}, which is closed.`,
    );
  const closedPeriod = rows.find((row) => !row.isOpen || row.isClosed);
  if (closedPeriod)
    throw new BadRequestException(
      `${label} ${date} falls in accounting period ${closedPeriod.periodName}, which is closed.`,
    );
}
