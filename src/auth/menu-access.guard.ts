import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RoleMenu } from '../roles/role-menu.entity';
import { UserRole } from '../users/user-role.entity';

const routeMenus: Record<string, string> = {
  platform: 'PLATFORM_ADMIN',
  companies: 'COMPANIES',
  branches: 'BRANCHES',
  'fiscal-years': 'FISCAL_YEARS',
  'accounting-periods': 'ACCOUNTING_PERIODS',
  accounts: 'CHART_OF_ACCOUNTS',
  'account-types': 'CHART_OF_ACCOUNTS',
  'account-categories': 'CHART_OF_ACCOUNTS',
  journals: 'JOURNAL_ENTRIES',
  'journal-entries': 'JOURNAL_ENTRIES',
  customers: 'CUSTOMERS',
  suppliers: 'SUPPLIERS',
  invoices: 'INVOICES',
  payments: 'PAYMENTS',
  'customer-payments': 'PAYMENTS',
  banking: 'BANKING',
  'bank-accounts': 'BANKING',
  'bank-reconciliations': 'BANK_RECONCILIATION',
  'fixed-assets': 'FIXED_ASSETS',
  expenses: 'EXPENSES',
  users: 'USERS',
  roles: 'ROLES',
  'audit-logs': 'AUDIT_LOGS',
  reports: 'REPORTS',
  ledger: 'LEDGER',
  'ledger-batches': 'LEDGER',
};

type MenuPermission =
  'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canApprove';

@Injectable()
export class MenuAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(RoleMenu)
    private readonly roleMenus: Repository<RoleMenu>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = String(request.path ?? request.url ?? '').replace(
      /^\/api\/v\d+\/?/,
      '',
    );
    const firstSegment = path.split('/').filter(Boolean)[0];
    if (!firstSegment || firstSegment === 'auth') return true;
    if (
      request.actor?.isPlatformAdmin ||
      (firstSegment === 'companies' && request.method === 'GET')
    )
      return true;
    const menuCode = firstSegment ? routeMenus[firstSegment] : undefined;
    if (!menuCode)
      throw new ForbiddenException(
        'No menu access mapping exists for this route.',
      );

    const userId = request.user?.sub as string | undefined;
    if (!userId)
      throw new ForbiddenException('Authenticated user is required.');

    const userRoles = await this.userRoles.find({
      where: { userId },
      relations: { role: true },
    });
    const scoped = userRoles.filter(
      (ur) => ur.role.companyId === request.actor?.companyId,
    );
    userRoles.splice(0, userRoles.length, ...scoped);
    if (userRoles.length === 0) {
      throw new ForbiddenException('No roles are assigned to this user.');
    }

    const assignments = await this.roleMenus.find({
      where: { roleId: In(userRoles.map((userRole) => userRole.roleId)) },
      relations: { menu: true },
    });
    const permission = requiredPermission(request.method, path);
    const allowed = assignments.some(
      (assignment) =>
        assignment.menu.menuCode === menuCode && assignment[permission],
    );
    if (!allowed)
      throw new ForbiddenException(
        'You do not have permission for this menu action.',
      );
    return true;
  }
}

function requiredPermission(method: string, path: string): MenuPermission {
  if (/\/(post|reverse|close|reopen|reconcile)(\/|$)/i.test(path))
    return 'canApprove';
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
      return 'canView';
    case 'POST':
      return 'canCreate';
    case 'PUT':
    case 'PATCH':
      return 'canEdit';
    case 'DELETE':
      return 'canDelete';
    default:
      return 'canView';
  }
}
