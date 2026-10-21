import { useCallback, useEffect, useRef, useState } from 'react';

import type { FormEvent } from 'react';

import {

  Activity,

  ArrowUpRight,

  Building2,

  CalendarDays,

  ChevronDown,

  CreditCard,

  Download,

  FileChartColumnIncreasing,

  FileText,

  Gauge,

  Landmark,

  Layers,

  Menu,

  Plus,

  Search,

  Trash2,

  Settings2,

  ShieldCheck,

  Truck,

  Users,

  WalletCards,

  X,

} from 'lucide-react';

import './App.css';
import { companyTheme, brandingUpdateKey, brandingUpdateEvent } from './company-theme';

import { FinancialReportsView } from './components/FinancialReportsView';
import { LedgerCaptureView } from './components/LedgerCaptureView';

import { SlideMenu } from './components/SlideMenu';

import { Dashboard } from './components/Dashboard';

import { CompanyAdministration, UserAdministration, RoleAdministration, AdministrationAudit } from './components/AdministrationViews';
import { BankReconciliationView } from './components/ExtraViews';

import { menuCodeToPageKey } from './types';
import type { Company, Field, MenuItem, Page, PageKey, Session } from './types';



const tokenKey = 'ledger.company.accessToken';

const userKey = 'ledger.company.user';

const menusKey = 'ledger.company.menus';

const collapsedKey = 'ledger.company.sidebar_collapsed';

const paginatedEndpoints = new Set(['accounts', 'journals', 'customers', 'suppliers', 'invoices']);

type ListPage = { items: Record<string, unknown>[]; total: number; page: number; limit: number; totalPages: number };



