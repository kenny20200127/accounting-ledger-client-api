import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { LegacyMigrationReview } from './LegacyMigrationReview';
type Kind = 'trial-balance' | 'profit-loss' | 'account-balances';
type Options = {
  company: { companyName: string; address: string; currency: string };
  groups: { code: string; name: string }[];
  branches: { branchId: string; branchName: string }[];
  fiscalYears: { fiscalYearId: string; yearName: string; startDate: string; endDate: string }[];
};
type Report = {
  logoData?: string | null;
  kind: Kind; title: string; companyName: string; address: string; currency: string;
  asOf: string; monthStart: string; fiscalYearStart: string; branchName: string; generatedAt: string;
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: { description: string; isSection?: boolean; isTotal?: boolean; [key: string]: string | boolean | undefined }[];
  totals: { label: string; values: Record<string, string> }[];
  warnings: string[]; balanced?: boolean;
};
const kinds: { id: Kind; title: string; description: string }[] = [
  { id: 'trial-balance', title: 'Trial Balance', description: 'Current month and year-to-date balances' },
  { id: 'profit-loss', title: 'Profit & Loss', description: 'Income, expenses, and profit or loss' },
  { id: 'account-balances', title: 'Balance of Account', description: 'Detailed balances by account group' },
];
const presets = [
  { id: 'banks', title: 'Bank and cash balances', codes: ['156000', '157000'] },
  { id: 'accruals', title: 'Accruals and expenses', codes: ['214000'] },
  { id: 'directors', title: 'Directors current accounts', codes: ['151400'] },
  { id: 'investments', title: 'Long-term investments', codes: ['130000'] },
  { id: 'staff', title: 'Staff debtors', codes: ['151300'] },
  { id: 'insurers', title: 'Insurance company creditors', codes: ['211000'] },
  { id: 'clients', title: 'Client debtors', codes: ['151100'] },
];
function today() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (name: string) => parts.find(p => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function money(value: string | boolean | undefined) {
  const raw = String(value ?? '0.00');
  const negative = raw.startsWith('-');
  const [whole, fraction = '00'] = raw.replace(/^[+-]/, '').split('.');
  const formatted = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`;
  return negative ? `(${formatted})` : formatted;
}
async function read<T>(url: string, token: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
  const body = await response.json();
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message || 'Unable to generate report.');
  return body;
}
export function FinancialReportsView({ token, companyId }: { token: string; companyId: string }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [kind, setKind] = useState<Kind>('trial-balance');
  const [asOf, setAsOf] = useState(today);
  const [branchId, setBranchId] = useState('');
  const [fiscalYearId, setFiscalYearId] = useState('');
  const [preset, setPreset] = useState('all');
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [includeZero, setIncludeZero] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [previewQuery, setPreviewQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    setOptions(null); setReport(null); setError('');
    if (companyId) read<Options>(`/api/v1/reports/financial/options?companyId=${encodeURIComponent(companyId)}`, token, controller.signal)
      .then(data => { if (!controller.signal.aborted) setOptions(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [companyId, token]);
  const selectedGroups = preset === 'custom' ? customGroups : presets.find(p => p.id === preset)?.codes ?? [];
  const params = new URLSearchParams({ companyId, report: kind, asOf, includeZero: String(includeZero) });
  if (branchId) params.set('branchId', branchId);
  if (fiscalYearId) params.set('fiscalYearId', fiscalYearId);
  if (kind === 'account-balances' && selectedGroups.length) params.set('groupCodes', selectedGroups.join(','));
  const query = params.toString();
  const validFilters = !!asOf && !(kind === 'account-balances' && preset === 'custom' && !customGroups.length);
  useEffect(() => {
    const controller = new AbortController();
    setPageNumber(1); setReport(null); setPreviewQuery('');
    if (!companyId || !options || !validFilters) { setLoading(false); return () => controller.abort(); }
    setLoading(true); setError('');
    const timer = window.setTimeout(() => {
      read<Report>(`/api/v1/reports/financial?${query}`, token, controller.signal)
        .then(data => { if (!controller.signal.aborted) { setReport(data); setPreviewQuery(query); } })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 150);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [companyId, options, validFilters, query, token, refresh]);
  async function download() {
    if (!report || previewQuery !== query) return;
    setDownloading(true); setError('');
    try {
      const response = await fetch(`/api/v1/reports/financial/pdf?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message || 'Unable to download PDF.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${kind}-${asOf}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to download PDF.'); }
    finally { setDownloading(false); }
  }
  const availablePresets = presets.filter(p => p.codes.every(code => options?.groups.some(g => g.code === code)));
  const count = report?.rows.length ?? 0;
  const pages = Math.max(1, Math.ceil(count / 50));
  const rows = report?.rows.slice((pageNumber - 1) * 50, pageNumber * 50) ?? [];
  if (!companyId) return <section className="table-panel report-empty">Choose a company to generate reports.</section>;
  return <div className="financial-reports">
    <div className="page-heading"><div><small className="eyebrow">FINANCIAL REPORTS</small><h1>Reports</h1><p>Generate your accounting reports and download them as PDFs.</p></div></div>
    <div className="report-kind-selector" role="group" aria-label="Report type">
      {kinds.map(item => <button key={item.id} aria-pressed={kind === item.id} className={kind === item.id ? 'report-kind active' : 'report-kind'} onClick={() => setKind(item.id)}><strong>{item.title}</strong><span>{item.description}</span></button>)}
    </div>
    <form className="table-panel report-filter-panel" onSubmit={event => { event.preventDefault(); setRefresh(n => n + 1); }}>
      <div className="report-filter-grid">
        <label>As at date<input type="date" required value={asOf} onChange={e => { setAsOf(e.target.value); setFiscalYearId(''); }} /></label>
        <label>Branch<select value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">All branches</option>{options?.branches.map(b => <option key={b.branchId} value={b.branchId}>{b.branchName}</option>)}</select></label>
        <label>Fiscal year<select value={fiscalYearId} onChange={e => setFiscalYearId(e.target.value)}><option value="">Detect from report date</option>{options?.fiscalYears.filter(f => f.startDate <= asOf && f.endDate >= asOf).map(f => <option key={f.fiscalYearId} value={f.fiscalYearId}>{f.yearName}</option>)}</select></label>
        {kind === 'account-balances' && <label>Account group<select value={preset} onChange={e => setPreset(e.target.value)}><option value="all">All accounts</option>{availablePresets.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}<option value="custom">Choose account groups</option></select></label>}
      </div>
      {kind === 'account-balances' && preset === 'custom' && <div className="report-group-list" aria-label="Choose account groups">{options?.groups.map(group => <label key={group.code}><input type="checkbox" checked={customGroups.includes(group.code)} disabled={customGroups.length >= 30 && !customGroups.includes(group.code)} onChange={event => setCustomGroups(current => event.target.checked ? [...current, group.code] : current.filter(code => code !== group.code))} />{group.code} - {group.name}</label>)}</div>}
      <div className="report-filter-actions"><label className="report-zero-toggle"><input type="checkbox" checked={includeZero} onChange={e => setIncludeZero(e.target.checked)} /> Include zero balances</label>
        <button className="btn btn-light" type="submit" disabled={!options || loading || !validFilters}><RefreshCw size={15} />{loading ? 'Generating...' : 'Generate report'}</button>
        <button className="btn btn-primary" type="button" disabled={loading || downloading || !report || previewQuery !== query} onClick={() => void download()}><Download size={15} />{downloading ? 'Preparing PDF...' : 'Download PDF'}</button>
      </div>
    </form>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {loading && <p role="status">Generating report...</p>}
    {!options && !error && <p role="status">Loading report options...</p>}
    {!validFilters && <p>Choose a report date and at least one account group.</p>}
    {report && previewQuery === query && <section className="table-panel report-preview">
      <header className="report-paper-heading">{report.logoData && <img src={report.logoData} alt="Company logo" style={{maxWidth:160,maxHeight:65,objectFit:'contain'}} />}<h2>{report.companyName}</h2><p>{report.address}</p><h3>{report.title}</h3><p>As at {report.asOf} | {report.branchName} | {report.currency}</p><small>Produced on {new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.generatedAt))} | Fiscal year starts {report.fiscalYearStart}</small></header>
      <div className="report-notes">
        {report.kind === 'trial-balance' && <p>Current month shows net movement. Year-to-date balances include brought-forward posted entries.</p>}
        {report.kind === 'profit-loss' && <p>Credit income and profit appear in parentheses. Year to date begins {report.fiscalYearStart}.</p>}
        {report.warnings.map(warning => <p key={warning} className="report-data-note">{warning}</p>)}
      </div>
      <div className="table-scroll"><table className="financial-report-table"><thead><tr>{report.columns.map(c => <th key={c.key} className={c.numeric ? 'report-number' : ''}>{c.label}</th>)}</tr></thead><tbody>
        {rows.map((row, index) => row.isSection ? <tr key={index} className="report-section"><td colSpan={report.columns.length}>{row.description}</td></tr> : <tr key={index} className={row.isTotal ? 'report-subtotal' : ''}>{report.columns.map(c => <td key={c.key} className={c.numeric ? 'report-number' : ''}>{c.numeric ? money(row[c.key]) : String(row[c.key] ?? '')}</td>)}</tr>)}
        {!count && <tr><td colSpan={report.columns.length} className="empty">No matching accounts for these filters.</td></tr>}
      </tbody><tfoot>{report.totals.map(total => <tr key={total.label}>{report.columns.map((c, index) => <td key={c.key} className={c.numeric ? 'report-number' : ''}>{c.numeric ? money(total.values[c.key]) : c.key === 'description' || (index === 0 && !report.columns.some(column => column.key === 'description')) ? total.label : ''}</td>)}</tr>)}</tfoot></table></div>
      <div className="table-footer"><span>{count} report rows. Totals cover all matching records; PDF includes every page.</span><div className="pagination-controls"><button className="btn btn-light" disabled={pageNumber <= 1} onClick={() => setPageNumber(n => n - 1)}>Previous</button><span>Page {pageNumber} of {pages}</span><button className="btn btn-light" disabled={pageNumber >= pages} onClick={() => setPageNumber(n => n + 1)}>Next</button></div></div>
      {report.kind === 'trial-balance' && <p className="report-balance-status">{report.balanced ? 'TRIAL BALANCE OK' : 'TRIAL BALANCE REQUIRES REVIEW'}</p>}
    </section>}
    <details className="report-migration-details"><summary>Migration reconciliation</summary><LegacyMigrationReview token={token} companyId={companyId} refresh={refresh} /></details>
  </div>;
}
