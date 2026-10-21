import { Injectable } from '@nestjs/common';
import { AdministrationService } from '../administration/administration.service';
import { TenantAccessService } from '../administration/tenant-access.service';
import { CreateUserDto } from './dto/create-user.dto';
/** All callers share the database-backed company administrator policy. */
@Injectable()
export class UsersService {
  constructor(
    private readonly admin: AdministrationService,
    private readonly access: TenantAccessService,
  ) {}
  async create(dto: CreateUserDto, actorId: string) {
    return this.admin.createUser(dto, await this.access.actor(actorId));
  }
  async findAll(companyId: string | undefined, actorId: string) {
    return this.admin.users(await this.access.actor(actorId), companyId);
  }
  async findAssignableRoles(actorId: string, companyId?: string) {
    return this.admin.roles(await this.access.actor(actorId), companyId);
  }
}