const pages: Record<PageKey, Page> = {

  dashboard: {

    title: 'Overview',

    description: 'A clear view of today’s ledger activity and financial health.',

    icon: Gauge,

    menuCode: 'DASHBOARD',

  },

  companies: {

    title: 'Companies',

    description: 'Registered legal entities and base currencies.',

    endpoint: 'companies',

    menuCode: 'COMPANIES',

    icon: Building2,

    columns: [

      'companyCode',

      'companyName',

      'email',

      'baseCurrency',

      'isActive',

    ],

    fields: [

      { name: 'companyCode', label: 'Company code', required: true },

      { name: 'companyName', label: 'Company name', required: true },

      { name: 'email', label: 'Email', type: 'email' },

      { name: 'phone', label: 'Phone' },

      { name: 'baseCurrency', label: 'Base currency', required: true },

    ],

  },

  users: {

    title: 'Users',

    description: 'Manage workspace access and role assignments.',

    endpoint: 'users',

    menuCode: 'USERS',

    icon: Users,

    columns: ['username', 'email', 'firstName', 'lastName', 'roles', 'isActive'],

    fields: [

      { name: 'username', label: 'Username', required: true },

      { name: 'email', label: 'Email', type: 'email', required: true },

      { name: 'password', label: 'Temporary password', type: 'password', required: true },

      { name: 'firstName', label: 'First name' },

      { name: 'lastName', label: 'Last name' },

      { name: 'branchId', label: 'Branch ID' },

      { name: 'roleIds', label: 'Assign roles', type: 'multiselect', required: true, full: true },

    ],

  },

  branches: {

    title: 'Branches',

    description: 'Locations operating under each company entity.',

    endpoint: 'branches',

    menuCode: 'BRANCHES',

    icon: Building2,

    columns: [

      'branchCode',

      'branchName',

      'city',

      'phone',

      'isHeadOffice',

      'isActive',

    ],

    fields: [

      { name: 'branchCode', label: 'Branch code', required: true },

      { name: 'branchName', label: 'Branch name', required: true },

      { name: 'city', label: 'City' },

      { name: 'state', label: 'State' },

      { name: 'phone', label: 'Phone' },

      { name: 'email', label: 'Email', type: 'email' },

      { name: 'isHeadOffice', label: 'Head office', type: 'checkbox' },

    ],

  },

  customers: {

    title: 'Customers',

    description: 'Customer directory and receivables setup.',

    endpoint: 'customers',

    menuCode: 'CUSTOMERS',

    icon: Users,

    columns: [

      'customerCode',

      'customerName',

      'email',

      'phone',

      'creditLimit',

      'isActive',

    ],

    fields: [

      { name: 'customerCode', label: 'Customer code', required: true },

      { name: 'customerName', label: 'Customer name', required: true },

      { name: 'email', label: 'Email', type: 'email' },

      { name: 'phone', label: 'Phone' },

      { name: 'taxNumber', label: 'Tax number' },

      { name: 'creditLimit', label: 'Credit limit', type: 'number' },

      { name: 'billingAddress', label: 'Billing address', full: true },

    ],

  },

  suppliers: {

    title: 'Suppliers',

    description: 'Supplier directory and payable account setup.',

    endpoint: 'suppliers',

    menuCode: 'SUPPLIERS',

    icon: Truck,

    columns: ['supplierCode', 'supplierName', 'email', 'phone', 'isActive'],

    fields: [

      { name: 'supplierCode', label: 'Supplier code', required: true },

      { name: 'supplierName', label: 'Supplier name', required: true },

      { name: 'email', label: 'Email', type: 'email' },

      { name: 'phone', label: 'Phone' },

      { name: 'taxNumber', label: 'Tax number' },

      { name: 'payableAccountId', label: 'Payable account', type: 'select', select: { endpoint: 'accounts', valueField: 'accountId', labelField: 'accountName', secondaryLabelField: 'accountCode', placeholder: 'Select payable account' } },

      { name: 'address', label: 'Address', full: true },

    ],

  },

  invoices: {

    title: 'Invoices',

    description: 'Sales invoices, line totals, and outstanding balances.',

    endpoint: 'invoices',

    menuCode: 'INVOICES',

    pdfDownload: { idField: 'invoiceId' },

    createNote: 'The invoice number is generated automatically when the invoice is saved.',

    icon: FileText,

    columns: [

      'invoiceNumber',

      'invoiceDate',

      'dueDate',

      'subtotal',

      'taxAmount',

      'totalAmount',

      'amountPaid',

      'balanceDue',

      'status',

    ],

    fields: [

      { name: 'customerId', label: 'Customer', type: 'select', required: true, select: { endpoint: 'customers', valueField: 'customerId', labelField: 'customerName', secondaryLabelField: 'customerCode', placeholder: 'Select customer' } },

      { name: 'invoiceDate', label: 'Invoice date', type: 'date', required: true },

      { name: 'dueDate', label: 'Due date', type: 'date' },

      { name: 'branchId', label: 'Branch', type: 'select', select: { endpoint: 'branches', valueField: 'branchId', labelField: 'branchName', secondaryLabelField: 'branchCode', placeholder: 'Select branch' } },

      {
        name: 'lines',
        label: 'Line items',
        type: 'lines',
        full: true,
        required: true,
        lineFields: [
          { name: 'description', label: 'Description', required: true, full: true },
          { name: 'quantity', label: 'Quantity', type: 'number', required: true, step: '0.0001' },
          { name: 'unitPrice', label: 'Unit price', type: 'number', required: true },
          { name: 'discountAmount', label: 'Discount', type: 'number' },
          { name: 'taxAmount', label: 'Tax', type: 'number' },
          { name: 'revenueAccountId', label: 'Revenue account', type: 'select', required: true, select: { endpoint: 'accounts', valueField: 'accountId', labelField: 'accountName', secondaryLabelField: 'accountCode', params: { type: 'REVENUE', postable: 'true' }, placeholder: 'Select revenue account' } },
        ],
      },

    ],

  },

  accounts: {

    title: 'Chart of accounts',

    description: 'Company ledger accounts and posting controls.',

    endpoint: 'accounts',

    menuCode: 'CHART_OF_ACCOUNTS',

    icon: FileChartColumnIncreasing,

    columns: [

      'accountCode',

      'accountName',

      'accountTypeId',

      'isHeader',

      'allowPosting',

      'isActive',

    ],

    fields: [

      { name: 'accountTypeId', label: 'Account type', type: 'select', required: true, select: { endpoint: 'account-types', valueField: 'accountTypeId', labelField: 'name', secondaryLabelField: 'code', needsCompany: false, placeholder: 'Select account type' } },

      { name: 'accountCategoryId', label: 'Account category', type: 'select', select: { endpoint: 'account-categories', valueField: 'accountCategoryId', labelField: 'name', secondaryLabelField: 'code', needsCompany: false, dependsOn: 'accountTypeId', dependsOnParam: 'accountTypeId', placeholder: 'Select account type first' } },

      { name: 'accountCode', label: 'Account code', required: true },

      { name: 'accountName', label: 'Account name', required: true },

      { name: 'description', label: 'Description', full: true },

      { name: 'isHeader', label: 'Header account', type: 'checkbox' },

      { name: 'allowPosting', label: 'Allow posting', type: 'checkbox' },

    ],

  },

  expenses: {

    title: 'Expenses',

    description: 'Operational spending recorded against the ledger.',

    endpoint: 'expenses',

    menuCode: 'EXPENSES',

    icon: WalletCards,

    columns: [

      'expenseNumber',

      'expenseDate',

      'description',

      'amount',

      'taxAmount',

      'totalAmount',

      'status',

    ],

    fields: [

      {
        name: 'expenseDate',

        label: 'Expense date',

        type: 'date',

        required: true,

      },

      { name: 'expenseAccountId', label: 'Expense account', type: 'select', required: true, select: { endpoint: 'accounts', valueField: 'accountId', labelField: 'accountName', secondaryLabelField: 'accountCode', placeholder: 'Select expense account' } },

      { name: 'amount', label: 'Amount', type: 'number', required: true },

      { name: 'taxAmount', label: 'Tax amount', type: 'number' },

      { name: 'branchId', label: 'Branch', type: 'select', select: { endpoint: 'branches', valueField: 'branchId', labelField: 'branchName', secondaryLabelField: 'branchCode', placeholder: 'Select branch' } },

      { name: 'paymentAccountId', label: 'Payment account', type: 'select', required: true, select: { endpoint: 'accounts', valueField: 'accountId', labelField: 'accountName', secondaryLabelField: 'accountCode', placeholder: 'Select payment account' } },

      { name: 'description', label: 'Description', full: true },

    ],

  },

  banking: {

    title: 'Bank accounts',

    description: 'Cash accounts and their current balances.',

    endpoint: 'banking/accounts',

    menuCode: 'BANKING',

    icon: Landmark,

    columns: [

      'bankName',

      'accountName',

      'accountNumber',

      'currency',

      'openingBalance',

      'currentBalance',

      'isActive',

    ],

    fields: [

      { name: 'accountId', label: 'Ledger account', type: 'select', required: true, select: { endpoint: 'accounts', valueField: 'accountId', labelField: 'accountName', secondaryLabelField: 'accountCode', placeholder: 'Select ledger account' } },

      { name: 'bankName', label: 'Bank name', required: true },

      { name: 'accountName', label: 'Account name', required: true },

      { name: 'accountNumber', label: 'Account number' },

      { name: 'currency', label: 'Currency', required: true },

      { name: 'openingBalance', label: 'Opening balance', type: 'number' },

    ],

  },

  payments: {

    title: 'Customer payments',

    description: 'Receipts applied to customer invoices.',

    endpoint: 'customer-payments',

    menuCode: 'PAYMENTS',

    icon: CreditCard,

    createNote: 'The payment number is generated automatically when the payment is saved.',

    columns: [

      'paymentNumber',

      'paymentDate',

      'customerId',

      'invoiceId',

      'amount',

      'paymentMethod',

      'referenceNumber',

    ],

    fields: [

      { name: 'customerId', label: 'Customer', type: 'select', required: true, select: { endpoint: 'customers', valueField: 'customerId', labelField: 'customerName', secondaryLabelField: 'customerCode', placeholder: 'Select customer' } },

      { name: 'invoiceId', label: 'Invoice', type: 'select', select: { endpoint: 'invoices', valueField: 'invoiceId', labelField: 'invoiceNumber', placeholder: 'Select invoice (optional)' } },

      {

        name: 'paymentDate',

        label: 'Payment date',

        type: 'date',

        required: true,

      },

      { name: 'amount', label: 'Amount', type: 'number', required: true },

      { name: 'paymentMethod', label: 'Payment method', type: 'select', required: true, select: { options: [{ value: 'CASH', label: 'Cash' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'CHEQUE', label: 'Cheque' }, { value: 'CARD', label: 'Card' }, { value: 'MOBILE_MONEY', label: 'Mobile money' }, { value: 'ONLINE', label: 'Online' }], placeholder: 'Select payment method' } },

      { name: 'bankAccountId', label: 'Bank account', type: 'select', select: { endpoint: 'banking/accounts', valueField: 'bankAccountId', labelField: 'bankName', secondaryLabelField: 'accountName', placeholder: 'Select bank account' } },

      { name: 'referenceNumber', label: 'Reference number' },

    ],

  },

  'fiscal-years': {

    title: 'Fiscal years',

    description: 'Company financial year boundaries.',

    endpoint: 'fiscal-years',

    menuCode: 'FISCAL_YEARS',

    icon: CalendarDays,

    columns: ['yearName', 'startDate', 'endDate', 'isClosed'],

    fields: [

      { name: 'yearName', label: 'Year name', required: true },

      { name: 'startDate', label: 'Start date', type: 'date', required: true },

      { name: 'endDate', label: 'End date', type: 'date', required: true },

    ],

  },

  'accounting-periods': {

    title: 'Accounting periods',

    description: 'Open, closed, and upcoming posting periods.',

    endpoint: 'accounting-periods',

    menuCode: 'ACCOUNTING_PERIODS',

    icon: CalendarDays,

    columns: [

      'periodName',

      'periodNumber',

      'startDate',

      'endDate',

      'isOpen',

      'isClosed',

    ],

    fields: [

      { name: 'fiscalYearId', label: 'Fiscal year', type: 'select', required: true, select: { endpoint: 'fiscal-years', valueField: 'fiscalYearId', labelField: 'yearName', placeholder: 'Select fiscal year' } },

      { name: 'periodName', label: 'Period name', required: true },

      {

        name: 'periodNumber',

        label: 'Period number',

        type: 'number',

        required: true,

      },

      { name: 'startDate', label: 'Start date', type: 'date', required: true },

      { name: 'endDate', label: 'End date', type: 'date', required: true },

    ],

  },

  journals: {

    title: 'Journal entries',

    description: 'Balanced debits and credits posted to the general ledger.',

    endpoint: 'journals',

    menuCode: 'JOURNAL_ENTRIES',

    icon: FileText,

    columns: [

      'journalNumber',

      'transactionDate',

      'referenceNumber',

      'description',

      'totalDebit',

      'totalCredit',

      'status',

    ],

  },

  'fixed-assets': {

    title: 'Fixed assets',

    description: 'Capital assets and depreciation schedules.',

    endpoint: 'fixed-assets',

    menuCode: 'FIXED_ASSETS',

    icon: Building2,

    columns: [

      'assetCode',

      'assetName',

      'purchaseDate',

      'purchaseCost',

      'accumulatedDepreciation',

      'status',

    ],

  },

  reports: {

    title: 'Reports',

    description: 'Trial balance, profit and loss, and detailed account balances.',

    endpoint: 'reports/trial-balance',

    menuCode: 'REPORTS',

    icon: FileChartColumnIncreasing,

    columns: [

      'accountCode',

      'accountName',

      'accountType',

      'totalDebit',

      'totalCredit',

      'balance',

    ],

  },

  ledger: {

    title: 'Ledger capture',

    description: 'Post debit and credit lines to ledger accounts and review recent postings.',

    menuCode: 'LEDGER',

    icon: Layers,

  },

  'bank-reconciliation': {

    title: 'Bank reconciliation',

    description: 'Reconcile bank statements against recorded cash transactions.',

    menuCode: 'BANK_RECONCILIATION',

    icon: Landmark,

  },

  roles: {

    title: 'Roles & access',

    description: 'User access levels and menu permission matrices.',

    menuCode: 'ROLES',

    icon: ShieldCheck,

  },

  'audit-logs': {

    title: 'Audit logs',

    description: 'Immutable trail of user logins and financial actions.',

    menuCode: 'AUDIT_LOGS',

    icon: FileText,

  },

};



