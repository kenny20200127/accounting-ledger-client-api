import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { FinancialReportQuery, ReportOptionsQuery } from './financial-report-query.dto';
import { FinancialReportsService } from './financial-reports.service';
import { ReportPdfService } from './report-pdf.service';
// Global JWT and REPORTS.canView guards protect both previews and downloads.
@ApiTags('reports/financial')
@ApiBearerAuth()
@Controller('reports/financial')
export class FinancialReportsController {
  constructor(private readonly reports: FinancialReportsService, private readonly pdf: ReportPdfService) {}
  @Get('options') options(@Query() query: ReportOptionsQuery) { return this.reports.options(query.companyId); }
  @Get() generate(@Query() query: FinancialReportQuery) { return this.reports.generate(query); }
  @Get('pdf') async download(@Query() query: FinancialReportQuery) {
    const report=await this.reports.generate(query);
    const buffer=await this.pdf.render(report);
    return new StreamableFile(buffer,{type:'application/pdf',disposition:`attachment; filename="${query.report}-${query.asOf}.pdf"`,length:buffer.length});
  }
}
