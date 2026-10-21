import {
  Global,
  Module,
  Controller,
  Body,
  Get,
  Delete,
  UploadedFile,
  UseInterceptors,
  ForbiddenException,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { TenantAccessService as Access } from './tenant-access.service';
import { ResetPasswordDto, UpdateUserDto } from './admin.dto';
import { AdministrationService } from './administration.service';
import { TenantAccessService } from './tenant-access.service';
import { OnboardCompanyDto, SaveRoleDto, UpdateCompanyDto } from './admin.dto';
@Controller('platform/companies')
class PlatformController {
  constructor(
    private readonly admin: AdministrationService,
    private readonly access: Access,
  ) {}
  @Get() all(@Req() req: any) {
    return this.admin.companies(req.actor);
  }
  @Post() create(@Body() dto: OnboardCompanyDto, @Req() req: any) {
    return this.admin.onboard(dto, req.actor);
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @Req() req: any,
  ) {
    return this.admin.updateCompany(id, dto, req.actor);
  }
  @Get(':id') async one(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return (await this.admin.companies(req.actor)).find(
      (c) => c.companyId === id,
    );
  }
  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  logo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    return this.admin.logo(id, file, req.actor);
  }
  @Delete(':id/logo') removeLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.admin.removeLogo(id, req.actor);
  }
  @Get(':id/users') users(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.admin.users(req.actor, id);
  }
  @Post(':id/users') createUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUserDto,
    @Req() req: any,
  ) {
    if (dto.companyId && dto.companyId !== id)
      throw new ForbiddenException('Company does not match.');
    return this.admin.createUser({ ...dto, companyId: id }, req.actor);
  }
  @Patch(':id/users/:userId') async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) uid: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    await this.access.owns('userId', uid, id);
    return this.admin.updateUser(uid, dto, req.actor);
  }
  @Delete(':id/users/:userId') async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) uid: string,
    @Req() req: any,
  ) {
    await this.access.owns('userId', uid, id);
    return this.admin.deleteUser(uid, req.actor);
  }
  @Post(':id/users/:userId/reset-password') async resetUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) uid: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: any,
  ) {
    await this.access.owns('userId', uid, id);
    return this.admin.updateUser(uid, {}, req.actor, dto.password);
  }
  @Get(':id/roles') roles(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.admin.roles(req.actor, id);
  }
  @Get(':id/roles/:roleId/permissions') async permissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) rid: string,
    @Req() req: any,
  ) {
    await this.access.owns('roleId', rid, id);
    return this.admin.rolePermissions(rid, req.actor);
  }
  @Post(':id/roles') createRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveRoleDto,
    @Req() req: any,
  ) {
    if (dto.companyId !== id)
      throw new ForbiddenException('Company does not match.');
    return this.admin.saveRole(dto, req.actor);
  }
  @Patch(':id/roles/:roleId') async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) rid: string,
    @Body() dto: SaveRoleDto,
    @Req() req: any,
  ) {
    if (dto.companyId !== id)
      throw new ForbiddenException('Company does not match.');
    await this.access.owns('roleId', rid, id);
    return this.admin.saveRole(dto, req.actor, rid);
  }
  @Get(':id/audit-logs') audit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    return this.admin.audits(
      req.actor,
      id,
      page === undefined ? 1 : Number(page),
      limit === undefined ? 25 : Number(limit),
    );
  }
}
@Controller('roles')
class RolesController {
  constructor(private readonly admin: AdministrationService) {}
  @Get() all(@Query('companyId') cid: string | undefined, @Req() req: any) {
    return this.admin.roles(req.actor, cid);
  }
  @Get(':id/permissions') permissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.admin.rolePermissions(id, req.actor);
  }
  @Post() create(@Body() dto: SaveRoleDto, @Req() req: any) {
    return this.admin.saveRole(dto, req.actor);
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveRoleDto,
    @Req() req: any,
  ) {
    return this.admin.saveRole(dto, req.actor, id);
  }
}
@Controller('audit-logs')
class AuditController {
  constructor(private readonly admin: AdministrationService) {}
  @Get() all(
    @Query('companyId') cid: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    return this.admin.audits(
      req.actor,
      cid,
      page === undefined ? 1 : Number(page),
      limit === undefined ? 25 : Number(limit),
    );
  }
}
@Global()
@Module({
  controllers: [PlatformController, RolesController, AuditController],
  providers: [AdministrationService, TenantAccessService],
  exports: [AdministrationService, TenantAccessService],
})
export class AdministrationModule {}
