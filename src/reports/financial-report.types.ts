export interface ReportColumn { key: string; label: string; numeric?: boolean }
export interface ReportRow {
  accountCode?: string; description: string; section?: string;
  isSection?: boolean; isTotal?: boolean;
  [key: string]: string | boolean | undefined;
}
export interface FinancialReport {
  logoData?: string | null; primaryColor?: string; secondaryColor?: string;
  kind: string; title: string; companyName: string; address: string; currency: string;
  asOf: string; monthStart: string; fiscalYearStart: string; branchName: string;
  generatedAt: string; columns: ReportColumn[]; rows: ReportRow[];
  totals: { label: string; values: Record<string, string> }[];
  warnings: string[]; balanced?: boolean;
}
export function cents(value: string): bigint {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^[+-]/, '').split('.');
  const amount = BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
  return negative ? -amount : amount;
}
export function amount(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const magnitude = value < 0n ? -value : value;
  return `${sign}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`;
}
export function groupCode(account: { accountCode: string; parentCode?: string | null }): string {
  return /^\d{6}-\d{5}$/.test(account.accountCode) ? account.accountCode.split('-')[0] : account.parentCode || account.accountCode;
}
