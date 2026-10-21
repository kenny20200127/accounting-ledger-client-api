import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';

type ViewProps = { token: string; companyId: string };

type CaptureLine = {
  id: number;
  accountCode: string;
  accountName: string;
  amount: string;
  transactionType: 'DB' | 'CR';
  remarks: string;
};

type AccountOption = { value: string; label: string; name: string };

type PostResult = {
  docNo: string;
  docType: string;
  docDate: string;
  period: string;
  lines: { accountCode: string; accountName: string; transactionType: string; amount: string }[];
  balances: {
    accountCode: string;
    accountName: string;
    debitBalance: string;
    creditBalance: string;
  }[];
};

type HistoryPage = {
  items: {
    historyId: number;
    docNo: string;
    docType: string;
    refNo: string | null;
    docDate: string;
    accountCode: string;
    accountName: string;
    debitAmount: string;
    creditAmount: string;
    remarks: string | null;
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const docTypes = [
  { value: 'JV', label: 'JV — Journal voucher' },
  { value: 'BV', label: 'BV — Bank voucher' },
  { value: 'CV', label: 'CV — Cash voucher' },
  { value: 'PV', label: 'PV — Payment voucher' },
  { value: 'RV', label: 'RV — Receipt voucher' },
  { value: 'CN', label: 'CN — Credit note' },
  { value: 'DN', label: 'DN — Debit note' },
];

const amountPattern = /^(?=.*[1-9])\d+(\.\d{1,2})?$/;
let lineIdCounter = 1;
const blankLine = (): CaptureLine => ({
  id: lineIdCounter++,
  accountCode: '',
  accountName: '',
  amount: '',
  transactionType: 'DB',
  remarks: '',
});

function today() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function toCents(value: string): number {
  const raw = String(value || '0');
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^[+-]/, '').split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}

function money(value: string | number | undefined) {
  return formatCents(toCents(String(value ?? '0')));
}

function formatCents(cents: number) {
  const abs = Math.abs(cents);
  const grouped = `${String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `(${grouped})` : grouped;
}

async function read<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message || 'Request failed.');
  }
  return body as T;
}

export function LedgerCaptureView({ token, companyId }: ViewProps) {
  const [docType, setDocType] = useState('JV');
  const [refNo, setRefNo] = useState('');
  const [docDate, setDocDate] = useState(today);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<{ branchId: string; branchName: string }[]>([]);
  const [lines, setLines] = useState<CaptureLine[]>([blankLine()]);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [error, setError] = useState('');

  const [history, setHistory] = useState<HistoryPage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const debitCents = lines.reduce((sum, l) => sum + (l.transactionType === 'DB' ? toCents(l.amount) : 0), 0);
  const creditCents = lines.reduce((sum, l) => sum + (l.transactionType === 'CR' ? toCents(l.amount) : 0), 0);
  const difference = debitCents - creditCents;

  useEffect(() => {
    if (!companyId) return;
    read<{ branchId: string; branchName: string }[]>(`/api/v1/branches?companyId=${encodeURIComponent(companyId)}`, token)
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]));
  }, [companyId, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, companyId]);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    const params = new URLSearchParams({ companyId, page: String(page), limit: '10' });
    if (debouncedSearch) params.set('q', debouncedSearch);
    read<HistoryPage>(`/api/v1/ledger-batches?${params}`, token, { signal: controller.signal })
      .then((data) => setHistory(data))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Failed to load postings.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [companyId, token, debouncedSearch, page, historyRefresh]);

  async function post(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (lines.length === 0) return setError('Add at least one ledger line.');
    for (const line of lines) {
      if (!line.accountCode) return setError('Every line needs a ledger account.');
      if (!amountPattern.test(line.amount)) return setError(`Line amount "${line.amount || '—'}" must be a positive number with up to two decimals.`);
    }
    setPosting(true);
    try {
      const payload = {
        companyId,
        ...(branchId ? { branchId } : {}),
        docType,
        ...(refNo.trim() ? { refNo: refNo.trim() } : {}),
        docDate,
        lines: lines.map((line) => ({
          accountCode: line.accountCode,
          amount: line.amount,
          transactionType: line.transactionType,
          ...(line.remarks.trim() ? { remarks: line.remarks.trim() } : {}),
        })),
      };
      const data = await read<PostResult>('/api/v1/ledger-batches', token, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(data);
      setLines([blankLine()]);
      setRefNo('');
      setHistoryRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post the ledger batch.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">LEDGER CAPTURE</small>
          <h1>Ledger capture</h1>
          <p>Post debit and credit lines to ledger accounts and review recent postings.</p>
        </div>
        <div className="heading-actions">
          <button className="btn btn-light" type="button" onClick={() => setHistoryRefresh((n) => n + 1)}>
            <RefreshCw size={14} className={historyLoading ? 'spinning' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {result && (
        <section className="table-panel" aria-label="Posting result">
          <div className="table-toolbar">
            <div className="count">
              <b>
                <CheckCircle2 size={14} /> Posted {result.docNo}
              </b>{' '}
              · {result.docType} · {result.docDate} · Period {result.period}
            </div>
            <button className="btn btn-light" type="button" onClick={() => setResult(null)} aria-label="Dismiss result">
              <X size={14} />
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Running debit balance</th>
                  <th>Running credit balance</th>
                </tr>
              </thead>
              <tbody>
                {result.balances.map((balance) => {
                  const posted = result.lines.filter((line) => line.accountCode === balance.accountCode);
                  const lineDebit = posted.reduce((s, l) => s + (l.transactionType === 'DB' ? toCents(l.amount) : 0), 0);
                  const lineCredit = posted.reduce((s, l) => s + (l.transactionType === 'CR' ? toCents(l.amount) : 0), 0);
                  return (
                    <tr key={balance.accountCode}>
                      <td className="primary-cell">
                        <b>{balance.accountCode}</b> {balance.accountName}
                      </td>
                      <td>{lineDebit ? formatCents(lineDebit) : '—'}</td>
                      <td>{lineCredit ? formatCents(lineCredit) : '—'}</td>
                      <td>{formatCents(toCents(balance.debitBalance))}</td>
                      <td>{formatCents(toCents(balance.creditBalance))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <form className="table-panel" onSubmit={post} noValidate>
        <div className="table-toolbar">
          <div className="count">
            <b>New ledger batch</b>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            Document type
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {docTypes.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Document number
            <input value="Assigned automatically when posted" disabled />
          </label>
          <label className="field">
            Reference number
            <input value={refNo} onChange={(e) => setRefNo(e.target.value)} maxLength={20} placeholder="Optional" />
          </label>
          <label className="field">
            Document date *
            <input type="date" required value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </label>
          <label className="field">
            Branch
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">No branch</option>
              {branches.map((b) => (
                <option key={b.branchId} value={b.branchId}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </label>

          <div className="field full line-items">
            <div className="line-items-head">
              <span>Lines</span>
              <button className="btn btn-light" type="button" onClick={() => setLines((rows) => [...rows, blankLine()])}>
                <Plus size={14} /> Add line
              </button>
            </div>
            {lines.map((line, index) => (
              <div key={line.id} className="line-item">
                <div className="line-item-fields">
                  <label className="field full">
                    Ledger account *
                    <AccountPicker
                      token={token}
                      companyId={companyId}
                      value={line.accountCode}
                      selectedLabel={line.accountCode ? `${line.accountCode} - ${line.accountName}` : ''}
                      onChange={(code, name) =>
                        setLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, accountCode: code, accountName: name } : r)))
                      }
                    />
                  </label>
                  <label className="field">
                    Amount *
                    <input
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d.]/g, '');
                        setLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, amount: value } : r)));
                      }}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="field">
                    Type
                    <select
                      value={line.transactionType}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) => (r.id === line.id ? { ...r, transactionType: e.target.value as 'DB' | 'CR' } : r)),
                        )
                      }
                    >
                      <option value="DB">DB — Debit</option>
                      <option value="CR">CR — Credit</option>
                    </select>
                  </label>
                  <label className="field">
                    Remarks
                    <input
                      value={line.remarks}
                      onChange={(e) =>
                        setLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, remarks: e.target.value.slice(0, 60) } : r)))
                      }
                      maxLength={60}
                    />
                  </label>
                </div>
                <button
                  className="btn btn-light"
                  type="button"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((rows) => rows.filter((r) => r.id !== line.id))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="report-filter-actions">
          <div className="count">
            Debits <b>{formatCents(debitCents)}</b> · Credits <b>{formatCents(creditCents)}</b> ·{' '}
            {difference === 0 ? (
              <span className="status paid">Balanced</span>
            ) : (
              <span className="status partial">Out of balance by {formatCents(Math.abs(difference))}</span>
            )}
          </div>
          <button className="btn btn-primary" type="submit" disabled={posting}>
            <CheckCircle2 size={15} /> {posting ? 'Posting…' : 'Post entry'}
          </button>
        </div>
      </form>

      <section className="table-panel" aria-label="Recent postings">
        <div className="table-toolbar">
          <label className="field" style={{ minWidth: 260 }}>
            <span className="combobox-search-icon" aria-hidden>
              <Search size={13} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents or accounts…"
            />
          </label>
          <div className="count">
            <b>{history?.total ?? 0}</b> Postings
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Doc no</th>
                <th>Type</th>
                <th>Account</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Loading postings…
                  </td>
                </tr>
              ) : history && history.items.length > 0 ? (
                history.items.map((row) => (
                  <tr key={row.historyId}>
                    <td>{typeof row.docDate === 'string' ? row.docDate.slice(0, 10) : new Date(row.docDate).toISOString().slice(0, 10)}</td>
                    <td className="primary-cell">
                      <b>{row.docNo}</b>
                      {row.refNo ? <small style={{ display: 'block', color: 'inherit', opacity: 0.65 }}>ref {row.refNo}</small> : null}
                    </td>
                    <td>
                      <span className="status draft">{row.docType}</span>
                    </td>
                    <td>
                      <b>{row.accountCode}</b> {row.accountName}
                    </td>
                    <td>{toCents(row.debitAmount) ? money(row.debitAmount) : '—'}</td>
                    <td>{toCents(row.creditAmount) ? money(row.creditAmount) : '—'}</td>
                    <td>{row.remarks || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty">
                    No postings found for this company yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {history && history.totalPages > 1 && (
          <div className="table-footer">
            <span>
              Showing page {history.page} of {history.totalPages}
            </span>
            <div className="pagination-controls">
              <button className="btn btn-light" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {history.totalPages}
              </span>
              <button className="btn btn-light" disabled={page >= history.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountPicker({
  token,
  companyId,
  value,
  selectedLabel,
  onChange,
}: {
  token: string;
  companyId: string;
  value: string;
  selectedLabel: string;
  onChange: (accountCode: string, accountName: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || !companyId) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ companyId, postable: 'true', limit: '20' });
      if (query.trim()) params.set('q', query.trim());
      read<{ items?: AccountOptionRaw[] } | AccountOptionRaw[]>(
        `/api/v1/accounts?${params}`,
        token,
        { signal: controller.signal },
      )
        .then((data) => {
          const items = Array.isArray(data) ? data : data.items ?? [];
          setOptions(items.map((a) => ({ value: String(a.accountCode), label: `${a.accountCode} - ${a.accountName}`, name: String(a.accountName) })));
          setHighlighted(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setOptions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, companyId, token]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  function select(opt: AccountOption) {
    onChange(opt.value, opt.name);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[highlighted]) select(options[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  const displayValue = open ? query : selectedLabel;

  return (
    <div className="combobox" ref={containerRef}>
      <div className={`combobox-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(true)}>
        <Search size={13} className="combobox-search-icon" />
        <input
          className="combobox-input"
          value={displayValue}
          placeholder="Search account code or name…"
          readOnly={!open}
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {value && !open ? (
          <button
            type="button"
            className="combobox-clear"
            aria-label="Clear account"
            onPointerDown={(e) => {
              e.stopPropagation();
              onChange('', '');
            }}
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
          ) : options.length === 0 ? (
            <li className="combobox-empty">No posting accounts match</li>
          ) : (
            options.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`combobox-option ${opt.value === value ? 'selected' : ''} ${i === highlighted ? 'highlighted' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  select(opt);
                }}
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

type AccountOptionRaw = { accountCode: string; accountName: string };
