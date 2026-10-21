import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { AdministrationService } from '../administration/administration.service';
import { ResetPasswordDto, UpdateUserDto } from '../administration/admin.dto';
@Controller('users')
export class UsersController {
  constructor(private readonly admin: AdministrationService) {}
  @Post() create(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.admin.createUser(dto, req.actor);
  }
  @Get() all(@Query('companyId') cid: string | undefined, @Req() req: any) {
    return this.admin.users(req.actor, cid);
  }
  @Get('assignable-roles') roles(
    @Query('companyId') cid: string | undefined,
    @Req() req: any,
  ) {
    return this.admin.roles(req.actor, cid);
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.admin.updateUser(id, dto, req.actor);
  }
  @Post(':id/reset-password') reset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: any,
  ) {
    return this.admin.updateUser(id, {}, req.actor, dto.password);
  }
}
