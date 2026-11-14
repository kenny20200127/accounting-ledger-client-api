import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { CloseFiscalYearDto } from './dto/close-fiscal-year.dto';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { FiscalYearsService } from './fiscal-years.service';

@ApiTags('fiscal-years')
@ApiBearerAuth()
@Controller('fiscal-years')
export class FiscalYearsController {
  constructor(private readonly service: FiscalYearsService) {}

  @Post()
  create(@Body() dto: CreateFiscalYearDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/close')
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CloseFiscalYearDto,
    @Req() req: any,
  ) {
    return this.service.closeYear(id, dto.retainedEarningsAccountId, req.actor.userId);
  }

  @Post(':id/reopen')
  reopen(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: any) {
    return this.service.reopenYear(id, req.actor.userId);
  }
}