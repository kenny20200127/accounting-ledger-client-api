import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Banknote,
  FileText,
  Landmark,
  RefreshCw,
  Wallet,
  TrendingDown,
  TrendingUp,
  Users,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import type { Company, PageKey } from '../types';

interface DashboardProps {
  companies: Company[];
  companyId: string;
  token: string;
  onNavigate: (key: PageKey) => void;
  onOpenCreate?: (pageKey: PageKey) => void;
}

export function Dashboard({
  companies,
  companyId,
  token,
  onNavigate,
  onOpenCreate,
}: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [activeTab, setActiveTab] = useState<'invoices' | 'expenses' | 'banking'>('invoices');

  // Raw data from endpoints
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Record<string, unknown>[]>([]);
  const [fiscalYears, setFiscalYears] = useState<Record<string, unknown>[]>([]);
  const [periods, setPeriods] = useState<Record<string, unknown>[]>([]);

  const company = companies.find((c) => c.companyId === companyId);
  const currency = company?.baseCurrency || 'NGN';

  // Fetch all accounting data in parallel for the selected company
  const loadDashboardData = useCallback(async () => {
    if (!companyId || !token) return;
    setLoading(true);
    setError('');

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [
        invRes,
        expRes,
        custRes,
        accRes,
        bankRes,
        fyRes,
        perRes,
      ] = await Promise.allSettled([
        fetch(`/api/v1/invoices?companyId=${companyId}`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/expenses?companyId=${companyId}`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/customers?companyId=${companyId}`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/accounts?companyId=${companyId}`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/banking/accounts?companyId=${companyId}`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/fiscal-years?companyId=${companyId}`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/accounting-periods`, { headers }).then((r) => r.json()),
      ]);

      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) setInvoices(invRes.value);
      if (expRes.status === 'fulfilled' && Array.isArray(expRes.value)) setExpenses(expRes.value);
      if (custRes.status === 'fulfilled' && Array.isArray(custRes.value)) setCustomers(custRes.value);
      if (accRes.status === 'fulfilled' && Array.isArray(accRes.value)) setAccounts(accRes.value);
      if (bankRes.status === 'fulfilled' && Array.isArray(bankRes.value)) setBankAccounts(bankRes.value);
      if (fyRes.status === 'fulfilled' && Array.isArray(fyRes.value)) setFiscalYears(fyRes.value);
      if (perRes.status === 'fulfilled' && Array.isArray(perRes.value)) setPeriods(perRes.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Calculations
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalReceivables = 0;
    let totalPaidInvoices = 0;

    invoices.forEach((inv) => {
      const total = Number(inv.totalAmount || 0);
      const paid = Number(inv.amountPaid || 0);
      const balance = Number(inv.balanceDue !== undefined ? inv.balanceDue : total - paid);
      totalInvoiced += total;
      totalPaidInvoices += paid;
      totalReceivables += balance > 0 ? balance : 0;
    });

    let totalExpenses = 0;
    expenses.forEach((exp) => {
      totalExpenses += Number(exp.totalAmount || exp.amount || 0);
    });

    let totalCash = 0;
    bankAccounts.forEach((ba) => {
      totalCash += Number(ba.currentBalance || 0);
    });

    const netMargin = totalInvoiced - totalExpenses;
    const marginPercent = totalInvoiced > 0 ? (netMargin / totalInvoiced) * 100 : 0;

    // Status breakdown
    const invoiceStatusCount: Record<string, number> = {
      PAID: 0,
      PARTIALLY_PAID: 0,
      SENT: 0,
      DRAFT: 0,
    };
    invoices.forEach((inv) => {
      const status = String(inv.status || 'DRAFT').toUpperCase();
      invoiceStatusCount[status] = (invoiceStatusCount[status] || 0) + 1;
    });

    return {
      totalInvoiced,
      totalReceivables,
      totalPaidInvoices,
      totalExpenses,
      totalCash,
      netMargin,
      marginPercent,
      customerCount: customers.length,
      accountCount: accounts.length,
      bankAccountCount: bankAccounts.length,
      invoiceCount: invoices.length,
      expenseCount: expenses.length,
      invoiceStatusCount,
    };
  }, [invoices, expenses, customers, accounts, bankAccounts]);

  // Current active fiscal year & period
  const activeFiscalYear = useMemo(() => {
    return fiscalYears.find((fy) => !fy.isClosed) || fiscalYears[0];
  }, [fiscalYears]);

  const activePeriod = useMemo(() => {
    return periods.find((p) => p.isOpen && !p.isClosed) || periods[0];
  }, [periods]);

  // Dynamic greeting and date initialized once in state
  const [currentDate] = useState(() => new Date());
  const greeting =
    currentDate.getHours() < 12
      ? 'Good morning'
      : currentDate.getHours() < 17
        ? 'Good afternoon'
        : 'Good evening';

  const todayFormatted = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="dashboard-container">
      {/* Top Banner / Hero Header */}
      <div className="dashboard-hero">
        <div className="hero-text">
          <div className="hero-eyebrow">
            <span className="live-pill">● LIVE LEDGER</span>
            <span>{todayFormatted}</span>
          </div>
          <h1>
            {greeting},{' '}
            <span className="brand-accent">
              {company?.companyName ?? 'Workspace'}
            </span>
          </h1>
          <p>
            Here is your financial overview, operating metrics, and cash flow
            position for {company?.companyName ?? 'your active company'}.
          </p>
        </div>

        <div className="hero-controls">
          <div className="time-range-group">
            <button
              className={`range-pill ${timeRange === 'month' ? 'active' : ''}`}
              onClick={() => setTimeRange('month')}
            >
              This Month
            </button>
            <button
              className={`range-pill ${timeRange === 'quarter' ? 'active' : ''}`}
              onClick={() => setTimeRange('quarter')}
            >
              Quarter
            </button>
            <button
              className={`range-pill ${timeRange === 'year' ? 'active' : ''}`}
              onClick={() => setTimeRange('year')}
            >
              YTD
            </button>
            <button
              className={`range-pill ${timeRange === 'all' ? 'active' : ''}`}
              onClick={() => setTimeRange('all')}
            >
              All Time
            </button>
          </div>

          {onOpenCreate && (
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => onOpenCreate('invoices')}
            >
              <FileText size={14} /> New Invoice
            </button>
          )}

          <button
            className="btn btn-light refresh-dash-btn"
            onClick={loadDashboardData}
            title="Reload metrics"
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Cards Grid (6 Financial Metrics) */}
      <section className="kpi-grid">
        {/* KPI 1: Total Revenue / Invoiced */}
        <div
          className="kpi-card revenue"
          onClick={() => onNavigate('invoices')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <span className="kpi-icon-badge blue">
              <FileText size={18} />
            </span>
            <span className="kpi-trend positive">
              <TrendingUp size={13} /> {metrics.invoiceCount} invoices
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Total Invoiced (Revenue)</span>
            <h2 className="kpi-value">{formatMoney(metrics.totalInvoiced, currency)}</h2>
            <div className="kpi-foot">
              <span>Collected: <b>{formatMoney(metrics.totalPaidInvoices, currency)}</b></span>
              <ArrowUpRight size={14} className="kpi-arrow" />
            </div>
          </div>
        </div>

        {/* KPI 2: Outstanding Receivables */}
        <div
          className="kpi-card receivables"
          onClick={() => onNavigate('invoices')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <span className="kpi-icon-badge amber">
              <Clock size={18} />
            </span>
            <span className="kpi-trend neutral">
              {(metrics.totalInvoiced > 0
                ? (metrics.totalReceivables / metrics.totalInvoiced) * 100
                : 0
              ).toFixed(0)}% unpaid
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Accounts Receivable (A/R)</span>
            <h2 className="kpi-value">{formatMoney(metrics.totalReceivables, currency)}</h2>
            <div className="kpi-foot">
              <span>Awaiting client payment</span>
              <ArrowUpRight size={14} className="kpi-arrow" />
            </div>
          </div>
        </div>

        {/* KPI 3: Total Expenses */}
        <div
          className="kpi-card expenses"
          onClick={() => onNavigate('expenses')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <span className="kpi-icon-badge coral">
              <Wallet size={18} />
            </span>
            <span className="kpi-trend">
              {metrics.expenseCount} recorded
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Operating Expenses</span>
            <h2 className="kpi-value">{formatMoney(metrics.totalExpenses, currency)}</h2>
            <div className="kpi-foot">
              <span>Operational business spend</span>
              <ArrowUpRight size={14} className="kpi-arrow" />
            </div>
          </div>
        </div>

        {/* KPI 4: Net Margin / Operating Profit */}
        <div
          className="kpi-card net-profit"
          onClick={() => onNavigate('reports')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <span className="kpi-icon-badge green">
              <Banknote size={18} />
            </span>
            <span className={`kpi-trend ${metrics.netMargin >= 0 ? 'positive' : 'negative'}`}>
              {metrics.netMargin >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {metrics.marginPercent.toFixed(1)}% margin
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Net Operating Income</span>
            <h2 className={`kpi-value ${metrics.netMargin >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatMoney(metrics.netMargin, currency)}
            </h2>
            <div className="kpi-foot">
              <span>Revenue minus expenses</span>
              <ArrowUpRight size={14} className="kpi-arrow" />
            </div>
          </div>
        </div>

        {/* KPI 5: Liquid Cash & Banking */}
        <div
          className="kpi-card banking"
          onClick={() => onNavigate('banking')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <span className="kpi-icon-badge indigo">
              <Landmark size={18} />
            </span>
            <span className="kpi-trend positive">
              {metrics.bankAccountCount} bank account{metrics.bankAccountCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Cash & Bank Balances</span>
            <h2 className="kpi-value">{formatMoney(metrics.totalCash, currency)}</h2>
            <div className="kpi-foot">
              <span>Liquid assets on hand</span>
              <ArrowUpRight size={14} className="kpi-arrow" />
            </div>
          </div>
        </div>

        {/* KPI 6: Customer Directory & Ledger */}
        <div
          className="kpi-card directory"
          onClick={() => onNavigate('customers')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <span className="kpi-icon-badge teal">
              <Users size={18} />
            </span>
            <span className="kpi-trend positive">
              {metrics.accountCount} COA accounts
            </span>
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Active Customers</span>
            <h2 className="kpi-value">{metrics.customerCount}</h2>
            <div className="kpi-foot">
              <span>Client directory records</span>
              <ArrowUpRight size={14} className="kpi-arrow" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Interactive Grid: Financial Trend & Invoice Status Breakdown */}
      <div className="dashboard-analytics-row">
        {/* Cash Flow / Revenue vs Expenses Comparison */}
        <div className="analytics-card cash-flow-card">
          <div className="card-header">
            <div>
              <span className="card-subtitle">FINANCIAL PERFORMANCE</span>
              <h3>Revenue vs Operating Spend</h3>
            </div>
            <div className="legend-pills">
              <span className="legend-item blue"><i /> Invoiced</span>
              <span className="legend-item coral"><i /> Expenses</span>
              <span className="legend-item green"><i /> Net Profit</span>
            </div>
          </div>

          <div className="chart-preview-container">
            <div className="bar-comparison-chart">
              {/* Comparison Visual Bars */}
              <div className="chart-bar-col">
                <div className="bar-wrapper">
                  <div
                    className="bar-fill blue"
                    style={{
                      height: `${Math.min(
                        100,
                        Math.max(
                          20,
                          (metrics.totalInvoiced /
                            Math.max(1, metrics.totalInvoiced + metrics.totalExpenses)) *
                          100 *
                          1.4,
                        ),
                      )}%`,
                    }}
                  >
                    <span className="bar-tooltip">
                      {formatMoney(metrics.totalInvoiced, currency)}
                    </span>
                  </div>
                </div>
                <span className="bar-title">Gross Revenue</span>
                <span className="bar-sub">{formatMoney(metrics.totalInvoiced, currency)}</span>
              </div>

              <div className="chart-bar-col">
                <div className="bar-wrapper">
                  <div
                    className="bar-fill coral"
                    style={{
                      height: `${Math.min(
                        100,
                        Math.max(
                          15,
                          (metrics.totalExpenses /
                            Math.max(1, metrics.totalInvoiced + metrics.totalExpenses)) *
                          100 *
                          1.4,
                        ),
                      )}%`,
                    }}
                  >
                    <span className="bar-tooltip">
                      {formatMoney(metrics.totalExpenses, currency)}
                    </span>
                  </div>
                </div>
                <span className="bar-title">Expenses</span>
                <span className="bar-sub">{formatMoney(metrics.totalExpenses, currency)}</span>
              </div>

              <div className="chart-bar-col">
                <div className="bar-wrapper">
                  <div
                    className={`bar-fill ${metrics.netMargin >= 0 ? 'green' : 'red'}`}
                    style={{
                      height: `${Math.min(
                        100,
                        Math.max(
                          12,
                          (Math.abs(metrics.netMargin) /
                            Math.max(1, metrics.totalInvoiced)) *
                          100,
                        ),
                      )}%`,
                    }}
                  >
                    <span className="bar-tooltip">
                      {formatMoney(metrics.netMargin, currency)}
                    </span>
                  </div>
                </div>
                <span className="bar-title">Net Margin</span>
                <span className="bar-sub">{formatMoney(metrics.netMargin, currency)}</span>
              </div>
            </div>

            <div className="chart-footer-metrics">
              <div className="cf-metric">
                <small>Gross Margin Rate</small>
                <b>{metrics.marginPercent.toFixed(1)}%</b>
              </div>
              <div className="cf-metric">
                <small>Collection Ratio</small>
                <b>
                  {metrics.totalInvoiced > 0
                    ? ((metrics.totalPaidInvoices / metrics.totalInvoiced) * 100).toFixed(0)
                    : 0}
                  %
                </b>
              </div>
              <div className="cf-metric">
                <small>Cash Reserves</small>
                <b>{formatMoney(metrics.totalCash, currency)}</b>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Pipeline & Status Distribution */}
        <div className="analytics-card status-card">
          <div className="card-header">
            <div>
              <span className="card-subtitle">RECEIVABLES AGING</span>
              <h3>Invoice Pipeline</h3>
            </div>
            <button
              className="text-btn"
              onClick={() => onNavigate('invoices')}
            >
              View all <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="status-progress-track">
            {metrics.invoiceCount > 0 ? (
              <>
                <div
                  className="track-segment paid"
                  style={{
                    width: `${((metrics.invoiceStatusCount.PAID || 0) / metrics.invoiceCount) * 100}%`,
                  }}
                  title={`Paid: ${metrics.invoiceStatusCount.PAID || 0}`}
                />
                <div
                  className="track-segment partial"
                  style={{
                    width: `${((metrics.invoiceStatusCount.PARTIALLY_PAID || 0) / metrics.invoiceCount) * 100}%`,
                  }}
                  title={`Partially Paid: ${metrics.invoiceStatusCount.PARTIALLY_PAID || 0}`}
                />
                <div
                  className="track-segment sent"
                  style={{
                    width: `${((metrics.invoiceStatusCount.SENT || 0) / metrics.invoiceCount) * 100}%`,
                  }}
                  title={`Sent: ${metrics.invoiceStatusCount.SENT || 0}`}
                />
                <div
                  className="track-segment draft"
                  style={{
                    width: `${((metrics.invoiceStatusCount.DRAFT || 0) / metrics.invoiceCount) * 100}%`,
                  }}
                  title={`Draft: ${metrics.invoiceStatusCount.DRAFT || 0}`}
                />
              </>
            ) : (
              <div className="track-segment empty-track" style={{ width: '100%' }} />
            )}
          </div>

          <div className="status-breakdown-list">
            <div className="status-item">
              <span className="status-dot paid" />
              <div className="status-meta">
                <b>Paid in Full</b>
                <small>{metrics.invoiceStatusCount.PAID || 0} invoices</small>
              </div>
              <span className="status-badge paid">PAID</span>
            </div>

            <div className="status-item">
              <span className="status-dot partial" />
              <div className="status-meta">
                <b>Partially Paid</b>
                <small>{metrics.invoiceStatusCount.PARTIALLY_PAID || 0} invoices</small>
              </div>
              <span className="status-badge partial">PARTIAL</span>
            </div>

            <div className="status-item">
              <span className="status-dot sent" />
              <div className="status-meta">
                <b>Awaiting Payment (Sent)</b>
                <small>{metrics.invoiceStatusCount.SENT || 0} invoices</small>
              </div>
              <span className="status-badge sent">SENT</span>
            </div>

            <div className="status-item">
              <span className="status-dot draft" />
              <div className="status-meta">
                <b>Draft Invoices</b>
                <small>{metrics.invoiceStatusCount.DRAFT || 0} invoices</small>
              </div>
              <span className="status-badge draft">DRAFT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row: Quick Actions, Recent Activity Tabs & Financial Status */}
      <div className="dashboard-grid-two">
        {/* Activity Center (Tabs for Invoices, Expenses, Banking) */}
        <div className="table-panel activity-center">
          <div className="activity-tabs-header">
            <div className="tabs-list">
              <button
                className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
                onClick={() => setActiveTab('invoices')}
              >
                <FileText size={15} />
                <span>Recent Invoices ({invoices.length})</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
                onClick={() => setActiveTab('expenses')}
              >
                <Wallet size={15} />
                <span>Expenses ({expenses.length})</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'banking' ? 'active' : ''}`}
                onClick={() => setActiveTab('banking')}
              >
                <Landmark size={15} />
                <span>Bank Accounts ({bankAccounts.length})</span>
              </button>
            </div>

            <button
              className="text-btn view-more-btn"
              onClick={() => onNavigate(activeTab === 'invoices' ? 'invoices' : activeTab === 'expenses' ? 'expenses' : 'banking')}
            >
              Full list <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="table-scroll activity-table">
            {activeTab === 'invoices' && (
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Due Date</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length > 0 ? (
                    invoices.slice(0, 5).map((row, index) => (
                      <tr key={String(row.invoiceId || index)}>
                        <td className="primary-cell">
                          <b>{String(row.invoiceNumber || '—')}</b>
                        </td>
                        <td>{formatDate(row.dueDate)}</td>
                        <td><b>{formatMoney(row.totalAmount, currency)}</b></td>
                        <td className="text-muted">{formatMoney(row.amountPaid, currency)}</td>
                        <td>
                          <span className={Number(row.balanceDue || 0) > 0 ? 'text-amber' : 'text-muted'}>
                            {formatMoney(row.balanceDue, currency)}
                          </span>
                        </td>
                        <td>
                          <span className={`status ${String(row.status || 'draft').toLowerCase()}`}>
                            {String(row.status || 'DRAFT').replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-inline">
                        No sales invoices created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'expenses' && (
              <table>
                <thead>
                  <tr>
                    <th>Expense #</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length > 0 ? (
                    expenses.slice(0, 5).map((row, index) => (
                      <tr key={String(row.expenseId || index)}>
                        <td className="primary-cell">
                          <b>{String(row.expenseNumber || '—')}</b>
                        </td>
                        <td>{formatDate(row.expenseDate)}</td>
                        <td>{String(row.description || 'General expense')}</td>
                        <td><b>{formatMoney(row.totalAmount || row.amount, currency)}</b></td>
                        <td>
                          <span className={`status ${String(row.status || 'draft').toLowerCase()}`}>
                            {String(row.status || 'DRAFT')}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-inline">
                        No operational expenses recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'banking' && (
              <table>
                <thead>
                  <tr>
                    <th>Bank Name</th>
                    <th>Account Name</th>
                    <th>Account #</th>
                    <th>Currency</th>
                    <th>Current Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.length > 0 ? (
                    bankAccounts.slice(0, 5).map((row, index) => (
                      <tr key={String(row.bankAccountId || index)}>
                        <td className="primary-cell">
                          <b>{String(row.bankName || '—')}</b>
                        </td>
                        <td>{String(row.accountName || '—')}</td>
                        <td>{String(row.accountNumber || '—')}</td>
                        <td><span className="currency-badge">{String(row.currency || currency)}</span></td>
                        <td>
                          <b className="text-forest">
                            {formatMoney(row.currentBalance, String(row.currency || currency))}
                          </b>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-inline">
                        No company bank accounts configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Quick Workflows & Fiscal Year Status */}
        <div className="right-dashboard-col">
          {/* Fiscal Status Card */}
          <div className="fiscal-health-card">
            <div className="fh-header">
              <span className="card-subtitle">POSTING STATUS</span>
              <h4>Fiscal Period & Ledger</h4>
            </div>
            <div className="fh-content">
              <div className="fh-row">
                <span className="fh-label">Fiscal Year:</span>
                <span className="fh-value">
                  <b>{activeFiscalYear ? String(activeFiscalYear.yearName) : 'FY 2026'}</b>
                  <span className="pill green">Active</span>
                </span>
              </div>
              <div className="fh-row">
                <span className="fh-label">Open Period:</span>
                <span className="fh-value">
                  <b>{activePeriod ? String(activePeriod.periodName) : 'October 2026'}</b>
                  <span className="pill blue">Posting Open</span>
                </span>
              </div>
              <div className="fh-row">
                <span className="fh-label">Ledger State:</span>
                <span className="fh-value">
                  <CheckCircle2 size={14} className="text-green" /> Balanced Debits/Credits
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="quick-shortcuts-panel">
            <div className="qs-header">
              <span className="card-subtitle">WORKFLOW SHORTCUTS</span>
              <h4>Quick Actions</h4>
            </div>
            <div className="shortcuts-grid">
              <button
                className="shortcut-tile"
                onClick={() => onNavigate('invoices')}
              >
                <span className="shortcut-icon blue"><FileText size={16} /></span>
                <span>Invoices</span>
                <ArrowUpRight size={13} className="tile-arrow" />
              </button>

              <button
                className="shortcut-tile"
                onClick={() => onNavigate('expenses')}
              >
                <span className="shortcut-icon coral"><Wallet size={16} /></span>
                <span>Expenses</span>
                <ArrowUpRight size={13} className="tile-arrow" />
              </button>

              <button
                className="shortcut-tile"
                onClick={() => onNavigate('customers')}
              >
                <span className="shortcut-icon teal"><Users size={16} /></span>
                <span>Customers</span>
                <ArrowUpRight size={13} className="tile-arrow" />
              </button>

              <button
                className="shortcut-tile"
                onClick={() => onNavigate('journals')}
              >
                <span className="shortcut-icon amber"><BookOpen size={16} /></span>
                <span>Journals</span>
                <ArrowUpRight size={13} className="tile-arrow" />
              </button>

              <button
                className="shortcut-tile"
                onClick={() => onNavigate('banking')}
              >
                <span className="shortcut-icon indigo"><Landmark size={16} /></span>
                <span>Banking</span>
                <ArrowUpRight size={13} className="tile-arrow" />
              </button>

              <button
                className="shortcut-tile"
                onClick={() => onNavigate('reports')}
              >
                <span className="shortcut-icon green"><Banknote size={16} /></span>
                <span>Reports</span>
                <ArrowUpRight size={13} className="tile-arrow" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(value: unknown, currency = 'NGN') {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
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
