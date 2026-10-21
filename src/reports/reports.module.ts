import { FinancialReportsController } from './financial-reports.controller';
import { FinancialReportsService } from './financial-reports.service';
import { ReportPdfService } from './report-pdf.service';
import { Module } from '@nestjs/common';
import { LegacyReportsController } from './legacy-reports.controller';
import { LegacyReportsService } from './legacy-reports.service';
@Module({
  controllers: [LegacyReportsController, FinancialReportsController],
  providers: [LegacyReportsService, FinancialReportsService, ReportPdfService],
})
export class ReportsModule {}
