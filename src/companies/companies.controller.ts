import {
  Body,
  NotFoundException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdministrationService } from '../administration/administration.service';
import {
  OnboardCompanyDto,
  UpdateCompanyDto,
} from '../administration/admin.dto';
@Controller('companies')
export class CompaniesController {
  constructor(private readonly admin: AdministrationService) {}
  @Post() create(@Body() dto: OnboardCompanyDto, @Req() req: any) {
    return this.admin.onboard(dto, req.actor);
  }
  @Get() all(@Req() req: any) {
    return this.admin.companies(req.actor);
  }
  @Get(':id') async one(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const c = (await this.admin.companies(req.actor)).find(
      (c) => c.companyId === id,
    );
    if (!c) throw new NotFoundException('Company not found.');
    return c;
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @Req() req: any,
  ) {
    return this.admin.updateCompany(id, dto, req.actor);
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
}
