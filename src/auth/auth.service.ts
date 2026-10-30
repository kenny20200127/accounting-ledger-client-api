import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Menu } from '../roles/menu.entity';
import { UserRole } from '../users/user-role.entity';
import { User } from '../users/user.entity';
import { DataSource } from 'typeorm';
import { TenantAccessService } from '../administration/tenant-access.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(Menu) private readonly menus: Repository<Menu>,
    private readonly jwt: JwtService,
    private readonly access: TenantAccessService,
    private readonly ds: DataSource,
  ) {}

  private findByIdentifier(identifier: string) {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where(
        'LOWER(user.username) = :identifier OR LOWER(user.email) = :identifier',
        { identifier },
      )
      .getOne();
  }

  async login(dto: LoginDto, portal: 'platform' | 'company' = 'company') {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.findByIdentifier(identifier);

    if (
      !user ||
      !user.isActive ||
      user.deletedAt !== null ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid username/email or password.');
    }

    if ((portal === 'platform') !== user.isPlatformAdmin)
      throw new ForbiddenException(
        portal === 'platform'
          ? 'Use the company application to sign in.'
          : 'Use the platform application to sign in.',
      );
    await this.access.actor(user.userId);
    user.lastLoginAt = new Date();
    await this.users.update(user.userId, { lastLoginAt: user.lastLoginAt });
    const roles = await this.userRoles.find({
      where: { userId: user.userId },
      relations: { role: true },
    });

    const accessToken = await this.jwt.signAsync({
      scope: portal,
      sub: user.userId,
      authVersion: user.authVersion,
      username: user.username,
      companyId: user.companyId,
      branchId: user.branchId,
    });

    const menus = await this.getUserMenus(user.userId);
    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        ...(await this.access.actor(user.userId)),
        userId: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        branchId: user.branchId,
        roles: roles
          .filter(
            (ur) =>
              user.isPlatformAdmin || ur.role.companyId === user.companyId,
          )
          .map((userRole) => ({
            roleId: userRole.roleId,
            roleCode: userRole.role.roleCode,
            roleName: userRole.role.roleName,
          })),
      },
      menus,
    };
  }

  /**
   * Self-service reset. Until email verification exists, proving the username
   * (or email) is the only credential checked, so this is deliberately scoped
   * to the portal the account signs in to.
   */
  async forgotPassword(dto: ForgotPasswordDto, portal: 'platform' | 'company') {
    const user = await this.findByIdentifier(
      dto.identifier.trim().toLowerCase(),
    );

    if (!user || !user.isActive || user.deletedAt !== null)
      throw new NotFoundException('No active account matches that username.');

    if ((portal === 'platform') !== user.isPlatformAdmin)
      throw new ForbiddenException(
        portal === 'platform'
          ? 'Use the company application to reset this password.'
          : 'Use the platform application to reset this password.',
      );

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.authVersion++;
    await this.users.save(user);
    return { passwordReset: true };
  }

  async getUserMenus(userId: string) {
    const actor = await this.access.actor(userId);
    if (actor.isPlatformAdmin)
      return (
        await this.menus.find({
          where: { isActive: true, menuCode: 'PLATFORM_ADMIN' },
          order: { displayOrder: 'ASC' },
        })
      ).map((menu) => ({
        ...menu,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
      }));
    const rows = await this.ds.query(
      `SELECT m.menu_id AS "menuId",m.parent_menu_id AS "parentMenuId",m.menu_code AS "menuCode",m.menu_name AS "menuName",m.menu_url AS "menuUrl",m.icon,m.display_order AS "displayOrder",
      bool_or(rm.can_view) AS "canView",bool_or(rm.can_create) AS "canCreate",bool_or(rm.can_edit) AS "canEdit",bool_or(rm.can_delete) AS "canDelete",bool_or(rm.can_approve) AS "canApprove"
      FROM core.user_roles ur JOIN core.roles r USING(role_id) JOIN core.role_menus rm USING(role_id) JOIN core.menus m USING(menu_id)
      WHERE ur.user_id=$1 AND r.company_id=$2 AND m.is_active AND m.menu_code<>'PLATFORM_ADMIN' GROUP BY m.menu_id HAVING bool_or(rm.can_view) ORDER BY m.display_order`,
      [userId, actor.companyId],
    );
    return rows.map((row) => ({
      ...row,
      menuName:
        row.menuCode === 'COMPANIES' ? 'Company Settings' : row.menuName,
    }));
  }

  async getAllMenus() {
    return this.menus.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });
  }

  async getProfile(userId: string) {
    const user = await this.users.findOne({
      where: { userId, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User is unavailable.');
    const roles = await this.userRoles.find({
      where: { userId },
      relations: { role: true },
    });
    return {
      ...(await this.access.actor(userId)),
      userId,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: user.companyId,
      branchId: user.branchId,
      roles: roles
        .filter(
          (ur) => user.isPlatformAdmin || ur.role.companyId === user.companyId,
        )
        .map(({ role }) => ({
          roleId: role.roleId,
          roleCode: role.roleCode,
          roleName: role.roleName,
        })),
    };
  }
}