async function api<T>(

  path: string,

  token?: string,

  options: RequestInit = {},

): Promise<T> {

  const response = await fetch(`/api/v1/${path.replace(/^\//, '')}`, {

    ...options,

    headers: {

      ...(options.body ? { 'Content-Type': 'application/json' } : {}),

      ...(token ? { Authorization: `Bearer ${token}` } : {}),

      ...options.headers,

    },

  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {

    const message = Array.isArray(body?.message)

      ? body.message.join(', ')

      : body?.message;

    throw new Error(message || `Request failed (${response.status})`);

  }

  return body as T;

}



function App() {

  const [session, setSession] = useState<Session | null>(() => {

    const accessToken = localStorage.getItem(tokenKey);

    const raw = localStorage.getItem(userKey);

    const cachedMenus = localStorage.getItem(menusKey);

    return accessToken && raw

      ? {

        accessToken,

        user: JSON.parse(raw),

        menus: cachedMenus ? JSON.parse(cachedMenus) : [],

      }

      : null;

  });



  // Database-fetched menus

  const [dbMenus, setDbMenus] = useState<MenuItem[]>(() => {

    const cached = localStorage.getItem(menusKey);

    return cached ? JSON.parse(cached) : [];

  });



  // Slide menu states: mobile drawer vs desktop collapse

  const [slideMenuOpen, setSlideMenuOpen] = useState(false);

  const [slideMenuCollapsed, setSlideMenuCollapsed] = useState<boolean>(() => {

    return localStorage.getItem(collapsedKey) === 'true';

  });



  const [active, setActive] = useState<PageKey>('dashboard');

  const [companies, setCompanies] = useState<Company[]>([]);

  const [companyId, setCompanyId] = useState('');

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [search, setSearch] = useState('');

  const [dialog, setDialog] = useState(false);

  const [busy, setBusy] = useState(false);

  const [pdfBusyId, setPdfBusyId] = useState('');

  const [refresh, setRefresh] = useState(0);

  const [listPagination, setListPagination] = useState({ scope: '', number: 1 });

  const [pageSize, setPageSize] = useState(25);

  const [listTotal, setListTotal] = useState(0);

  const [listTotalPages, setListTotalPages] = useState(0);



  const page = pages[active];

  const isPaginated = paginatedEndpoints.has(page.endpoint ?? '');

  const listSearch = isPaginated ? search : '';

  const listScope = JSON.stringify([active, companyId, listSearch, pageSize]);

  const listPageNumber = listPagination.scope === listScope ? listPagination.number : 1;

  const company = companies.find((item) => item.companyId === companyId);

  useEffect(() => {
    setListPagination({ scope: listScope, number: 1 });
  }, [listScope]);



  // Fetch menus directly from the database!

  const fetchMenusFromDb = useCallback(async (token?: string) => {

    try {

      let data: MenuItem[] = [];

      if (token) {

        try {

          data = await api<MenuItem[]>('auth/menus', token);

        } catch {

          data = [];
          setDbMenus([]);

        }

      } else {

        data = await api<MenuItem[]>('auth/menus/public');

      }



      if (Array.isArray(data)) {

        setDbMenus(data);
        if (token) setActive(current => data.some(menu => menuCodeToPageKey[menu.menuCode] === current) ? current : menuCodeToPageKey[data[0]?.menuCode] ?? 'dashboard');

        localStorage.setItem(menusKey, JSON.stringify(data));

        setSession((prev) => (prev ? { ...prev, menus: data } : null));

      }

    } catch (err) {

      console.warn('Unable to load menus from DB:', err);

    }

  }, []);



  // Initial menu fetch from DB on load or session change

  useEffect(() => {

    fetchMenusFromDb(session?.accessToken);

  }, [fetchMenusFromDb, session?.accessToken]);



  const [companyRefresh, setCompanyRefresh] = useState(0);
  useEffect(() => {
    if (!session?.accessToken) return;
    const token = session.accessToken;
    api<Session['user']>('auth/me', token).then(user => {
      if (user.isPlatformAdmin) throw new Error('Use the platform application to sign in.');
      localStorage.setItem(userKey, JSON.stringify(user));
      setSession(prev => prev?.accessToken === token ? { ...prev, user } : prev);
    }).catch(() => { localStorage.removeItem(tokenKey); localStorage.removeItem(userKey); localStorage.removeItem(menusKey); setSession(null); setDbMenus([]); });
  }, [session?.accessToken]);

  // Refresh branding after saves in either app and when this workspace regains focus.
  useEffect(() => {
    if (!session?.accessToken) return;
    const token = session.accessToken, preferredCompanyId = session.user.companyId;
    let live = true;
    let latest = 0;
    const loadCompanies = async () => {
      const request = ++latest;
      try {
        const list = await api<Company[]>('companies', token);
        if (!live || request !== latest) return;
        setCompanies(list);
        setCompanyId(current => list.some(c => c.companyId === current) ? current : list.some(c => c.companyId === preferredCompanyId) ? preferredCompanyId! : list[0]?.companyId ?? '');
      } catch (reason) { if (live && request === latest) setError((reason as Error).message); }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') void loadCompanies(); };
    const onStorage = (event: StorageEvent) => { if (event.key === brandingUpdateKey) void loadCompanies(); };
    void loadCompanies();
    window.addEventListener('focus', loadCompanies);
    window.addEventListener(brandingUpdateEvent, loadCompanies);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { live = false; window.removeEventListener('focus', loadCompanies); window.removeEventListener(brandingUpdateEvent, loadCompanies); window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVisibility); };
  }, [session?.accessToken, companyRefresh]);

  // Fetch only the requested page; cancel stale requests during navigation or search.

  useEffect(() => {

    if (!session || ['dashboard', 'companies', 'users', 'roles', 'bank-reconciliation', 'audit-logs', 'reports'].includes(active) || !page.endpoint) return;

    const controller = new AbortController();

    setLoading(true);

    setError('');

    setRows([]);

    setListTotal(0);

    setListTotalPages(0);

    if (page.endpoint !== 'companies' && !companyId) {

      setLoading(false);

      return () => controller.abort();

    }

    const params = new URLSearchParams();

    if (page.endpoint !== 'companies') params.set('companyId', companyId);

    if (page.endpoint === 'reports/trial-balance') params.set('asOf', new Date().toISOString().slice(0, 10));

    if (isPaginated) {

      params.set('page', String(listPageNumber));

      params.set('limit', String(pageSize));

      if (listSearch.trim()) params.set('q', listSearch.trim());

    }

    const endpoint = page.endpoint + (params.size ? `?${params.toString()}` : '');

    const timer = window.setTimeout(() => {

      api<Record<string, unknown>[] | ListPage>(endpoint, session.accessToken, { signal: controller.signal })

        .then(data => {

          if (controller.signal.aborted) return;

          if (Array.isArray(data)) { setRows(data); return; }

          if (isPaginated && data.totalPages > 0 && listPageNumber > data.totalPages) {

            setListPagination({ scope: listScope, number: data.totalPages });

            return;

          }

          setRows(data.items);

          setListTotal(data.total);

          setListTotalPages(data.totalPages);

        })

        .catch(reason => {

          if (!controller.signal.aborted) setError(reason.message);

        })

        .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    }, isPaginated && listSearch ? 250 : 0);

    return () => { controller.abort(); window.clearTimeout(timer); };

  }, [session, active, companyId, refresh, page.endpoint, isPaginated, listPageNumber, pageSize, listSearch, listScope]);



  function toggleCollapse() {

    setSlideMenuCollapsed((prev) => {

      const next = !prev;

      localStorage.setItem(collapsedKey, String(next));

      return next;

    });

  }



  async function login(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setBusy(true);

    setError('');

    const data = new FormData(event.currentTarget);

    try {

      const result = await api<Session>('auth/company/login', undefined, {

        method: 'POST',

        body: JSON.stringify({

          identifier: data.get('identifier'),

          password: data.get('password'),

        }),

      });

      localStorage.setItem(tokenKey, result.accessToken);

      localStorage.setItem(userKey, JSON.stringify(result.user));

      localStorage.setItem(menusKey, JSON.stringify(result.menus || []));

      setSession(result);

      setDbMenus(result.menus ?? []);
      setActive(menuCodeToPageKey[result.menus?.[0]?.menuCode] ?? 'dashboard');

    } catch (reason) {

      setError(reason instanceof Error ? reason.message : 'Sign-in failed');

    } finally {

      setBusy(false);

    }

  }



  function logout() {

    localStorage.removeItem(tokenKey);

    localStorage.removeItem(userKey);

    localStorage.removeItem(menusKey);

    setSession(null);

    setRows([]);

    setCompanies([]);
    setCompanyId('');
    setDbMenus([]);

  }



  async function createRecord(payload: Record<string, unknown>) {

    if (!session || !page.endpoint) return;

    setError('');

    try {

      await api(page.endpoint, session.accessToken, {

        method: 'POST',

        body: JSON.stringify({

          ...payload,

          ...(active === 'companies' ? {} : { companyId }),

        }),

      });

      setDialog(false);

      setRefresh((value) => value + 1);

    } catch (reason) {

      setError(

        reason instanceof Error ? reason.message : 'Unable to save record',

      );

    }

  }



  async function downloadRowPdf(row: Record<string, unknown>) {

    if (!session || !page.endpoint || !page.pdfDownload) return;

    const id = row[page.pdfDownload.idField];

    if (typeof id !== 'string') return;

    setPdfBusyId(id);

    setError('');

    try {

      const response = await fetch(`/api/v1/${page.endpoint}/${id}/pdf`, {

        headers: { Authorization: `Bearer ${session.accessToken}` },

      });

      if (!response.ok) {

        const body = await response.json().catch(() => null);

        const message = Array.isArray(body?.message)

          ? body.message.join(', ')

          : body?.message;

        throw new Error(message || `Download failed (${response.status})`);

      }

      const blob = await response.blob();

      const disposition = response.headers.get('Content-Disposition') ?? '';

      const filename =

        /filename="([^"]+)"/.exec(disposition)?.[1] ??

        `${String(row.invoiceNumber ?? 'invoice')}.pdf`;

      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');

      anchor.href = url;

      anchor.download = filename;

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      URL.revokeObjectURL(url);

    } catch (reason) {

      setError(reason instanceof Error ? reason.message : 'Unable to download invoice');

    } finally {

      setPdfBusyId('');

    }

  }



  if (!session) return <Login onSubmit={login} busy={busy} error={error} />;



  const visibleRows = isPaginated ? rows : rows.filter((row) =>

    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),

  );



  return (

    <div style={companyTheme(company)} className={`app-frame ${slideMenuCollapsed ? 'slide-collapsed' : ''}`}>

      {/* Slide Menu Drawer & Collapsible Navigation */}

      <SlideMenu

        company={company}
        menus={dbMenus}

        activePage={active}

        onNavigate={(key) => {

          setActive(key);

          setSearch('');

          setError('');

        }}

        collapsed={slideMenuCollapsed}

        onToggleCollapse={toggleCollapse}

        mobileOpen={slideMenuOpen}

        onCloseMobile={() => setSlideMenuOpen(false)}

        user={session.user}

        onLogout={logout}

      />



      {/* Main Content Area */}

      <main className="main">

        {/* Top Header Bar */}

        <header className="topbar">

          <div className="topbar-left">

            {/* Hamburger Slide Menu Toggle Button */}

            <button

              className="slide-toggle-btn"

              onClick={() => setSlideMenuOpen(true)}

              aria-label="Toggle Slide Menu"

              title="Open Navigation Menu"

            >

              <Menu size={18} />

            </button>



            <div className="breadcrumb">

              Workspace <i>/</i> <b>{page.title}</b>

            </div>

          </div>



          <div className="top-tools">

            {/* Company Selector Dropdown */}

            <label className="company-select">

              <Building2 size={15} />

              <select

                disabled={!session.user.isPlatformAdmin}
                value={companyId}

                onChange={(event) => setCompanyId(event.target.value)}

                aria-label="Company"

              >

                <option value="">Choose company</option>

                {companies.map((item) => (

                  <option key={item.companyId} value={item.companyId}>

                    {item.companyName}

                  </option>

                ))}

              </select>

              <ChevronDown size={13} />

            </label>



            {/* Notifications */}

            {/* <button

              className="slide-toggle-btn"

            //   aria-label="Notifications"

              title="System notifications"

            >

              <Bell size={16} />

            </button> */}



            {/* User Avatar */}

            <span className="user-avatar-circle">

              {(

                session.user.firstName?.[0] ?? session.user.username[0]

              ).toUpperCase()}

            </span>

          </div>

        </header>



        {/* Content Body */}

        <div className="content">

          {active === 'dashboard' ? (

            <Dashboard

              companies={companies}

              companyId={companyId}

              token={session.accessToken}

              onNavigate={setActive}

              onOpenCreate={(key) => {

                setActive(key);

                setDialog(true);

              }}

            />

          ) : active === 'companies' ? (
            <CompanyAdministration key={companyId} token={session.accessToken} companyId={companyId} platform={false} onChanged={() => setCompanyRefresh(n => n + 1)} onSelect={setCompanyId} />
          ) : active === 'users' ? (
            <UserAdministration key={companyId} token={session.accessToken} companyId={companyId} />
          ) : active === 'roles' ? (

            <RoleAdministration token={session.accessToken} companyId={companyId} />

          ) : active === 'bank-reconciliation' ? (

            <BankReconciliationView

              token={session.accessToken}

              companyId={companyId}

            />

          ) : active === 'audit-logs' ? (

            <AdministrationAudit token={session.accessToken} companyId={companyId} />

          ) : active === 'reports' ? (
            <FinancialReportsView key={companyId} token={session.accessToken} companyId={companyId} />
          ) : active === 'ledger' ? (
            <LedgerCaptureView key={companyId} token={session.accessToken} companyId={companyId} />
          ) : (

            <>

              {/* Heading for Standard Record Pages */}

              <div className="page-heading">

                <div>

                  <small className="eyebrow">

                    {company?.companyName ?? 'ACCOUNTING OPERATIONS'}

                  </small>

                  <h1>{page.title}</h1>

                  <p>{page.description}</p>

                </div>

                <div className="heading-actions">

                  <button

                    className="btn btn-light"

                    onClick={() => setRefresh((value) => value + 1)}

                  >

                    <Activity size={15} />

                    Refresh

                  </button>

                  {page.fields && (

                    <button

                      className="btn btn-primary"

                      onClick={() => setDialog(true)}

                    >

                      <Plus size={16} />

                      New {singular(page.title)}

                    </button>

                  )}

                </div>

              </div>



              {error && (

                <div className="error-banner">

                  <span>{error}</span>

                  <button onClick={() => setError('')} aria-label="Dismiss">

                    <X size={15} />

                  </button>

                </div>

              )}



              {/* Data Table Panel */}

              <section className="table-panel">

                <div className="table-toolbar">

                  <div className="count">

                    <b>{loading ? '…' : visibleRows.length}</b> records

                  </div>

                  <label className="search">

                    <Search size={15} />

                    <input

                      value={search}

                      maxLength={isPaginated ? 100 : undefined}

                      onChange={(event) => setSearch(event.target.value)}

                      placeholder={`Search ${page.title.toLowerCase()}`}

                    />

                  </label>

                  <button className="slide-toggle-btn" title="Filters">

                    <Settings2 size={16} />

                  </button>

                </div>



                <div className="table-scroll">

                  <table>

                    <thead>

                      <tr>

                        {(page.columns ?? []).map((column) => (

                          <th key={column}>{humanize(column)}</th>

                        ))}

                        <th>Details</th>

                      </tr>

                    </thead>

                    <tbody>

                      {loading ? (

                        <tr>

                          <td

                            className="empty"

                            colSpan={(page.columns?.length ?? 0) + 1}

                          >

                            Loading records…

                          </td>

                        </tr>

                      ) : visibleRows.length ? (

                        visibleRows.map((row, index) => (

                          <tr

                            key={String(

                              row.companyId ??

                              row.userId ??

                              row.customerId ??

                              row.invoiceId ??

                              row.expenseId ??

                              row.accountId ??

                              row.bankAccountId ??

                              row.fiscalYearId ??

                              row.periodId ??

                              row.journalEntryId ??

                              row.supplierId ??

                              index,

                            )}

                          >

                            {page.columns?.map((column) => (

                              <td key={column}>

                                {renderCell(column, row[column])}

                              </td>

                            ))}

                            <td>

                              <div className="row-actions">

                                <button className="row-open" title="Open record">

                                  <ArrowUpRight size={14} />

                                </button>

                                {page.pdfDownload && typeof row[page.pdfDownload.idField] === 'string' ? (

                                  <button

                                    className="row-open"

                                    title="Download PDF"

                                    disabled={pdfBusyId === row[page.pdfDownload.idField]}

                                    onClick={() => void downloadRowPdf(row)}

                                  >

                                    <Download size={14} />

                                  </button>

                                ) : null}

                              </div>

                            </td>

                          </tr>

                        ))

                      ) : (

                        <tr>

                          <td

                            className="empty"

                            colSpan={(page.columns?.length ?? 0) + 1}

                          >

                            <Search size={19} />

                            <b>

                              {error

                                ? 'Could not load records'

                                : 'Nothing here yet'}

                            </b>

                            <span>

                              {error

                                ? 'Check permissions and API availability.'

                                : 'Records for this company will appear here.'}

                            </span>

                          </td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>



                <div className="table-footer">

                  <span aria-live="polite">

                    {loading ? 'Loading records…' : isPaginated

                      ? `Showing ${rows.length ? (listPageNumber - 1) * pageSize + 1 : 0}–${rows.length ? (listPageNumber - 1) * pageSize + rows.length : 0} of ${listTotal}`

                      : `Showing ${visibleRows.length ? 1 : 0}–${visibleRows.length} of ${visibleRows.length}`}

                  </span>

                  {isPaginated ? <div className="pagination-controls">

                    <label>Rows per page{' '}

                      <select aria-label="Rows per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>

                        {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}

                      </select>

                    </label>

                    <button className="btn btn-light" disabled={loading || listPageNumber <= 1} onClick={() => setListPagination({ scope: listScope, number: listPageNumber - 1 })}>Previous</button>

                    <span>Page {listPageNumber} of {Math.max(1, listTotalPages)}</span>

                    <button className="btn btn-light" disabled={loading || listPageNumber >= listTotalPages} onClick={() => setListPagination({ scope: listScope, number: listPageNumber + 1 })}>Next</button>

                  </div> : <span>All matching records</span>}

                </div>

              </section>

            </>

          )}

        </div>

      </main>



      {/* Modal Dialog for Record Creation */}

      {dialog && page.fields && (

        <CreateDialog

          title={page.title}

          fields={page.fields}

          note={page.createNote}

          token={session.accessToken}

          companyId={companyId}

          onClose={() => setDialog(false)}

          onSubmit={createRecord}

        />

      )}

    </div>

  );

}



function Login({

  onSubmit,

  busy,

  error,

}: {

  onSubmit: (event: FormEvent<HTMLFormElement>) => void;

  busy: boolean;

  error: string;

}) {

  return (

    <main className="login-page">

      <section className="login-art">

        <div className="slide-brand" style={{ padding: 0, border: 0 }}>

          <div className="brand-icon">

            <span />

          </div>

          <div className="brand-text">
            Accounting, in clear focus
          </div>

        </div>



        <div className="art-copy">

          <small className="eyebrow" style={{ color: '#d0e55e' }}>


          </small>

          <h1>

            Make every

            <br />

            number <em>matter.</em>

          </h1>

          <p>

            A connected workspace for your general books, banking, cash flow,

            and executive financial decisions.

          </p>

        </div>



        <div className="art-bottom" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8aa697' }}>

          <span>Power By Kaynet Tech</span>

          <span>@ 2026</span>

        </div>

      </section>



      <section className="login-side">

        <form className="login-form" onSubmit={onSubmit}>

          <div className="login-title">
            <div className="login-logo-wrap">
              <img src="/public/images/Hicad.png" alt="HICAD" />
            </div>
            {/* <small className="eyebrow">YOUR WORKSPACE</small> */}

            <h2>Company sign in</h2>

            <p>Sign in to your company workspace.</p>
            {/* <a href="/platform/">Platform administrator sign in</a> */}

          </div>



          {error && <div className="error-banner">{error}</div>}



          <label className="field">

            Username or email

            <input

              name="identifier"

              autoComplete="username"

              placeholder="e.g. admin"


              required

            />

          </label>



          <label className="field">

            Password

            <input

              name="password"

              type="password"

              autoComplete="current-password"

              placeholder="Enter your password"


              required

            />

          </label>



          <div className="login-options">

            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

              <input type="checkbox" defaultChecked /> Remember device

            </label>

            {/* <a href="#help" style={{ color: '#165b49' }}>Need help?</a> */}

          </div>



          <button className="btn btn-primary login-submit" disabled={busy}>

            {busy ? 'Signing in…' : 'Sign in to Ledger'}

            <ArrowUpRight size={16} />

          </button>



          <div className="secure">

            {/* <ShieldCheck size={14} /> */}

            {/* Secure PostgreSQL role-based authorization */}

          </div>

        </form>

      </section>

    </main>

  );

}



function CreateDialog({
  title,
  fields,
  note,
  token,
  companyId,
  onClose,
  onSubmit,
}: {
  title: string;
  fields: Field[];
  note?: string;
  token: string;
  companyId: string;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<{ roleId: string; roleCode: string; roleName: string }[]>([]);
  const [roleError, setRoleError] = useState('');

  // Select-dropdown state
  const [values, setValues] = useState<Record<string, string>>({});
  const [optionsByField, setOptionsByField] = useState<Record<string, { value: string; label: string }[]>>({});
  const [loadingField, setLoadingField] = useState<Record<string, boolean>>({});
  const [optError, setOptError] = useState<Record<string, string>>({});

  const selectFields = fields.flatMap((field) =>
    field.type === 'lines' && field.lineFields
      ? field.lineFields.filter((lineField) => lineField.type === 'select' && lineField.select)
      : field.type === 'select' && field.select
        ? [field]
        : [],
  );
  const [lineRows, setLineRows] = useState<Record<string, string>[]>([{}]);

  function makeLabel(item: Record<string, unknown>, cfg: NonNullable<Field['select']>): string {
    const primary = String(item[cfg.labelField ?? ''] ?? '');
    if (cfg.secondaryLabelField && item[cfg.secondaryLabelField] != null && item[cfg.secondaryLabelField] !== '') {
      return `${primary} \u2014 ${item[cfg.secondaryLabelField]}`;
    }
    return primary;
  }

  async function loadOptions(field: Field) {
    const cfg = field.select!;
    if (cfg.options) {
      setOptionsByField((prev) => ({ ...prev, [field.name]: cfg.options! }));
      return;
    }
    if (!cfg.endpoint) return;
    if (!cfg.valueField || !cfg.labelField) return;
    const valueField = cfg.valueField;
    const needsCompany = cfg.needsCompany !== false;
    if (needsCompany && !companyId) return;
    if (cfg.dependsOn) {
      const depValue = values[cfg.dependsOn];
      if (!depValue) {
        setOptionsByField((prev) => ({ ...prev, [field.name]: [] }));
        return;
      }
    }
    setLoadingField((prev) => ({ ...prev, [field.name]: true }));
    setOptError((prev) => ({ ...prev, [field.name]: '' }));
    try {
      const params = new URLSearchParams();
      if (needsCompany) params.set('companyId', companyId);
      if (cfg.dependsOn && cfg.dependsOnParam) {
        params.set(cfg.dependsOnParam, String(values[cfg.dependsOn]));
      }
      for (const [key, value] of Object.entries(cfg.params ?? {})) {
        params.set(key, value);
      }
      const path = cfg.endpoint + (params.size ? `?${params.toString()}` : '');
      const data = await api<unknown>(path, token);
      const arr = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
      const opts = (arr as Record<string, unknown>[]).map((item) => ({
        value: String(item[valueField]),
        label: makeLabel(item, cfg),
      }));
      setOptionsByField((prev) => ({ ...prev, [field.name]: opts }));
    } catch (error: unknown) {
      setOptError((prev) => ({
        ...prev,
        [field.name]: error instanceof Error ? error.message : 'Unable to load options.',
      }));
    } finally {
      setLoadingField((prev) => ({ ...prev, [field.name]: false }));
    }
  }

  // Load non-dependent select fields on mount
  useEffect(() => {
    selectFields.forEach((field) => {
      if (field.select!.dependsOn) return;
      void loadOptions(field);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload dependent select fields when their dependency value changes
  const depSignature = selectFields
    .filter((f) => f.select!.dependsOn)
    .map((f) => `${f.name}=${values[f.select!.dependsOn!] ?? ''}`)
    .join('|');

  useEffect(() => {
    selectFields.forEach((field) => {
      if (!field.select!.dependsOn) return;
      void loadOptions(field);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depSignature]);

  // Roles multiselect
  useEffect(() => {
    if (!fields.some((field) => field.type === 'multiselect' && field.name === 'roleIds')) return;
    api<{ roleId: string; roleCode: string; roleName: string }[]>('users/assignable-roles', token)
      .then(setRoles)
      .catch((error: unknown) =>
        setRoleError(error instanceof Error ? error.message : 'Unable to load roles.'),
      );
  }, [fields, token]);

  function handleSelectChange(name: string, value: string) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // Reset dependent fields when this field changes
      selectFields.forEach((field) => {
        if (field.select!.dependsOn === name) next[field.name] = '';
      });
      return next;
    });
  }



  async function submit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setBusy(true);

    const data = new FormData(event.currentTarget);

    const payload: Record<string, unknown> = {};



    fields.forEach((field) => {

      if (field.type === 'lines') {

        payload[field.name] = lineRows

          .map((row) => {

            const line: Record<string, string> = {};

            (field.lineFields ?? []).forEach((lineField) => {

              const value = row[lineField.name]?.trim();

              if (value) line[lineField.name] = value;

            });

            return line;

          })

          .filter((line) => Object.keys(line).length > 0);

        return;

      }

      if (field.type === 'multiselect') {

        payload[field.name] = data.getAll(field.name).map(String);

        return;

      }

      const value = data.get(field.name);

      if (field.type === 'checkbox') payload[field.name] = value === 'on';

      else if (value !== null && value !== '') payload[field.name] = String(value);

    });



    await onSubmit(payload);

    setBusy(false);

  }



  return (

    <div

      className="modal-bg"

      onMouseDown={(event) => {

        if (event.target === event.currentTarget) onClose();

      }}

    >

      <section className="modal">

        <div className="modal-head">

          <div>

            <small className="eyebrow">NEW RECORD</small>

            <h2>Create {singular(title).toLowerCase()}</h2>

            {note ? <p className="modal-note">{note}</p> : null}

          </div>

          <button className="row-open" onClick={onClose} aria-label="Close">

            <X size={17} />

          </button>

        </div>

        <form onSubmit={submit}>

          <div className="form-grid">

            {fields.map((field) => field.type === 'lines' ? (

              <div key={field.name} className={`field full line-items`}>

                <div className="line-items-head">

                  <span>{field.label}</span>

                  <button

                    type="button"

                    className="btn btn-light"

                    onClick={() => setLineRows((rows) => [...rows, {}])}

                  >

                    <Plus size={14} />

                    Add line

                  </button>

                </div>

                {lineRows.map((row, index) => (

                  <div key={index} className="line-item">

                    <div className="line-item-fields">

                    {(field.lineFields ?? []).map((lineField) => (

                      <label key={lineField.name} className={`field ${lineField.full ? 'full' : ''}`}>

                        {lineField.type === 'select' && lineField.select ? (

                          <>

                            {lineField.label}

                            <Combobox

                              name={`lines.${index}.${lineField.name}`}

                              value={row[lineField.name] ?? ''}

                              options={optionsByField[lineField.name] ?? []}

                              loading={!!loadingField[lineField.name]}

                              disabled={false}

                              required={lineField.required}

                              placeholder={

                                loadingField[lineField.name]

                                  ? 'Loading…'

                                  : (lineField.select.placeholder ?? `Select ${lineField.label.toLowerCase()}`)

                              }

                              onChange={(val) =>

                                setLineRows((rows) =>

                                  rows.map((current, rowIndex) =>

                                    rowIndex === index ? { ...current, [lineField.name]: val } : current,

                                  ),

                                )

                              }

                            />

                          </>

                        ) : (

                          <>

                            {lineField.label}

                            <input

                              type={lineField.type ?? 'text'}

                              required={lineField.required}

                              step={lineField.step ?? (lineField.type === 'number' ? '0.01' : undefined)}

                              value={row[lineField.name] ?? ''}

                              onChange={(event) =>

                                setLineRows((rows) =>

                                  rows.map((current, rowIndex) =>

                                    rowIndex === index ? { ...current, [lineField.name]: event.target.value } : current,

                                  ),

                                )

                              }

                            />

                          </>

                        )}

                      </label>

                    ))}

                    </div>

                    <button

                      type="button"

                      className="line-item-remove"

                      aria-label="Remove line"

                      disabled={lineRows.length === 1}

                      onClick={() => setLineRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}

                    >

                      <Trash2 size={14} />

                    </button>

                  </div>

                ))}

              </div>

            ) : (

              <label

                key={field.name}

                className={`field ${field.full ? 'full' : ''}`}

              >

                {field.type === 'checkbox' ? (

                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

                    <input type="checkbox" name={field.name} />

                    {field.label}

                  </span>

                ) : field.type === 'multiselect' && field.name === 'roleIds' ? (

                  <>

                    {field.label}

                    <select

                      name={field.name}

                      multiple

                      required={field.required}

                      size={Math.min(Math.max(roles.length, 2), 5)}

                    >

                      {roles.map((role) => (

                        <option key={role.roleId} value={role.roleId}>

                          {role.roleName} ({role.roleCode})

                        </option>

                      ))}

                    </select>

                    {roleError && <small style={{ color: '#dc2626' }}>{roleError}</small>}

                  </>

                ) : field.type === 'select' && field.select ? (

                  <>

                    {field.label}

                    <Combobox

                      name={field.name}

                      value={values[field.name] ?? ''}

                      options={optionsByField[field.name] ?? []}

                      loading={!!loadingField[field.name]}

                      disabled={!!field.select.dependsOn && !values[field.select.dependsOn]}

                      required={field.required}

                      placeholder={

                        loadingField[field.name]

                          ? 'Loading…'

                          : (field.select.placeholder ?? `Select ${field.label.toLowerCase()}`)

                      }

                      onChange={(val) => handleSelectChange(field.name, val)}

                    />

                    {optError[field.name] && (

                      <small style={{ color: '#dc2626' }}>{optError[field.name]}</small>

                    )}

                  </>

                ) : (

                  <>

                    {field.label}

                    <input

                      name={field.name}

                      type={field.type ?? 'text'}

                      required={field.required}

                      step={field.step ?? (field.type === 'number' ? '0.01' : undefined)}

                      placeholder={field.name.endsWith('Id') ? 'UUID' : undefined}

                    />

                  </>

                )}

              </label>

            ))}

          </div>

          <div className="modal-actions">

            <button type="button" className="btn btn-light" onClick={onClose}>

              Cancel

            </button>

            <button className="btn btn-primary" disabled={busy}>

              {busy ? 'Saving…' : 'Create record'}

              <ArrowUpRight size={15} />

            </button>

          </div>

        </form>

      </section>

    </div>

  );

}



function Combobox({
  name,
  value,
  options,
  loading,
  disabled,
  required,
  placeholder,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  loading: boolean;
  disabled: boolean;
  required?: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  // When closed, the input shows the selected label; when open it shows the query
  const displayValue = open ? query : selectedLabel;

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Keep highlight in bounds when the filtered list shrinks
  const safeHighlight = Math.min(highlighted, Math.max(filtered.length - 1, 0));

  function openList() {
    if (disabled || loading) return;
    setQuery('');
    setHighlighted(0);
    setOpen(true);
  }

  function select(opt: { value: string; label: string }) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function clear() {
    onChange('');
    setQuery('');
    setOpen(false);
  }

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[safeHighlight] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [safeHighlight, open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[safeHighlight]) select(filtered[safeHighlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="combobox" ref={containerRef}>
      {/* Hidden input carries the real value for FormData */}
      <input type="hidden" name={name} value={value} />

      <div
        className={`combobox-trigger ${open ? 'open' : ''} ${disabled || loading ? 'disabled' : ''}`}
        onClick={openList}
      >
        <Search size={13} className="combobox-search-icon" />
        <input
          ref={inputRef}
          className="combobox-input"
          value={displayValue}
          placeholder={placeholder}
          readOnly={!open}
          disabled={disabled || loading}
          required={required && !value}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          onFocus={openList}
          onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
          onKeyDown={handleKeyDown}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="combobox-clear"
            aria-label="Clear"
            onPointerDown={(e) => { e.stopPropagation(); clear(); }}
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={13} className={`combobox-chevron ${open ? 'flipped' : ''}`} />
        )}
      </div>

      {open && (
        <ul className="combobox-list" ref={listRef} role="listbox">
          {loading ? (
            <li className="combobox-empty">Loading…</li>
          ) : filtered.length === 0 ? (
            <li className="combobox-empty">No matches</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`combobox-option ${opt.value === value ? 'selected' : ''} ${i === safeHighlight ? 'highlighted' : ''}`}
                onPointerDown={(e) => { e.preventDefault(); select(opt); }}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function singular(value: string) {

  return value.endsWith('s') ? value.slice(0, -1) : value;

}



function humanize(value: string) {

  return value

    .replace(/([A-Z])/g, ' $1')

    .replace(/^./, (letter) => letter.toUpperCase());

}



function formatDate(value: unknown) {

  if (!value) return '—';

  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime())

    ? String(value)

    : parsed.toLocaleDateString('en-US', {

      month: 'short',

      day: 'numeric',

      year: 'numeric',

    });

}



function formatMoney(value: unknown, currency = 'NGN') {

  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-NG', {

    style: 'currency',

    currency: currency || 'NGN',

    maximumFractionDigits: 2,

  }).format(Number.isFinite(amount) ? amount : 0);

}



function renderCell(key: string, value: unknown) {

  if (value === null || value === undefined || value === '')

    return <span className="text-muted">—</span>;

  if (key.toLowerCase().includes('date')) return formatDate(value);

  if (/amount|balance|cost|limit/i.test(key))

    return <span>{formatMoney(value)}</span>;

  if (typeof value === 'boolean')

    return (

      <span className={`bool ${value ? 'yes' : 'no'}`}>

        {value ? 'Active' : 'No'}

      </span>

    );

  if (key.toLowerCase() === 'status')

    return (

      <span className={`status ${String(value).toLowerCase()}`}>

        {String(value).replaceAll('_', ' ')}

      </span>

    );

  return (

    <span className={/name|number|code/i.test(key) ? 'primary-cell' : ''}>

      {String(value)}

    </span>

  );

}



export default App;

