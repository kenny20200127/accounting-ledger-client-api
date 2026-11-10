import { ExecutionContext, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AdministrationService } from '../administration/administration.service';
import { UpdateCompanyMenusDto } from '../administration/admin.dto';
import { Actor, TenantAccessService } from '../administration/tenant-access.service';
import { RoleMenu } from '../roles/role-menu.entity';
import { Menu } from '../roles/menu.entity';
import { UserRole } from '../users/user-role.entity';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { MenuAccessGuard } from './menu-access.guard';

jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => undefined }));
jest.mock('@nestjs/mapped-types', () => ({ PartialType: () => class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

const companyId = '00000000-0000-4000-8000-000000000001';
const otherCompanyId = '00000000-0000-4000-8000-000000000002';
const menuId = 'aaaaaaaa-0000-4000-8000-000000000001';
const actor: Actor = {
  userId: '00000000-0000-4000-8000-000000000003', companyId,
  isPlatformAdmin: false, isCompanyAdmin: true, authVersion: 1,
};
const platform: Actor = { ...actor, companyId: null, isPlatformAdmin: true };

function context(path: string, method = 'GET', currentActor = actor) {
  return { switchToHttp: () => ({ getRequest: () => ({
    path, method, actor: currentActor, user: { sub: currentActor.userId },
  }) }) } as ExecutionContext;
}

function guardFixture() {
  const disabled = new Map<string, Set<string>>();
  const query = jest.fn(async (_sql: string, [cid, codes]: [string, string[]]) =>
    codes.filter((code) => !disabled.get(cid)?.has(code)).map((menuCode) => ({ menuCode })),
  );
  const userRoles = { find: jest.fn().mockResolvedValue([
    { roleId: 'admin-role', role: { companyId } },
    { roleId: 'other-role', role: { companyId: otherCompanyId } },
  ]) };
  const roleMenus = { find: jest.fn().mockResolvedValue([
    { menu: { menuCode: 'REPORTS' }, canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
    { menu: { menuCode: 'BANKING' }, canView: true, canApprove: true },
    { menu: { menuCode: 'CUSTOMERS' }, canView: true },
  ]) };
  const guard = new MenuAccessGuard(
    userRoles as unknown as Repository<UserRole>,
    roleMenus as unknown as Repository<RoleMenu>,
    { query } as unknown as DataSource,
  );
  return { guard, query, disabled, userRoles, roleMenus };
}

describe('company menu API ceiling', () => {
  it.each(['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'])(
    'blocks %s despite the company administrator role granting access', async (method) => {
      const f = guardFixture();
      f.disabled.set(companyId, new Set(['REPORTS']));
      await expect(f.guard.canActivate(context('/api/v1/reports/financial', method)))
        .rejects.toThrow('disabled for your company');
      expect(f.roleMenus.find).not.toHaveBeenCalled();
      expect(f.query).toHaveBeenCalledWith(expect.stringContaining('s.company_id=$1'), [companyId, ['REPORTS']]);
      expect(f.query.mock.calls[0][0]).toContain('m.is_active');
    },
  );

  it('reads the setting on every request and allows reenabling without changing role grants', async () => {
    const f = guardFixture();
    const request = context('/api/v1/reports/financial');
    await expect(f.guard.canActivate(request)).resolves.toBe(true);
    f.disabled.set(companyId, new Set(['REPORTS']));
    await expect(f.guard.canActivate(request)).rejects.toThrow(ForbiddenException);
    f.disabled.clear();
    await expect(f.guard.canActivate(request)).resolves.toBe(true);
    expect(f.query).toHaveBeenCalledTimes(3);
  });

  it('does not apply another company setting to the current company', async () => {
    const f = guardFixture();
    f.disabled.set(otherCompanyId, new Set(['REPORTS']));
    await expect(f.guard.canActivate(context('/api/v1/reports/financial'))).resolves.toBe(true);
  });

  it('still requires role action permission for an enabled menu', async () => {
    const f = guardFixture();
    f.roleMenus.find.mockResolvedValue([]);
    await expect(f.guard.canActivate(context('/api/v1/reports/financial')))
      .rejects.toThrow('permission for this menu action');
  });

  it('rejects an unmapped route', async () => {
    const f = guardFixture();
    await expect(f.guard.canActivate(context('/api/v1/unknown'))).rejects.toThrow('No menu access mapping');
  });

  it.each([
    ['/api/v1/banking/accounts/bank/transactions/transaction/reconcile', 'PATCH', 'BANK_RECONCILIATION'],
    ['/api/v1/customers/customer/payments', 'GET', 'PAYMENTS'],
  ])('blocks disabled functionality through nested route %s', async (path, method, code) => {
    const f = guardFixture();
    f.disabled.set(companyId, new Set([code]));
    await expect(f.guard.canActivate(context(path, method))).rejects.toThrow('disabled for your company');
  });

  it('keeps platform management and scoped workspace identity reads available', async () => {
    const f = guardFixture();
    await expect(f.guard.canActivate(context('/api/v1/platform/companies/company/menus', 'PATCH', platform))).resolves.toBe(true);
    await expect(f.guard.canActivate(context('/api/v1/companies'))).resolves.toBe(true);
    await expect(f.guard.canActivate(context('/api/v1/auth/menus'))).resolves.toBe(true);
    expect(f.query).not.toHaveBeenCalled();
  });

  it('fails closed when the settings database is unavailable', async () => {
    const f = guardFixture();
    f.query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(f.guard.canActivate(context('/api/v1/reports/financial'))).rejects.toThrow('database unavailable');
    expect(f.roleMenus.find).not.toHaveBeenCalled();
  });
});

function administrationFixture() {
  const catalogue = [{ menuId, menuCode: 'REPORTS', menuName: 'Reports', isEnabled: true }];
  const settings = new Map<string, boolean>();
  const repo = {
    findOneBy: jest.fn().mockResolvedValue({ companyId }),
    findOne: jest.fn().mockResolvedValue({ companyId }),
  };
  const query = jest.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes('INSERT INTO core.company_menu_settings')) {
      settings.set(`${params[0]}:${params[1]}`, params[2] as boolean);
      return [];
    }
    if (sql.includes('FROM core.menus m'))
      return catalogue.map((row) => ({ ...row, isEnabled: settings.get(`${params[0]}:${row.menuId}`) ?? true }));
    if (sql.includes('INSERT INTO audit.audit_logs')) return [];
    throw new Error('Unexpected query: ' + sql);
  });
  const manager = { getRepository: jest.fn(() => repo), query };
  const ds = {
    manager, getRepository: jest.fn(() => repo), query,
    transaction: jest.fn(async (run: (m: EntityManager) => Promise<unknown>) => run(manager as unknown as EntityManager)),
  };
  const access = { admin: jest.fn() } as unknown as TenantAccessService;
  const service = new AdministrationService(ds as unknown as DataSource, access);
  return { service, ds, repo, query, settings };
}

describe('platform company menu administration', () => {
  it('rejects company administrators for both catalogue and updates', async () => {
    const f = administrationFixture();
    await expect(f.service.companyMenus(companyId, actor)).rejects.toThrow(ForbiddenException);
    await expect(f.service.updateCompanyMenus(companyId, { menus: [] }, actor)).rejects.toThrow(ForbiddenException);
    expect(f.ds.getRepository).not.toHaveBeenCalled();
    expect(f.ds.transaction).not.toHaveBeenCalled();
  });

  it('defaults missing settings to enabled and excludes platform/inactive menus', async () => {
    const f = administrationFixture();
    expect(await f.service.companyMenus(companyId, platform)).toEqual([
      { menuId, menuCode: 'REPORTS', menuName: 'Reports', isEnabled: true },
    ]);
    const sql = f.query.mock.calls[0][0];
    expect(sql).toContain('coalesce(s.is_enabled,true)');
    expect(sql).toContain('s.company_id=$1');
    expect(sql).toContain("m.is_active AND m.menu_code<>'PLATFORM_ADMIN'");
  });

  it('rejects nonexistent companies', async () => {
    const f = administrationFixture();
    f.repo.findOneBy.mockResolvedValue(null);
    f.repo.findOne.mockResolvedValue(null);
    await expect(f.service.companyMenus(companyId, platform)).rejects.toThrow('Company not found');
    await expect(f.service.updateCompanyMenus(companyId, { menus: [] }, platform)).rejects.toThrow('Company not found');
    expect(f.query).not.toHaveBeenCalled();
  });

  it('rejects duplicate UUIDs irrespective of case before writing', async () => {
    const f = administrationFixture();
    await expect(f.service.updateCompanyMenus(companyId, { menus: [
      { menuId, isEnabled: false }, { menuId: menuId.toUpperCase(), isEnabled: true },
    ] }, platform)).rejects.toThrow('Duplicate');
    expect(f.query).not.toHaveBeenCalled();
  });

  it('rejects IDs outside the active company menu catalogue without writes', async () => {
    const f = administrationFixture();
    await expect(f.service.updateCompanyMenus(companyId, { menus: [
      { menuId: otherCompanyId, isEnabled: false },
    ] }, platform)).rejects.toThrow('Invalid company menu');
    expect(f.query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  });

  it('locks the company, scopes toggles and audit, and preserves underlying role assignments', async () => {
    const f = administrationFixture();
    for (const isEnabled of [false, true]) {
      const result = await f.service.updateCompanyMenus(companyId, { menus: [{ menuId, isEnabled }] }, platform);
      expect(result[0].isEnabled).toBe(isEnabled);
    }
    expect(f.repo.findOne).toHaveBeenCalledWith({ where: { companyId }, lock: { mode: 'pessimistic_write' } });
    expect(f.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [companyId, menuId, false]);
    expect(f.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit.audit_logs'), [
      companyId, platform.userId, 'COMPANY_MENUS_UPDATED', companyId,
      JSON.stringify({ menus: [{ menuId, isEnabled: false }] }),
    ]);
    expect(f.query.mock.calls.some(([sql]) => /role_menus|user_roles/.test(sql))).toBe(false);
    expect((await f.service.companyMenus(otherCompanyId, platform))[0].isEnabled).toBe(true);
  });

  it('does not audit or write an empty patch', async () => {
    const f = administrationFixture();
    await f.service.updateCompanyMenus(companyId, { menus: [] }, platform);
    expect(f.query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  });
});

describe('company menu request validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const metadata = { type: 'body' as const, metatype: UpdateCompanyMenusDto };
  it.each([
    {}, { menus: null }, { menus: [null] }, { menus: [[]] },
    { menus: [{ menuId: 'bad', isEnabled: false }] },
    { menus: [{ menuId, isEnabled: 'false' }] },
    { menus: [{ menuId, isEnabled: false, companyId: otherCompanyId }] },
    { menus: Array.from({ length: 201 }, () => ({ menuId, isEnabled: false })) },
  ])('rejects malformed or oversized input %#', async (body) => {
    await expect(pipe.transform(body, metadata)).rejects.toThrow();
  });
  it('accepts boolean toggles and empty patches', async () => {
    for (const menus of [[], [{ menuId, isEnabled: false }]])
      await expect(pipe.transform({ menus }, metadata)).resolves.toEqual({ menus });
  });
});

describe('effective login menus', () => {
  it('applies the company ceiling while retaining role aggregation', async () => {
    const query = jest.fn().mockResolvedValue([{ menuCode: 'COMPANIES', menuName: 'Companies', canView: true }]);
    const menus = { find: jest.fn() };
    const access = { actor: jest.fn().mockResolvedValue(actor) };
    const auth = new AuthService(
      {} as Repository<User>, {} as Repository<UserRole>, menus as unknown as Repository<Menu>,
      {} as JwtService, access as unknown as TenantAccessService, { query } as unknown as DataSource,
    );
    expect(await auth.getUserMenus(actor.userId)).toEqual([{ menuCode: 'COMPANIES', menuName: 'Company Settings', canView: true }]);
    const [sql, parameters] = query.mock.calls[0];
    expect(parameters).toEqual([actor.userId, companyId]);
    expect(sql).toContain('r.company_id=$2');
    expect(sql).toContain('s.company_id=$2 AND s.menu_id=m.menu_id AND NOT s.is_enabled');
    expect(sql).toContain('HAVING bool_or(rm.can_view)');
    expect(sql).toContain('m.is_active');
    access.actor.mockResolvedValue(platform);
    menus.find.mockResolvedValue([{ menuCode: 'PLATFORM_ADMIN' }]);
    expect(await auth.getUserMenus(platform.userId)).toEqual([expect.objectContaining({ menuCode: 'PLATFORM_ADMIN', canView: true })]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
