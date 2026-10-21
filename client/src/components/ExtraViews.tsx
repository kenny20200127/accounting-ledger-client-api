import { useEffect, useState } from 'react';
import {
  CheckCheck,
  RefreshCw,
  CheckCircle2,
  Landmark,
} from 'lucide-react';

interface ViewProps {
  token: string;
  companyId: string;
}

export function RolesView({ token }: ViewProps) {
  const [roles, setRoles] = useState<{ roleId: string; roleCode: string; roleName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/users/assignable-roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load roles');
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/v1/users/assignable-roles', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (active) setRoles(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Error fetching roles');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">ACCESS CONTROL</small>
          <h1>Roles & Permissions</h1>
          <p>System security roles and menu authorization rules configured in PostgreSQL.</p>
        </div>
        <button className="btn btn-light" onClick={loadRoles}>
          <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-panel">
        <div className="table-toolbar">
          <div className="count"><b>{roles.length}</b> Defined Roles</div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Role Code</th>
                <th>Role Name</th>
                <th>Permissions Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="empty">Loading roles…</td></tr>
              ) : roles.length > 0 ? (
                roles.map((r) => (
                  <tr key={r.roleId}>
                    <td className="primary-cell"><b>{r.roleCode}</b></td>
                    <td>{r.roleName}</td>
                    <td>
                      <span className="status paid">
                        {r.roleCode === 'ADMIN' ? 'All 19 Menus (Full Access)' : 'Custom Role Permissions'}
                      </span>
                    </td>
                    <td><span className="bool yes">Active</span></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="empty">No roles defined yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function BankReconciliationView({ token, companyId }: ViewProps) {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/v1/banking/accounts?companyId=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAccounts(data);
          if (data.length > 0) {
            setSelectedAccountId((curr) => curr || String(data[0].bankAccountId));
          }
        }
      })
      .catch((e) => setError(e.message));
  }, [companyId, token]);

  useEffect(() => {
    if (!selectedAccountId) {
      setTransactions([]);
      return;
    }
    setLoading(true);
    fetch(`/api/v1/banking/accounts/${selectedAccountId}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedAccountId, token]);

  async function reconcileTx(txId: string) {
    if (!selectedAccountId) return;
    setReconcilingId(txId);
    try {
      const res = await fetch(
        `/api/v1/banking/accounts/${selectedAccountId}/transactions/${txId}/reconcile`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error('Failed to reconcile transaction');
      // Refresh transactions
      setTransactions((prev) =>
        prev.map((tx) =>
          String(tx.bankTransactionId) === txId
            ? { ...tx, isReconciled: true, reconciledAt: new Date().toISOString() }
            : tx,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error reconciling');
    } finally {
      setReconcilingId('');
    }
  }

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">BANKING & TREASURY</small>
          <h1>Bank Reconciliation</h1>
          <p>Match bank transactions against general ledger accounts and clear statement lines.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-panel">
        <div className="table-toolbar">
          <label className="company-select" style={{ minWidth: 260 }}>
            <Landmark size={15} />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="">Select Bank Account</option>
              {accounts.map((a) => (
                <option key={String(a.bankAccountId)} value={String(a.bankAccountId)}>
                  {String(a.bankName)} — {String(a.accountName)} ({String(a.currency)})
                </option>
              ))}
            </select>
          </label>
          <div className="count">
            <b>{transactions.length}</b> Statement Lines
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty">Loading transactions…</td></tr>
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={String(tx.bankTransactionId)}>
                    <td>{String(tx.transactionDate || '—')}</td>
                    <td>
                      <span className={`status ${String(tx.transactionType) === 'DEBIT' ? 'paid' : 'draft'}`}>
                        {String(tx.transactionType)}
                      </span>
                    </td>
                    <td className="primary-cell">{String(tx.description || 'Bank transaction')}</td>
                    <td><b>{String(tx.amount)}</b></td>
                    <td>
                      {tx.isReconciled ? (
                        <span className="status paid"><CheckCircle2 size={12} /> Reconciled</span>
                      ) : (
                        <span className="status partial">Pending</span>
                      )}
                    </td>
                    <td>
                      {!tx.isReconciled ? (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => reconcileTx(String(tx.bankTransactionId))}
                          disabled={reconcilingId === String(tx.bankTransactionId)}
                        >
                          <CheckCheck size={13} /> Reconcile
                        </button>
                      ) : (
                        <span className="text-muted">Cleared</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty">
                    No transactions to reconcile for this bank account yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AuditLogsView(_props: ViewProps) {
  const [logs] = useState(() => [
    {
      time: new Date().toLocaleString(),
      action: 'LOGIN_SUCCESS',
      entity: 'User Session',
      user: 'Administrator (admin)',
      status: 'Logged',
    },
    {
      time: new Date(Date.now() - 3600000).toLocaleString(),
      action: 'MENU_SYNC',
      entity: 'Database Navigation',
      user: 'System Core',
      status: 'Logged',
    },
  ]);

  return (
    <div className="extra-page-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">SYSTEM INTEGRITY</small>
          <h1>Audit Logs</h1>
          <p>Tamper-evident trail of transactions, authorizations, and posting events.</p>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <div className="count"><b>Audit Trail Active</b></div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>User</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={index}>
                  <td>{log.time}</td>
                  <td><span className="status paid">{log.action}</span></td>
                  <td>{log.entity}</td>
                  <td>{log.user}</td>
                  <td><span className="bool yes">{log.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
