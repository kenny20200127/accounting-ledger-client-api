import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { FiscalYearsService } from './fiscal-years.service';

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
}