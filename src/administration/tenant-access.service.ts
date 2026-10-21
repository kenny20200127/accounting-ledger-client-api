import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
export type Actor = {
  userId: string;
  companyId: string | null;
  isPlatformAdmin: boolean;
  isCompanyAdmin: boolean;
  authVersion: number;
};
const tables: Record<string, [string, string]> = {
  companyId: ['core.companies', 'company_id'],
  branchId: ['core.branches', 'branch_id'],
  fiscalYearId: ['accounting.fiscal_years', 'fiscal_year_id'],
  accountId: ['accounting.accounts', 'account_id'],
  journalEntryId: ['accounting.journal_entries', 'journal_entry_id'],
  customerId: ['sales.customers', 'customer_id'],
  supplierId: ['purchasing.suppliers', 'supplier_id'],
  invoiceId: ['sales.invoices', 'invoice_id'],
  userId: ['core.users', 'user_id'],
  roleId: ['core.roles', 'role_id'],
  expenseId: ['purchasing.expenses', 'expense_id'],
  assetId: ['assets.fixed_assets', 'asset_id'],
  paymentId: ['sales.customer_payments', 'payment_id'],
};
const routes: Record<string, string> = {
  companies: 'companyId',
  branches: 'branchId',
  'fiscal-years': 'fiscalYearId',
  'accounting-periods': 'periodId',
  accounts: 'accountId',
  journals: 'journalEntryId',
  customers: 'customerId',
  suppliers: 'supplierId',
  invoices: 'invoiceId',
  expenses: 'expenseId',
  'fixed-assets': 'assetId',
  'customer-payments': 'paymentId',
  users: 'userId',
  roles: 'roleId',
};
@Injectable()
export class TenantAccessService {
  constructor(private readonly ds: DataSource) {}
  async actor(userId: string): Promise<Actor> {
    const [u] = await this.ds.query(
      `SELECT u.user_id AS "userId",u.company_id AS "companyId",u.is_platform_admin AS "isPlatformAdmin",u.auth_version AS "authVersion",u.is_active,c.is_active AS company_active,
  EXISTS(SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.role_id=ur.role_id WHERE ur.user_id=u.user_id AND r.company_id=u.company_id AND r.is_company_admin) AS "isCompanyAdmin"
  FROM core.users u LEFT JOIN core.companies c ON c.company_id=u.company_id WHERE u.user_id=$1 AND u.deleted_at IS NULL`,
      [userId],
    );
    if (!u?.is_active || (!u.isPlatformAdmin && !u.company_active))
      throw new UnauthorizedException('User or company is inactive.');
    return {
      userId: u.userId,
      companyId: u.companyId,
      isPlatformAdmin: u.isPlatformAdmin,
      isCompanyAdmin: u.isCompanyAdmin,
      authVersion: u.authVersion,
    };
  }
  admin(actor: Actor) {
    if (!actor.isPlatformAdmin && !actor.isCompanyAdmin)
      throw new ForbiddenException('Company administrator access required.');
  }
  async owns(key: string, id: unknown, companyId: string) {
    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new BadRequestException('Invalid ' + key + '.');
    let query: string;
    if (key === 'periodId')
      query =
        'SELECT f.company_id FROM accounting.accounting_periods p JOIN accounting.fiscal_years f USING(fiscal_year_id) WHERE p.period_id=$1';
    else if (key === 'bankAccountId')
      query =
        'SELECT company_id FROM banking.bank_accounts WHERE bank_account_id=$1';
    else if (key === 'transactionId')
      query =
        'SELECT a.company_id FROM banking.bank_transactions t JOIN banking.bank_accounts a USING(bank_account_id) WHERE t.bank_transaction_id=$1';
    else {
      const spec = tables[key];
      if (!spec) return;
      query = `SELECT company_id FROM ${spec[0]} WHERE ${spec[1]}=$1`;
    }
    const [row] = await this.ds.query(query, [id]);
    if (!row || row.company_id !== companyId)
      throw new ForbiddenException('Record does not belong to this company.');
  }
}
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly access: TenantAccessService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest();
    const actor: Actor = req.actor;
    const segments = String(req.path)
      .replace(/^\/api\/v\d+\/?/, '')
      .split('/')
      .filter(Boolean);
    const route = segments[0];
    if (route === 'auth') return true;
    if (
      route === 'platform' ||
      ((route === 'account-types' || route === 'account-categories') &&
        req.method !== 'GET') ||
      (route === 'companies' && req.method === 'POST' && !req.params.id)
    ) {
      if (!actor.isPlatformAdmin)
        throw new ForbiddenException('Platform administrator access required.');
    }
    if (
      ['users', 'roles', 'audit-logs'].includes(route) ||
      (route === 'companies' && req.method !== 'GET')
    )
      this.access.admin(actor);
    // Scope lists before DTO validation; detail reads use the same ownership checks as writes.
    if (actor.isPlatformAdmin) return true;
    const cid = actor.companyId!;
    if (
      req.query.companyId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        req.query.companyId,
      )
    )
      throw new BadRequestException('Invalid companyId.');
    if (req.query.companyId && req.query.companyId !== cid)
      throw new ForbiddenException('Company access denied.');
    const key = routes[route];
    if (req.params.id && key) await this.access.owns(key, req.params.id, cid);
    if (route === 'banking') {
      if (req.params.id)
        await this.access.owns('bankAccountId', req.params.id, cid);
      if (req.params.transactionId)
        await this.access.owns('transactionId', req.params.transactionId, cid);
    }
    const walk = async (value: any): Promise<void> => {
      if (!value || typeof value !== 'object') return;
      for (const [field, v] of Object.entries(value)) {
        if (v === null || v === undefined || v === '') continue;
        if (field === 'createdBy' || field === 'userId') {
          if (v !== actor.userId)
            throw new ForbiddenException(
              'User attribution must match the session.',
            );
          continue;
        }
        const normalized = /AccountId$/.test(field) ? 'accountId' : field;
        if (field === 'bankAccountId') await this.access.owns(field, v, cid);
        else if (tables[normalized] || normalized === 'periodId')
          await this.access.owns(normalized, v, cid);
        else if (typeof v === 'object') await walk(v);
      }
    };
    await walk(req.query);
    await walk(req.body);
    if (route === 'companies' && req.body?.isActive !== undefined)
      throw new ForbiddenException(
        'Only platform administrators may suspend companies.',
      );
    return true;
  }
}
