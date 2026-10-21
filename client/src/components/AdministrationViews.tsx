import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { notifyCompanyBrandingChanged } from '../company-theme';
import type { Company } from '../types';
type Props = {
  token: string;
  companyId: string;
  platform?: boolean;
  onChanged?: () => void;
  onSelect?: (id: string) => void;
  onManage?: (id: string) => void;
};
async function fetchApi<T>(
  path: string,
  token: string,
  body?: unknown,
  method = 'GET',
): Promise<T> {
  const response = await fetch('/api/v1/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || 'Request failed.',
    );
  if (
    method !== 'GET' &&
    /^(?:platform\/)?companies(?:\/[^/?]+)?(?:\/logo)?$/.test(path)
  )
    notifyCompanyBrandingChanged(data.companyId ?? data.company?.companyId);
  return data;
}
function createPortalApi(platform: boolean, companyId: string) {
  return <T,>(
    path: string,
    token: string,
    body?: unknown,
    method = 'GET',
  ): Promise<T> => {
    if (platform) {
      const [route, search] = path.split('?');
      if (route === 'companies' || route.startsWith('companies/'))
        path = 'platform/' + route + (search ? '?' + search : '');
      else if (
        ['users', 'roles', 'audit-logs'].some(
          (prefix) => route === prefix || route.startsWith(prefix + '/'),
        )
      ) {
        const params = new URLSearchParams(search);
        params.delete('companyId');
        path =
          'platform/companies/' +
          companyId +
          '/' +
          route +
          (params.size ? '?' + params.toString() : '');
      }
    }
    return fetchApi<T>(path, token, body, method);
  };
}
const fields = [
  ['companyCode', 'Company code'],
  ['companyName', 'Company name'],
  ['registrationNumber', 'Registration number'],
  ['taxIdentificationNumber', 'Tax identification number'],
  ['industry', 'Industry'],
  ['website', 'Website'],
  ['email', 'Company email'],
  ['phone', 'Phone'],
  ['contactPerson', 'Contact person'],
  ['contactTitle', 'Contact title'],
  ['address', 'Street address'],
  ['city', 'City'],
  ['state', 'State'],
  ['postalCode', 'Postal code'],
  ['country', 'Country'],
  ['baseCurrency', 'Base currency'],
  ['fiscalYearStartMonth', 'Fiscal year start month'],
  ['fiscalYearStartDay', 'Fiscal year start day'],
  ['primaryColor', 'Primary color'],
  ['secondaryColor', 'Secondary color'],
];
const defaults: Record<string, string> = {
  country: 'Nigeria',
  baseCurrency: 'NGN',
  fiscalYearStartMonth: '1',
  fiscalYearStartDay: '1',
  primaryColor: '#176246',
  secondaryColor: '#edf5ef',
};
export function CompanyAdministration({
  token,
  companyId,
  platform = false,
  onChanged,
  onSelect,
  onManage,
}: Props) {
  const api = createPortalApi(platform, companyId);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editing, setEditing] = useState<string | null>(
    platform ? null : companyId,
  );
  const [form, setForm] = useState(defaults);
  const [admin, setAdmin] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<Company[]>('companies', token)
      .then((rows) => {
        if (!live) return;
        setCompanies(rows);
        if (!platform) {
          const c = rows.find((c) => c.companyId === companyId);
          if (c) {
            setEditing(c.companyId);
            setForm(
              Object.fromEntries(
                fields.map(([key]) => [
                  key,
                  String(
                    (c as unknown as Record<string, unknown>)[key] ??
                      defaults[key] ??
                      '',
                  ),
                ]),
              ),
            );
          }
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [token, companyId, platform, tick]);
  function edit(c: Company) {
    setEditing(c.companyId);
    setForm(
      Object.fromEntries(
        fields.map(([key]) => [
          key,
          String(
            (c as unknown as Record<string, unknown>)[key] ??
              defaults[key] ??
              '',
          ),
        ]),
      ),
    );
    setLogo(null);
    setError('');
    setMessage('');
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    let cid = editing;
    try {
      const body: Record<string, unknown> = Object.fromEntries(
        Object.entries(form)
          .filter(([, v]) => editing || v !== '')
          .map(([k, v]) => [k, v === '' ? null : v]),
      );
      body.fiscalYearStartMonth = Number(form.fiscalYearStartMonth);
      body.fiscalYearStartDay = Number(form.fiscalYearStartDay);
      if (cid) await api('companies/' + cid, token, body, 'PATCH');
      else {
        const result = await api<{ company: Company }>(
          'platform/companies',
          token,
          {
            ...body,
            firstAdmin: Object.fromEntries(
              Object.entries(admin).filter(([, v]) => v !== ''),
            ),
            seedStandardAccounts: seed,
          },
          'POST',
        );
        cid = result.company.companyId;
        setEditing(cid);
        setAdmin({
          username: '',
          email: '',
          password: '',
          firstName: '',
          lastName: '',
        });
      }
      setMessage(
        editing
          ? 'Company details saved.'
          : 'Company onboarded. Share the username and initial password with its administrator.',
      );
      if (logo) {
        const data = new FormData();
        data.append('file', logo);
        try {
          await api('companies/' + cid + '/logo', token, data, 'POST');
          setLogo(null);
        } catch (e) {
          throw new Error(
            'Company saved, but logo upload failed: ' + (e as Error).message,
          );
        }
      }
      setTick((n) => n + 1);
      onChanged?.();
      if (cid) onSelect?.(cid);
    } catch (e) {
      setError((e as Error).message);
      setTick((n) => n + 1);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }
  async function status(c: Company) {
    setBusy(true);
    setError('');
    try {
      await api(
        'companies/' + c.companyId,
        token,
        { isActive: !c.isActive },
        'PATCH',
      );
      setTick((n) => n + 1);
      onChanged?.();
      setMessage(
        c.isActive
          ? 'Company suspended. Its users cannot sign in or continue existing sessions.'
          : 'Company activated.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const current = companies.find((c) => c.companyId === editing);
  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">
            {platform ? 'PLATFORM ADMINISTRATION' : 'COMPANY ADMINISTRATION'}
          </small>
          <h1>{platform ? 'Companies & Onboarding' : 'Company Settings'}</h1>
          <p>
            {platform
              ? 'Register companies, set their identity, and appoint the first administrator.'
              : 'Manage your company details and branding.'}
          </p>
        </div>
        {platform && (
          <button
            className="primary"
            onClick={() => {
              setEditing(null);
              setForm(defaults);
              setLogo(null);
              setError('');
              setMessage('');
            }}
          >
            New company
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="admin-notice">
          {message}
        </p>
      )}
      {platform && (
        <div className="admin-card">
          <h2>Registered companies</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.companyId}>
                    <td>
                      {c.logoData && (
                        <img
                          className="admin-table-logo"
                          src={c.logoData}
                          alt=""
                        />
                      )}
                      {c.companyName}
                    </td>
                    <td>{c.companyCode}</td>
                    <td>{c.isActive ? 'Active' : 'Suspended'}</td>
                    <td>
                      <button disabled={busy} onClick={() => edit(c)}>
                        Edit
                      </button>{' '}
                      <button
                        disabled={busy}
                        onClick={() => (onManage ?? onSelect)?.(c.companyId)}
                      >
                        Manage users
                      </button>{' '}
                      <button disabled={busy} onClick={() => status(c)}>
                        {c.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <form className="admin-card" onSubmit={submit}>
        <h2>{editing ? 'Company profile' : 'Onboard a company'}</h2>
        <div className="admin-form-grid">
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required={[
                  'companyCode',
                  'companyName',
                  'baseCurrency',
                  'fiscalYearStartMonth',
                  'fiscalYearStartDay',
                  'primaryColor',
                  'secondaryColor',
                ].includes(key)}
                type={
                  key.endsWith('Color')
                    ? 'color'
                    : key.startsWith('fiscalYear')
                      ? 'number'
                      : key === 'email'
                        ? 'email'
                        : 'text'
                }
                min={key.startsWith('fiscalYear') ? 1 : undefined}
                max={
                  key === 'fiscalYearStartMonth'
                    ? 12
                    : key === 'fiscalYearStartDay'
                      ? 28
                      : undefined
                }
                value={form[key] ?? ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div
          className="admin-brand-preview"
          style={{
            borderColor: form.primaryColor,
            backgroundColor: form.secondaryColor,
          }}
        >
          {current?.logoData && (
            <img src={current.logoData} alt="Company logo" />
          )}
          <strong style={{ color: form.primaryColor }}>
            {form.companyName || 'Company branding preview'}
          </strong>
        </div>
        <label>
          Company logo (PNG, JPEG, WebP; maximum 2 MB)
          <input
            key={editing ?? 'new'}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size > 2097152) {
                setError('Logo must be 2 MB or smaller.');
                e.target.value = '';
                return;
              }
              setLogo(f ?? null);
            }}
          />
        </label>
        {current?.logoData && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(
                  'companies/' + editing + '/logo',
                  token,
                  undefined,
                  'DELETE',
                );
                setTick((n) => n + 1);
                onChanged?.();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Remove logo
          </button>
        )}
        {!editing && (
          <>
            <h2>First company administrator</h2>
            <div className="admin-form-grid">
              {(
                [
                  'username',
                  'email',
                  'firstName',
                  'lastName',
                  'password',
                ] as const
              ).map((key) => (
                <label key={key}>
                  {key === 'password'
                    ? 'Initial password (at least 12 characters)'
                    : key.replace(/([A-Z])/g, ' $1')}
                  <input
                    type={
                      key === 'password'
                        ? 'password'
                        : key === 'email'
                          ? 'email'
                          : 'text'
                    }
                    autoComplete={key === 'password' ? 'new-password' : 'off'}
                    required={['username', 'email', 'password'].includes(key)}
                    minLength={key === 'password' ? 12 : undefined}
                    value={admin[key]}
                    onChange={(e) =>
                      setAdmin({ ...admin, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={seed}
                onChange={(e) => setSeed(e.target.checked)}
              />
              Create starter chart of accounts
            </label>
            <p>
              Creates an administrator, accountant and viewer roles, a head
              office, and 12 accounting periods. No financial transactions are
              copied.
            </p>
          </>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? 'Saving...'
            : editing
              ? 'Save company'
              : 'Create company and administrator'}
        </button>
      </form>
    </section>
  );
}
type Role = { roleId: string; roleName: string; isCompanyAdmin?: boolean };
type ManagedUser = {
  userId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  isPlatformAdmin: boolean;
  roles: Role[];
};
export function UserAdministration({
  token,
  companyId,
  platform = false,
}: Props) {
  const api = createPortalApi(platform, companyId);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [reset, setReset] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setEditing(null);
    setReset(null);
    setDeleting(null);
    setRoleIds([]);
    Promise.all([
      api<ManagedUser[]>('users?companyId=' + companyId, token),
      api<Role[]>('roles?companyId=' + companyId, token),
    ])
      .then(([u, r]) => {
        if (live) {
          setUsers(u);
          setRoles(r);
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [token, companyId, tick]);
  async function act(work: () => Promise<unknown>, text: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      setMessage(text);
      setTick((n) => n + 1);
      setForm({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
      });
      setRoleIds([]);
      setReset(null);
      setNewPassword('');
      setDeleting(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(u: ManagedUser) {
    setEditing(u);
    setForm({
      username: u.username,
      email: u.email,
      password: '',
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
    });
    setRoleIds(u.roles.map((r) => r.roleId));
    setReset(null);
    setDeleting(null);
  }
  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <small className="eyebrow">COMPANY ACCESS</small>
          <h1>Users</h1>
          <p>Create users and manage their roles, passwords and access.</p>
        </div>
        <button
          disabled={busy}
          onClick={() => {
            setEditing(null);
            setForm({
              username: '',
              email: '',
              password: '',
              firstName: '',
              lastName: '',
            });
            setRoleIds([]);
            setReset(null);
            setDeleting(null);
          }}
        >
          New user
        </button>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p className="admin-notice" role="status">
          {message}
        </p>
      )}
      <div className="admin-card table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>{u.roles.map((r) => r.roleName).join(', ')}</td>
                <td>{u.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  {u.isPlatformAdmin ? (
                    'Platform administrator'
                  ) : (
                    <>
                      <button disabled={busy} onClick={() => edit(u)}>
                        Edit
                      </button>{' '}
                      <button
                        disabled={busy}
                        onClick={() => {
                          setReset(u);
                          setNewPassword('');
                          setDeleting(null);
                        }}
                      >
                        Reset password
                      </button>{' '}
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(
                                'users/' + u.userId,
                                token,
                                { isActive: !u.isActive },
                                'PATCH',
                              ),
                            'User access updated.',
                          )
                        }
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {platform && (
                        <>
                          {' '}
                          <button
                            className="admin-delete-button"
                            disabled={busy}
                            onClick={() => {
                              setDeleting(u);
                              setReset(null);
                              setError('');
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deleting ? (
        <section
          className="admin-card admin-delete-confirmation"
          role="alertdialog"
          aria-labelledby="delete-user-title"
          aria-describedby="delete-user-description"
        >
          <h2 id="delete-user-title">Delete {deleting.username}?</h2>
          <p id="delete-user-description">
            This removes the user from the list and revokes their login and
            active sessions. Their accounting records and audit history are
            preserved.
          </p>
          <div>
            <button
              className="admin-delete-button"
              disabled={busy}
              onClick={() =>
                act(
                  () =>
                    api('users/' + deleting.userId, token, undefined, 'DELETE'),
                  'User deleted. Accounting records and audit history are preserved.',
                )
              }
            >
              {busy ? 'Deleting...' : 'Delete user'}
            </button>{' '}
            <button disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : reset ? (
        <form
          className="admin-card"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () =>
                api(
                  'users/' + reset.userId + '/reset-password',
                  token,
                  { password: newPassword },
                  'POST',
                ),
              'Password reset. Existing sessions have been revoked.',
            );
          }}
        >
          <h2>Reset password for {reset.username}</h2>
          <label>
            New password
            <input
              required
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            Reset password
          </button>
          <button type="button" onClick={() => setReset(null)}>
            Cancel
          </button>
        </form>
      ) : (
        <form
          className="admin-card"
          onSubmit={(e) => {
            e.preventDefault();
            const body = Object.fromEntries(
              Object.entries(form)
                .filter(([k, v]) => (editing ? k !== 'password' : v !== ''))
                .map(([k, v]) => [k, v === '' ? null : v]),
            );
            act(
              () =>
                api(
                  editing ? 'users/' + editing.userId : 'users',
                  token,
                  { ...body, ...(!editing ? { companyId } : {}), roleIds },
                  editing ? 'PATCH' : 'POST',
                ),
              editing
                ? 'User updated. They must sign in again.'
                : 'User created.',
            );
          }}
        >
          <h2>{editing ? 'Edit ' + editing.username : 'Create user'}</h2>
          <div className="admin-form-grid">
            {(
              [
                'username',
                'email',
                'firstName',
                'lastName',
                'password',
              ] as const
            )
              .filter((k) => !editing || k !== 'password')
              .map((key) => (
                <label key={key}>
                  {key.replace(/([A-Z])/g, ' $1')}
                  <input
                    required={['username', 'email', 'password'].includes(key)}
                    type={
                      key === 'password'
                        ? 'password'
                        : key === 'email'
                          ? 'email'
                          : 'text'
                    }
                    minLength={key === 'password' ? 12 : undefined}
                    maxLength={key === 'password' ? 128 : 100}
                    autoComplete={key === 'password' ? 'new-password' : 'off'}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
          </div>
          <fieldset>
            <legend>Company roles</legend>
            {roles.map((r) => (
              <label className="admin-check" key={r.roleId}>
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.roleId)}
                  onChange={(e) =>
                    setRoleIds(
                      e.target.checked
                        ? [...roleIds, r.roleId]
                        : roleIds.filter((id) => id !== r.roleId),
                    )
                  }
                />
                {r.roleName}
              </label>
            ))}
          </fieldset>
          <button disabled={busy || roleIds.length === 0} className="primary">
            {busy ? 'Saving...' : editing ? 'Save user' : 'Create user'}
          </button>
        </form>
      )}
    </section>
  );
}
type Permission = {
  menuId: string;
  menuName: string;
  menuCode: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
};
const actions = [
  'canView',
  'canCreate',
  'canEdit',
  'canDelete',
  'canApprove',
] as const;
export function RoleAdministration({
  token,
  companyId,
  platform = false,
}: Props) {
  const api = createPortalApi(platform, companyId);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<Role[]>('roles?companyId=' + companyId, token)
      .then((r) => {
        if (live) {
          setRoles(r);
          setSelected('');
          setName('');
          if (r[0])
            api<Permission[]>('roles/' + r[0].roleId + '/permissions', token)
              .then(
                (p) =>
                  live &&
                  setPermissions(
                    p.map((x) => ({
                      ...x,
                      canView: false,
                      canCreate: false,
                      canEdit: false,
                      canDelete: false,
                      canApprove: false,
                    })),
                  ),
              )
              .catch((e) => live && setError(e.message));
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [token, companyId, tick]);
  async function select(id: string) {
    setSelected(id);
    setName(roles.find((r) => r.roleId === id)?.roleName ?? '');
    setError('');
    if (!id) {
      setPermissions((p) =>
        p.map((x) => ({
          ...x,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canApprove: false,
        })),
      );
      return;
    }
    setBusy(true);
    try {
      setPermissions(
        await api<Permission[]>('roles/' + id + '/permissions', token),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const immutable = roles.find((r) => r.roleId === selected)?.isCompanyAdmin;
  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Set the menus and actions each company role can use.</p>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p className="admin-notice" role="status">
          {message}
        </p>
      )}
      <form
        className="admin-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api(
              selected ? 'roles/' + selected : 'roles',
              token,
              {
                companyId,
                roleName: name,
                permissions: permissions.map(
                  ({ menuName, menuCode, ...p }) => p,
                ),
              },
              selected ? 'PATCH' : 'POST',
            );
            setMessage('Role permissions saved.');
            setTick((n) => n + 1);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="admin-form-grid">
          <label>
            Role
            <select
              disabled={busy}
              value={selected}
              onChange={(e) => select(e.target.value)}
            >
              <option value="">Create a new role</option>
              {roles.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  {r.roleName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role name
            <input
              required
              minLength={2}
              maxLength={100}
              disabled={immutable}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>
        {immutable && (
          <p>The built-in company administrator retains full company access.</p>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Menu</th>
                {actions.map((a) => (
                  <th key={a}>{a.slice(3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.menuId}>
                  <td>{p.menuName}</td>
                  {actions.map((a) => (
                    <td key={a}>
                      <input
                        aria-label={p.menuName + ' ' + a.slice(3)}
                        type="checkbox"
                        disabled={busy || immutable}
                        checked={p[a]}
                        onChange={(e) =>
                          setPermissions((rows) =>
                            rows.map((row) =>
                              row.menuId === p.menuId
                                ? {
                                    ...row,
                                    [a]: e.target.checked,
                                    ...(a === 'canView' && !e.target.checked
                                      ? {
                                          canCreate: false,
                                          canEdit: false,
                                          canDelete: false,
                                          canApprove: false,
                                        }
                                      : {}),
                                    ...(a !== 'canView' && e.target.checked
                                      ? { canView: true }
                                      : {}),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="primary" disabled={busy || immutable}>
          {busy ? 'Saving...' : selected ? 'Save permissions' : 'Create role'}
        </button>
      </form>
    </section>
  );
}
export function AdministrationAudit({
  token,
  companyId,
  platform = false,
}: Props) {
  const api = createPortalApi(platform, companyId);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: {
      auditId: string;
      action: string;
      username: string;
      createdAt: string;
      newValues: object;
    }[];
    total: number;
    totalPages: number;
  }>({ items: [], total: 0, totalPages: 0 });
  const [error, setError] = useState('');
  useEffect(() => setPage(1), [companyId]);
  useEffect(() => {
    let live = true;
    api<typeof data>(
      'audit-logs?companyId=' + companyId + '&page=' + page + '&limit=25',
      token,
    )
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [token, companyId, page]);
  return (
    <section className="admin-view">
      <div className="page-heading">
        <div>
          <h1>Audit Log</h1>
          <p>Recorded company and user administration actions.</p>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="admin-card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.auditId}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.username}</td>
                <td>{row.action.replaceAll('_', ' ')}</td>
                <td>{JSON.stringify(row.newValues)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.items.length && (
          <p>No administration actions recorded for this company yet.</p>
        )}
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, data.totalPages)} &middot; {data.total}{' '}
            actions
          </span>
          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
