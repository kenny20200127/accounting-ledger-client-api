import { Injectable } from '@nestjs/common';
import { renderPdfViaPython } from '../pdf/python-pdf';
import type { FinancialReport } from './financial-report.types';

@Injectable()
export class ReportPdfService {
  render(report: FinancialReport): Promise<Buffer> {
    return renderPdfViaPython(
      'scripts/render_financial_report.py',
      report,
      'Report PDF exceeds the download size limit.',
    );
  }
}
