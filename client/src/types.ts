import type { ComponentType } from 'react';

export type MenuItem = {
  menuId: string;
  parentMenuId: string | null;
  menuCode: string;
  menuName: string;
  menuUrl: string | null;
  icon: string | null;
  displayOrder: number;
  isActive?: boolean;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
};

export type Company = {
  logoData?: string | null;
  primaryColor?: string; secondaryColor?: string; isActive?: boolean;
  companyId: string;
  companyName: string;
  companyCode?: string;
  baseCurrency?: string;
  email?: string;
};

export type Session = {
  accessToken: string;
  user: {
    isPlatformAdmin?: boolean; isCompanyAdmin?: boolean;
    userId: string;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    companyId?: string | null;
    roles?: { roleId: string; roleCode: string; roleName: string }[];
  };
  menus: MenuItem[];
};

export type PageKey =
  | 'dashboard'
  | 'companies'
  | 'users'
  | 'branches'
  | 'customers'
  | 'suppliers'
  | 'invoices'
  | 'accounts'
  | 'expenses'
  | 'banking'
  | 'payments'
  | 'fiscal-years'
  | 'accounting-periods'
  | 'journals'
  | 'fixed-assets'
  | 'ledger'
  | 'reports'
  | 'bank-reconciliation'
  | 'roles'
  | 'audit-logs';

export type SelectConfig = {
  /** API endpoint (relative to /api/v1/) to fetch options. Omit when using static options. */
  endpoint?: string;
  /** Field on each option used as the <option value>. Required when using endpoint. */
  valueField?: string;
  /** Primary field used for the option label. Required when using endpoint. */
  labelField?: string;
  /** Optional secondary field appended to the label after a separator. */
  secondaryLabelField?: string;
  /** Whether the endpoint requires ?companyId=. Defaults to true when endpoint is set. */
  needsCompany?: boolean;
  /** Name of another field whose selected value filters this dropdown. */
  dependsOn?: string;
  /** Query-param name used to pass the dependency value. */
  dependsOnParam?: string;
  /** Static option list (used instead of an endpoint). */
  options?: { value: string; label: string }[];
  /** Placeholder shown as the first (disabled) option. */
  placeholder?: string;
  /** Extra query params always sent to the endpoint. */
  params?: Record<string, string>;
};

export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  full?: boolean;
  step?: string;
  select?: SelectConfig;
  lineFields?: Field[];
};

export type Page = {
  title: string;
  description: string;
  endpoint?: string;
  menuCode?: string;
  columns?: string[];
  fields?: Field[];
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Row field holding the record id used to fetch /:id/pdf downloads. */
  pdfDownload?: { idField: string };
  /** Helper text shown at the top of the create dialog. */
  createNote?: string;
};

export const menuCodeToPageKey: Record<string, PageKey> = {
  DASHBOARD: 'dashboard',
  COMPANIES: 'companies',
  BRANCHES: 'branches',
  FISCAL_YEARS: 'fiscal-years',
  ACCOUNTING_PERIODS: 'accounting-periods',
  CHART_OF_ACCOUNTS: 'accounts',
  JOURNAL_ENTRIES: 'journals',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  BANKING: 'banking',
  BANK_RECONCILIATION: 'bank-reconciliation',
  FIXED_ASSETS: 'fixed-assets',
  EXPENSES: 'expenses',
  USERS: 'users',
  ROLES: 'roles',
  AUDIT_LOGS: 'audit-logs',
  REPORTS: 'reports',
  LEDGER: 'ledger',
};

export const pageKeyToMenuCode: Record<PageKey, string> = {
  dashboard: 'DASHBOARD',
  companies: 'COMPANIES',
  branches: 'BRANCHES',
  'fiscal-years': 'FISCAL_YEARS',
  'accounting-periods': 'ACCOUNTING_PERIODS',
  accounts: 'CHART_OF_ACCOUNTS',
  journals: 'JOURNAL_ENTRIES',
  customers: 'CUSTOMERS',
  suppliers: 'SUPPLIERS',
  invoices: 'INVOICES',
  payments: 'PAYMENTS',
  banking: 'BANKING',
  'bank-reconciliation': 'BANK_RECONCILIATION',
  'fixed-assets': 'FIXED_ASSETS',
  expenses: 'EXPENSES',
  users: 'USERS',
  roles: 'ROLES',
  'audit-logs': 'AUDIT_LOGS',
  reports: 'REPORTS',
  ledger: 'LEDGER',
};
