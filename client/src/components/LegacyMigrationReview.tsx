import { useEffect, useState } from 'react';
interface Summary {
  journals: { postedCount: number; draftCount: number; postedDebit: string; postedCredit: string };
}
interface Issue { sourceTable: string; sourceKey: string; issues: string[]; journalEntryId: string | null }
interface IssuePage { total: number; items: Issue[] }
export function LegacyMigrationReview({ token, companyId, refresh }: { token: string; companyId: string; refresh: number }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState<IssuePage | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { setOffset(0); }, [companyId]);
  useEffect(() => {
    const controller = new AbortController();
    setSummary(null); setPage(null); setError('');
    if (!companyId) return () => controller.abort();
    setLoading(true);
    async function load() {
      const headers = { Authorization: `Bearer ${token}` };
      const base = `/api/v1/reports/legacy-migration?companyId=${encodeURIComponent(companyId)}`;
      async function read(url: string) {
        const response = await fetch(url, { headers, signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load legacy migration review.');
        return response.json();
      }
      try {
        const [nextSummary, nextPage] = await Promise.all([
          read(base), read(`/api/v1/reports/legacy-migration/issues?companyId=${encodeURIComponent(companyId)}&offset=${offset}&limit=20`),
        ]);
        if (!controller.signal.aborted) { setSummary(nextSummary); setPage(nextPage); }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load migration review.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [token, companyId, refresh, offset]);
  if (!companyId) return null;
  return <section className="table-panel" style={{ marginBottom: 24 }} aria-label="Legacy migration review">
    <div style={{ padding: 20 }}>
      <h2>Legacy account migration</h2>
      {loading && <p role="status">Loading migration review…</p>}
      {error && <p role="alert">{error}</p>}
      {summary && <p>{summary.journals.postedCount.toLocaleString()} vouchers posted · {page?.total.toLocaleString() ?? 0} need review</p>}
      <p>Records needing review remain drafts. Historical balance snapshots are stored separately from posted transactions.</p>
      {page && page.total === 0 && <p>No migration issues for this company.</p>}
    </div>
    {page && page.total > 0 && <>
      <div className="table-scroll"><table><thead><tr><th>Source</th><th>Voucher</th><th>Review reason</th></tr></thead>
        <tbody>{page.items.map(item => <tr key={`${item.sourceTable}:${item.sourceKey}`}>
          <td>{item.sourceTable}</td><td>{item.sourceKey}</td><td>{item.issues.join('; ')}</td>
        </tr>)}</tbody></table></div>
      <div style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
        <button className="btn btn-light" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</button>
        <span>{offset + 1}–{Math.min(offset + 20, page.total)} of {page.total}</span>
        <button className="btn btn-light" disabled={offset + 20 >= page.total || loading} onClick={() => setOffset(offset + 20)}>Next</button>
      </div>
    </>}
  </section>;
}
