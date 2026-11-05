import { BadRequestException } from '@nestjs/common';
import { EntityManager, QueryFailedError } from 'typeorm';

export function formatMainAccountCode(prefix: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 9999)
    throw new BadRequestException(
      'The main account code range for this account type is exhausted.',
    );
  return String(Number(prefix) * 10000 + sequence);
}

export function formatBalanceSheetCode(
  prefix: string,
  sequence: number,
): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99)
    throw new BadRequestException(
      'The balance sheet code range for this account type is exhausted.',
    );
  return String(Number(prefix) * 100 + sequence);
}

export function formatChartAccountCode(
  mainCode: string,
  sequence: number,
): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99999)
    throw new BadRequestException(
      'The chart of account sequence for this main account is exhausted.',
    );
  return `${mainCode}-${String(sequence).padStart(5, '0')}`;
}

export async function nextMainAccountCode(
  manager: EntityManager,
  companyId: string,
  accountTypeId: string,
  prefix: string,
): Promise<string> {
  const [row] = await manager.query(
    `SELECT COALESCE(MAX(main_code::int), $1::int * 10000 - 1) AS last
     FROM accounting.main_accounts
     WHERE company_id = $2 AND account_type_id = $3 AND main_code ~ $4`,
    [Number(prefix), companyId, accountTypeId, `^${prefix}[0-9]{4}$`],
  );
  const sequence = Number(row.last) + 1 - Number(prefix) * 10000;
  return formatMainAccountCode(prefix, sequence);
}

export async function nextBalanceSheetCode(
  manager: EntityManager,
  companyId: string,
  accountTypeId: string,
  prefix: string,
): Promise<string> {
  const [row] = await manager.query(
    `SELECT COALESCE(MAX(code::int), $1::int * 100) AS last
     FROM accounting.balance_sheet_classifications
     WHERE company_id = $2 AND account_type_id = $3 AND code ~ $4`,
    [Number(prefix), companyId, accountTypeId, `^${prefix}[0-9]{2}$`],
  );
  return formatBalanceSheetCode(prefix, Number(row.last) + 1 - Number(prefix) * 100);
}

export async function nextChartAccountCode(
  manager: EntityManager,
  mainAccountId: string,
  mainCode: string,
): Promise<string> {
  const [row] = await manager.query(
    `SELECT COALESCE(MAX(split_part(account_code, '-', 2)::int), 0) AS last
     FROM accounting.accounts
     WHERE main_account_id = $1 AND account_code ~ '^[0-9]+-[0-9]{5}$'`,
    [mainAccountId],
  );
  return formatChartAccountCode(mainCode, Number(row.last) + 1);
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as { driverError?: { code?: string } }).driverError?.code === '23505'
  );
}

export function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as { driverError?: { code?: string } }).driverError?.code === '23503'
  );
}
