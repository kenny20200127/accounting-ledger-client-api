import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { BalanceSheetsService } from './balance-sheets.service';
import { BalanceSheetListQueryDto } from './dto/balance-sheet-list-query.dto';
import { CreateBalanceSheetDto } from './dto/create-balance-sheet.dto';
import { UpdateBalanceSheetDto } from './dto/update-balance-sheet.dto';

@ApiTags('balance-sheets')
@ApiBearerAuth()
@Controller('balance-sheets')
export class BalanceSheetsController {
  constructor(private readonly service: BalanceSheetsService) {}

  @Post()
  create(@Body() dto: CreateBalanceSheetDto, @Req() req: any) {
    return this.service.create(dto, req.actor?.userId);
  }

  @Get()
  findAll(@Query() query: BalanceSheetListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateBalanceSheetDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.remove(id);
  }
}
