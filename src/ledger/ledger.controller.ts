import { CompanyListQueryDto } from '../common/company-list-query.dto';
import {
  Req,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { CreateLedgerBatchDto } from './dto/create-ledger-batch.dto';
import { LedgerService } from './ledger.service';

class LedgerQueryDto {
  @IsUUID() companyId: string;
  @IsUUID() accountId: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

class TrialBalanceQueryDto {
  @IsUUID() companyId: string;
  @IsDateString() asOf: string;
}

@Controller()
export class LedgerController {
  constructor(private readonly service: LedgerService) {}

  @Post('ledger-batches')
  createBatch(@Body() dto: CreateLedgerBatchDto, @Req() req: any) {
    return this.service.createBatch(dto, req.actor.userId);
  }

  @Get('ledger-batches')
  listHistories(@Query() query: CompanyListQueryDto) {
    return this.service.listHistories(query);
  }

  @Get('ledger-batches/balances')
  listBalances(
    @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
  ) {
    return this.service.listBalances(companyId);
  }

  @Get('ledger-batches/monthly-balances')
  listMonthlyBalances(
    @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
    @Query('year') year?: string,
  ) {
    return this.service.listMonthlyBalances(companyId, year);
  }

  @Get('ledger-batches/:id')
  findHistory(@Param('id', new ParseIntPipe()) id: string) {
    return this.service.findHistory(id);
  }

  @Get('ledger')
  getLedger(@Query() query: LedgerQueryDto) {
    return this.service.getLedger(query.companyId, query.accountId, query.from, query.to);
  }

  @Get('reports/trial-balance')
  getTrialBalance(@Query() query: TrialBalanceQueryDto) {
    return this.service.trialBalance(query.companyId, query.asOf);
  }
}
