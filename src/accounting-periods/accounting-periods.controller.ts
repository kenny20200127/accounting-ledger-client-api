import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
Body, Req,
Controller,
Get,
Param,
ParseUUIDPipe,
Patch,
Post,
Query,
} from '@nestjs/common';
import { AccountingPeriodsService } from './accounting-periods.service';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { GeneratePeriodsDto } from './dto/generate-periods.dto';

@ApiTags('accounting-periods')
@ApiBearerAuth()
@Controller('accounting-periods')
export class AccountingPeriodsController {
constructor(
private readonly accountingPeriodsService: AccountingPeriodsService,
) {}

@Post()
create(@Body() dto: CreateAccountingPeriodDto) {
return this.accountingPeriodsService.create(dto);
}

@Get()
findAll(@Req() req: any, @Query('fiscalYearId') fiscalYearId?: string, @Query('companyId') companyId?: string) {
return this.accountingPeriodsService.findAll(fiscalYearId, companyId ?? (req.actor.isPlatformAdmin ? undefined : req.actor.companyId));
}

@Get('closing-status')
closingStatus(@Query('fiscalYearId', new ParseUUIDPipe()) fiscalYearId: string) {
return this.accountingPeriodsService.closingStatus(fiscalYearId);
}

@Post('generate-missing')
generateMissing(@Body() dto: GeneratePeriodsDto, @Req() req: any) {
return this.accountingPeriodsService.generateMissing(dto.fiscalYearId, req.actor.userId);
}

@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
return this.accountingPeriodsService.findOne(id);
}

@Patch(':id/close')
close(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
return this.accountingPeriodsService.close(id, req.actor.userId);
}

@Patch(':id/reopen')
reopen(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
return this.accountingPeriodsService.reopen(id, req.actor.userId);
}
}
