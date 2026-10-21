import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Building2,
  LogOut,
  ShieldCheck,
  Users,
  ListChecks,
  ClipboardList,
} from 'lucide-react';
import {
  CompanyAdministration,
  UserAdministration,
  RoleAdministration,
  AdministrationAudit,
} from './components/AdministrationViews';
import type { Company, Session } from './types';
import './App.css';
import './PlatformApp.css';
const tokenKey = 'ledger.platform.accessToken';
type Tab = 'companies' | 'users' | 'roles' | 'audit';
const tabs = [
  { id: 'companies' as const, label: 'Companies', icon: Building2 },
  { id: 'users' as const, label: 'Company Users', icon: Users },
  { id: 'roles' as const, label: 'Company Permissions', icon: ListChecks },
  { id: 'audit' as const, label: 'Administration Audit', icon: ClipboardList },
];
async function api<T>(
  path: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch('/api/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || 'Request failed.',
    );
  return data;
}
export default function PlatformApp() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState<Tab>('companies');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(!!token);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  function logout() {
    localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
    setCompanies([]);
    setCompanyId('');
    setTab('companies');
    setError('');
  }
  useEffect(() => {
    let live = true;
    if (!token) {
      setChecking(false);
      return;
    }
    setChecking(true);
    api<Session['user']>('auth/me', token)
      .then((u) => {
        if (!u.isPlatformAdmin)
          throw new Error('A platform administrator account is required.');
        if (live) setUser(u);
      })
      .catch((e) => {
        if (live) {
          localStorage.removeItem(tokenKey);
          setToken(null);
          setUser(null);
          setError(e.message);
        }
      })
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [token]);
  useEffect(() => {
    let live = true;
    if (!token || !user) return;
    api<Company[]>('platform/companies', token)
      .then((rows) => {
        if (live) {
          setCompanies(rows);
          setCompanyId((id) =>
            rows.some((c) => c.companyId === id)
              ? id
              : (rows[0]?.companyId ?? ''),
          );
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [token, user, refresh]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const session = await api<Session>('auth/platform/login', undefined, {
        identifier: form.get('identifier'),
        password: form.get('password'),
      });
      localStorage.setItem(tokenKey, session.accessToken);
      setToken(session.accessToken);
      setUser(session.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <div className="platform-loading">Opening platform administration...</div>
    );
  if (!token || !user)
    return (
      <main className="platform-login">
        <section className="platform-login-intro">
          <ShieldCheck size={40} />
          <span> NORTHSTAR PLATFORM</span>
          <h1>Company administration</h1>
          <p>
            Onboard companies, appoint their administrators, and manage access
            from one dedicated platform.
          </p>
          <a href="/">Go to company application</a>
        </section>
        <form className="platform-login-form" onSubmit={login}>
          <small>PLATFORM ADMINISTRATORS</small>
          <h2>Platform sign in</h2>
          <p>Use your platform administrator account.</p>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <label>
            Username or email
            <input name="identifier" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in to platform'}
          </button>
          <a href="/">Company user? Open the company application</a>
        </form>
      </main>
    );
  return (
    <div className="platform-app">
      <header className="platform-header">
        <div className="platform-identity">
          <ShieldCheck size={30} />
          <div>
            <strong>Northstar Platform</strong>
            <small>COMPANY ADMINISTRATION</small>
          </div>
        </div>
        <div className="platform-user">
          <span>{user.firstName ?? user.username}</span>
          <button onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>
      <div className="platform-body">
        <aside className="platform-navigation" aria-label="Platform navigation">
          <small>PLATFORM TOOLS</small>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? 'selected' : ''}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <p>
            Company accounting and reports are available in the separate company
            application.
          </p>
          <a href="/" target="_blank" rel="noreferrer">
            Open company application
          </a>
        </aside>
        <main className="platform-content">
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          {tab !== 'companies' && (
            <div className="platform-company-context">
              <label>
                Manage company
                <select
                  aria-label="Manage company"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">Select a company</option>
                  {companies.map((c) => (
                    <option key={c.companyId} value={c.companyId}>
                      {c.companyName}
                      {c.isActive ? '' : ' (Suspended)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {tab === 'companies' ? (
            <CompanyAdministration
              platform
              token={token}
              companyId={companyId}
              onSelect={setCompanyId}
              onChanged={() => setRefresh((n) => n + 1)}
              onManage={(id) => {
                setCompanyId(id);
                setTab('users');
              }}
            />
          ) : !companyId ? (
            <div className="platform-empty">
              Select a company to manage its administration.
            </div>
          ) : tab === 'users' ? (
            <UserAdministration
              key={companyId}
              platform
              token={token}
              companyId={companyId}
            />
          ) : tab === 'roles' ? (
            <RoleAdministration
              key={companyId}
              platform
              token={token}
              companyId={companyId}
            />
          ) : (
            <AdministrationAudit
              key={companyId}
              platform
              token={token}
              companyId={companyId}
            />
          )}
        </main>
      </div>
    </div>
  );
}
