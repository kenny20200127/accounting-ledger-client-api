import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { Company } from '../companies/company.entity';
import { Branch } from '../branches/branch.entity';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { FiscalYear } from '../fiscal-years/fiscal-year.entity';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { Account } from '../accounts/account.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Actor, TenantAccessService } from './tenant-access.service';
import {
  OnboardCompanyDto,
  SaveRoleDto,
  UpdateCompanyDto,
  UpdateUserDto,
} from './admin.dto';
@Injectable()
export class AdministrationService {
  constructor(
    private readonly ds: DataSource,
    private readonly access: TenantAccessService,
  ) {}
  async audit(
    m: EntityManager,
    actor: Actor,
    companyId: string,
    action: string,
    recordId: string,
    values: object = {},
  ) {
    await m.query(
      'INSERT INTO audit.audit_logs(company_id,user_id,action,record_id,new_values) VALUES($1,$2,$3,$4,$5)',
      [companyId, actor.userId, action, recordId, JSON.stringify(values)],
    );
  }
  scope(actor: Actor, companyId?: string) {
    const id = companyId ?? actor.companyId;
    if (!id) throw new BadRequestException('Select a company.');
    if (!actor.isPlatformAdmin && id !== actor.companyId)
      throw new ForbiddenException('Company access denied.');
    return id;
  }
  async companies(actor: Actor) {
    return this.ds.getRepository(Company).find({
      where: actor.isPlatformAdmin ? {} : { companyId: actor.companyId! },
      order: { companyName: 'ASC' },
    });
  }
  async onboard(dto: OnboardCompanyDto, actor: Actor) {
    if (!actor.isPlatformAdmin) throw new ForbiddenException();
    if (!dto.firstAdmin)
      throw new BadRequestException('First company administrator is required.');
    const passwordHash = await bcrypt.hash(dto.firstAdmin.password, 12);
    try {
      return await this.ds.transaction(async (m) => {
        const { firstAdmin, seedStandardAccounts, ...details } = dto;
        const company = await m.getRepository(Company).save(
          m.getRepository(Company).create({
            ...details,
            companyCode: details.companyCode.trim().toUpperCase(),
            baseCurrency: details.baseCurrency?.toUpperCase() ?? 'NGN',
          }),
        );
        const cid = company.companyId;
        const branch = await m.getRepository(Branch).save(
          m.getRepository(Branch).create({
            companyId: cid,
            branchCode: 'HQ',
            branchName: 'Head Office',
            isHeadOffice: true,
            address: company.address,
            city: company.city,
            state: company.state,
            email: company.email,
            phone: company.phone,
          }),
        );
        const menus = await m.query(
          "SELECT menu_id,menu_code FROM core.menus WHERE is_active AND menu_code<>'PLATFORM_ADMIN'",
        );
        const roles: Role[] = [];
        for (const [code, name] of [
          ['ADMIN', 'Company Administrator'],
          ['ACCOUNTANT', 'Accountant'],
          ['VIEWER', 'Viewer'],
        ]) {
          const role = await m.getRepository(Role).save(
            m.getRepository(Role).create({
              companyId: cid,
              roleCode: cid + ':' + code,
              roleName: name,
              isCompanyAdmin: code === 'ADMIN',
            }),
          );
          roles.push(role);
          for (const menu of menus) {
            const restricted = [
              'COMPANIES',
              'USERS',
              'ROLES',
              'AUDIT_LOGS',
            ].includes(menu.menu_code);
            const view = code === 'ADMIN' || !restricted;
            await m.query(
              'INSERT INTO core.role_menus(role_id,menu_id,can_view,can_create,can_edit,can_delete,can_approve) VALUES($1,$2,$3,$4,$4,$5,$4)',
              [
                role.roleId,
                menu.menu_id,
                view,
                view && code !== 'VIEWER',
                code === 'ADMIN',
              ],
            );
          }
        }
        const user = await m.getRepository(User).save(
          m.getRepository(User).create({
            ...firstAdmin,
            username: firstAdmin.username.trim().toLowerCase(),
            email: firstAdmin.email.trim().toLowerCase(),
            passwordHash,
            companyId: cid,
            branchId: branch.branchId,
            isPlatformAdmin: false,
          }),
        );
        await m.query(
          'INSERT INTO core.user_roles(user_id,role_id) VALUES($1,$2)',
          [user.userId, roles[0].roleId],
        );
        const today = new Date();
        const month = company.fiscalYearStartMonth - 1,
          day = company.fiscalYearStartDay;
        let year = today.getUTCFullYear();
        if (new Date(Date.UTC(year, month, day)) > today) year--;
        const date = (d: Date) => d.toISOString().slice(0, 10);
        const fy = await m.getRepository(FiscalYear).save(
          m.getRepository(FiscalYear).create({
            companyId: cid,
            yearName: 'FY ' + year + '/' + (year + 1),
            startDate: date(new Date(Date.UTC(year, month, day))),
            endDate: date(new Date(Date.UTC(year + 1, month, day - 1))),
          }),
        );
        for (let i = 0; i < 12; i++)
          await m.getRepository(AccountingPeriod).save(
            m.getRepository(AccountingPeriod).create({
              fiscalYearId: fy.fiscalYearId,
              periodNumber: i + 1,
              periodName: new Date(
                Date.UTC(year, month + i, day),
              ).toLocaleDateString('en-GB', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }),
              startDate: date(new Date(Date.UTC(year, month + i, day))),
              endDate: date(new Date(Date.UTC(year, month + i + 1, day - 1))),
            }),
          );
        if (seedStandardAccounts !== false) {
          const types = await m.query(
            'SELECT account_type_id,code FROM accounting.account_types',
          );
          const ids = new Map(types.map((t) => [t.code, t.account_type_id]));
          for (const [code, name, type] of [
            ['1000', 'Bank and Cash', 'ASSET'],
            ['1200', 'Trade Receivables', 'ASSET'],
            ['1500', 'Fixed Assets', 'ASSET'],
            ['1590', 'Accumulated Depreciation', 'ASSET'],
            ['2000', 'Trade Payables', 'LIABILITY'],
            ['3000', 'Owner Equity', 'EQUITY'],
            ['4000', 'Sales Revenue', 'REVENUE'],
            ['5000', 'Operating Expenses', 'EXPENSE'],
            ['5900', 'Depreciation Expense', 'EXPENSE'],
          ]) {
            if (!ids.get(type))
              throw new BadRequestException('Missing account type ' + type);
            await m.getRepository(Account).save(
              m.getRepository(Account).create({
                companyId: cid,
                accountCode: code,
                accountName: name,
                accountTypeId: ids.get(type) as string,
                isControlAccount: ['1200', '2000'].includes(code),
              }),
            );
          }
        }
        await this.audit(m, actor, cid, 'COMPANY_ONBOARDED', cid, {
          companyCode: company.companyCode,
          administrator: user.username,
        });
        return {
          company,
          administrator: {
            userId: user.userId,
            username: user.username,
            email: user.email,
          },
          roles,
          branch,
          fiscalYear: fy,
        };
      });
    } catch (e) {
      this.conflict(e);
    }
  }
  async updateCompany(id: string, dto: UpdateCompanyDto, actor: Actor) {
    this.access.admin(actor);
    this.scope(actor, id);
    if (dto.isActive !== undefined && !actor.isPlatformAdmin)
      throw new ForbiddenException(
        'Only platform administrators may change company status.',
      );
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(Company);
      const company = await repo.findOne({
        where: { companyId: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!company) throw new NotFoundException('Company not found.');
      // Currency becomes immutable after financial activity to preserve historical amounts.
      if (
        dto.baseCurrency &&
        dto.baseCurrency.toUpperCase() !== company.baseCurrency
      ) {
        const [row] = await m.query(
          'SELECT EXISTS(SELECT 1 FROM accounting.journal_entries WHERE company_id=$1) AS used',
          [id],
        );
        if (row.used)
          throw new BadRequestException(
            'Currency cannot change after journals have been recorded.',
          );
      }
      Object.assign(company, dto);
      if (dto.companyCode)
        company.companyCode = dto.companyCode.trim().toUpperCase();
      if (dto.baseCurrency)
        company.baseCurrency = dto.baseCurrency.toUpperCase();
      try {
        const saved = await repo.save(company);
        await this.audit(m, actor, id, 'COMPANY_UPDATED', id, dto);
        return saved;
      } catch (e) {
        this.conflict(e);
      }
    });
  }
  async logo(id: string, file: { buffer: Buffer } | undefined, actor: Actor) {
    this.access.admin(actor);
    this.scope(actor, id);
    if (!file?.buffer)
      throw new BadRequestException('Choose a PNG, JPEG, or WebP logo.');
    let buffer: Buffer;
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 16000000,
        animated: false,
      });
      const meta = await image.metadata();
      if (!['png', 'jpeg', 'webp'].includes(meta.format!)) throw new Error();
      buffer = await image
        .rotate()
        .resize({
          width: 512,
          height: 512,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Invalid logo. Use PNG, JPEG, or WebP up to 2 MB and 16 megapixels.',
      );
    }
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(Company);
      const company = await repo.findOneBy({ companyId: id });
      if (!company) throw new NotFoundException();
      company.logoData = 'data:image/png;base64,' + buffer.toString('base64');
      await repo.save(company);
      await this.audit(m, actor, id, 'COMPANY_LOGO_UPDATED', id, {
        logoChanged: true,
      });
      return company;
    });
  }
  async removeLogo(id: string, actor: Actor) {
    this.access.admin(actor);
    this.scope(actor, id);
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(Company);
      const c = await repo.findOneBy({ companyId: id });
      if (!c) throw new NotFoundException();
      c.logoData = null;
      await repo.save(c);
      await this.audit(m, actor, id, 'COMPANY_LOGO_REMOVED', id);
      return c;
    });
  }
  async roles(actor: Actor, companyId?: string) {
    this.access.admin(actor);
    const cid = this.scope(actor, companyId);
    return this.ds
      .getRepository(Role)
      .find({ where: { companyId: cid }, order: { roleName: 'ASC' } });
  }
  async rolePermissions(id: string, actor: Actor) {
    const role = await this.ds.getRepository(Role).findOneBy({ roleId: id });
    if (!role?.companyId)
      throw new ForbiddenException(
        'Global roles are reserved for platform access.',
      );
    this.access.admin(actor);
    this.scope(actor, role.companyId);
    return this.ds.query(
      `SELECT m.menu_id AS "menuId",m.menu_name AS "menuName",m.menu_code AS "menuCode",coalesce(r.can_view,false) AS "canView",coalesce(r.can_create,false) AS "canCreate",coalesce(r.can_edit,false) AS "canEdit",coalesce(r.can_delete,false) AS "canDelete",coalesce(r.can_approve,false) AS "canApprove" FROM core.menus m LEFT JOIN core.role_menus r ON r.menu_id=m.menu_id AND r.role_id=$1 WHERE m.is_active AND m.menu_code<>'PLATFORM_ADMIN' ORDER BY m.display_order`,
      [id],
    );
  }
  async saveRole(dto: SaveRoleDto, actor: Actor, id?: string) {
    this.access.admin(actor);
    const cid = this.scope(actor, dto.companyId);
    return this.ds.transaction(async (m) => {
      let role = id
        ? await m.getRepository(Role).findOneBy({ roleId: id })
        : null;
      if (id && (!role || role.companyId !== cid))
        throw new ForbiddenException();
      if (role?.isCompanyAdmin)
        throw new BadRequestException(
          'The built-in company administrator role cannot be edited.',
        );
      const available = await m.query(
        "SELECT menu_id FROM core.menus WHERE is_active AND menu_code<>'PLATFORM_ADMIN'",
      );
      const allowed = new Set(available.map((row) => row.menu_id));
      if (
        new Set(dto.permissions.map((p) => p.menuId)).size !==
        dto.permissions.length
      )
        throw new BadRequestException('Duplicate menu permission.');
      if (dto.permissions.some((p) => !allowed.has(p.menuId)))
        throw new BadRequestException('Invalid company menu permission.');
      role = await m.getRepository(Role).save(
        m.getRepository(Role).create({
          ...role,
          companyId: cid,
          roleCode: role?.roleCode ?? cid + ':' + randomUUID(),
          roleName: dto.roleName,
          description: dto.description,
        }),
      );
      await m.query('DELETE FROM core.role_menus WHERE role_id=$1', [
        role.roleId,
      ]);
      for (const p of dto.permissions)
        await m.query(
          'INSERT INTO core.role_menus(role_id,menu_id,can_view,can_create,can_edit,can_delete,can_approve) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            role.roleId,
            p.menuId,
            p.canView,
            p.canView && p.canCreate,
            p.canView && p.canEdit,
            p.canView && p.canDelete,
            p.canView && p.canApprove,
          ],
        );
      await this.audit(
        m,
        actor,
        cid,
        id ? 'ROLE_UPDATED' : 'ROLE_CREATED',
        role.roleId,
        { roleName: role.roleName },
      );
      return role;
    });
  }
  async users(actor: Actor, companyId?: string) {
    this.access.admin(actor);
    const cid = this.scope(actor, companyId);
    return this.ds.query(
      `SELECT u.user_id AS "userId",u.company_id AS "companyId",u.branch_id AS "branchId",u.username,u.email,u.first_name AS "firstName",u.last_name AS "lastName",u.is_active AS "isActive",u.is_platform_admin AS "isPlatformAdmin",coalesce(jsonb_agg(jsonb_build_object('roleId',r.role_id,'roleName',r.role_name,'roleCode',r.role_code)) FILTER(WHERE r.role_id IS NOT NULL),'[]'::jsonb) AS roles FROM core.users u LEFT JOIN core.user_roles ur USING(user_id) LEFT JOIN core.roles r USING(role_id) WHERE u.company_id=$1 AND u.deleted_at IS NULL GROUP BY u.user_id ORDER BY u.username`,
      [cid],
    );
  }
  async validRoles(m: EntityManager, ids: string[], cid: string) {
    const unique = [...new Set(ids)];
    const roles = await m.query(
      'SELECT role_id,is_company_admin FROM core.roles WHERE role_id=ANY($1::uuid[]) AND company_id=$2',
      [unique, cid],
    );
    if (roles.length !== unique.length || !roles.length)
      throw new BadRequestException('Choose roles belonging to this company.');
    return roles;
  }
  async createUser(dto: CreateUserDto, actor: Actor) {
    this.access.admin(actor);
    const cid = this.scope(actor, dto.companyId);
    if (dto.branchId) await this.access.owns('branchId', dto.branchId, cid);
    const hash = await bcrypt.hash(dto.password, 12);
    try {
      return await this.ds.transaction(async (m) => {
        await m.query(
          'SELECT company_id FROM core.companies WHERE company_id=$1 FOR UPDATE',
          [cid],
        );
        await this.validRoles(m, dto.roleIds, cid);
        const { roleIds, password, ...details } = dto;
        const user = await m.getRepository(User).save(
          m.getRepository(User).create({
            ...details,
            companyId: cid,
            username: dto.username.trim().toLowerCase(),
            email: dto.email.trim().toLowerCase(),
            passwordHash: hash,
            isPlatformAdmin: false,
          }),
        );
        for (const id of new Set(roleIds))
          await m.query(
            'INSERT INTO core.user_roles(user_id,role_id) VALUES($1,$2)',
            [user.userId, id],
          );
        await this.audit(m, actor, cid, 'USER_CREATED', user.userId, {
          username: user.username,
          roleIds,
        });
        return {
          userId: user.userId,
          username: user.username,
          email: user.email,
        };
      });
    } catch (e) {
      this.conflict(e);
    }
  }
  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actor: Actor,
    password?: string,
  ) {
    this.access.admin(actor);
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    try {
      return await this.ds.transaction(async (m) => {
        const repo = m.getRepository(User);
        const user = await repo.findOneBy({ userId: id });
        if (!user?.companyId || user.deletedAt)
          throw new NotFoundException('User not found.');
        const cid = this.scope(actor, user.companyId);
        if (user.isPlatformAdmin)
          throw new ForbiddenException(
            'Platform accounts are managed outside company user administration.',
          );
        await m.query(
          'SELECT company_id FROM core.companies WHERE company_id=$1 FOR UPDATE',
          [cid],
        );
        Object.assign(
          user,
          await repo.findOne({
            where: { userId: id },
            lock: { mode: 'pessimistic_write' },
          }),
        );
        if(user.deletedAt)throw new NotFoundException('User not found.');
        if (dto.branchId) await this.access.owns('branchId', dto.branchId, cid);
        const newRoles = dto.roleIds
          ? await this.validRoles(m, dto.roleIds, cid)
          : undefined;
        const [prior] = await m.query(
          'SELECT EXISTS(SELECT 1 FROM core.user_roles ur JOIN core.roles r USING(role_id) WHERE ur.user_id=$1 AND r.company_id=$2 AND r.is_company_admin) AS admin',
          [id, cid],
        );
        if (
          user.isActive &&
          prior.admin &&
          (dto.isActive === false ||
            (newRoles && !newRoles.some((r) => r.is_company_admin)))
        ) {
          const [other] = await m.query(
            'SELECT EXISTS(SELECT 1 FROM core.users u JOIN core.user_roles ur USING(user_id) JOIN core.roles r USING(role_id) WHERE u.company_id=$1 AND u.user_id<>$2 AND u.is_active AND u.deleted_at IS NULL AND r.company_id=$1 AND r.is_company_admin) AS available',
            [cid, id],
          );
          if (!other.available)
            throw new BadRequestException(
              'Keep at least one active company administrator.',
            );
        }
        const { roleIds, ...fields } = dto;
        Object.assign(user, fields);
        if (dto.username) user.username = dto.username.trim().toLowerCase();
        if (dto.email) user.email = dto.email.trim().toLowerCase();
        user.authVersion++;
        if (passwordHash) user.passwordHash = passwordHash;
        await repo.save(user);
        if (roleIds) {
          await m.query('DELETE FROM core.user_roles WHERE user_id=$1', [id]);
          for (const rid of new Set(roleIds))
            await m.query(
              'INSERT INTO core.user_roles(user_id,role_id) VALUES($1,$2)',
              [id, rid],
            );
        }
        await this.audit(
          m,
          actor,
          cid,
          password ? 'USER_PASSWORD_RESET' : 'USER_UPDATED',
          id,
          password ? { passwordReset: true } : dto,
        );
        return { userId: id, username: user.username, isActive: user.isActive };
      });
    } catch (e) {
      this.conflict(e);
    }
  }
  async deleteUser(id: string, actor: Actor) {
    if (!actor.isPlatformAdmin)
      throw new ForbiddenException('Platform administrator access required.');
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(User);
      const initial = await repo.findOneBy({ userId: id });
      if (!initial?.companyId || initial.deletedAt)
        throw new NotFoundException('User not found.');
      if (initial.isPlatformAdmin)
        throw new ForbiddenException(
          'Platform accounts cannot be deleted through company user administration.',
        );
      const cid = initial.companyId;
      await m.query(
        'SELECT company_id FROM core.companies WHERE company_id=$1 FOR UPDATE',
        [cid],
      );
      const user = await repo.findOne({
        where: { userId: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.deletedAt)
        throw new NotFoundException('User not found.');
      const [status] = await m.query(
        `SELECT EXISTS(SELECT 1 FROM core.user_roles ur JOIN core.roles r USING(role_id) WHERE ur.user_id=$1 AND r.company_id=$2 AND r.is_company_admin) AS admin,
        EXISTS(SELECT 1 FROM core.users other JOIN core.user_roles ur ON ur.user_id=other.user_id JOIN core.roles r USING(role_id) WHERE other.company_id=$2 AND other.user_id<>$1 AND other.is_active AND other.deleted_at IS NULL AND r.company_id=$2 AND r.is_company_admin) AS replacement`,
        [id, cid],
      );
      if (user.isActive && status.admin && !status.replacement)
        throw new BadRequestException(
          'Keep at least one active company administrator.',
        );
      user.deletedAt = new Date();
      user.isActive = false;
      user.authVersion++;
      await repo.save(user);
      await m.query('DELETE FROM core.user_roles WHERE user_id=$1', [id]);
      await this.audit(m, actor, cid, 'USER_DELETED', id, {
        username: user.username,
        historyPreserved: true,
      });
      return { userId: id, deleted: true };
    });
  }
  async audits(
    actor: Actor,
    companyId: string | undefined,
    page = 1,
    limit = 25,
  ) {
    this.access.admin(actor);
    const cid = this.scope(actor, companyId);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new BadRequestException('Invalid pagination.');
    const [count] = await this.ds.query(
      'SELECT count(*)::int AS total FROM audit.audit_logs WHERE company_id=$1',
      [cid],
    );
    const items = await this.ds.query(
      `SELECT a.audit_id AS "auditId",a.action,a.record_id AS "recordId",a.new_values AS "newValues",a.created_at AS "createdAt",u.username FROM audit.audit_logs a LEFT JOIN core.users u USING(user_id) WHERE a.company_id=$1 ORDER BY a.created_at DESC,a.audit_id DESC LIMIT $2 OFFSET $3`,
      [cid, limit, (page - 1) * limit],
    );
    return {
      items,
      total: count.total,
      page,
      limit,
      totalPages: Math.ceil(count.total / limit),
    };
  }
  private conflict(e: any): never {
    if (e?.driverError?.code === '23505' || e?.code === '23505')
      throw new ConflictException(
        'Company code, username, or email already exists.',
      );
    throw e;
  }
}
