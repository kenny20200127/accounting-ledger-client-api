import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { FinancialReport } from './financial-report.types';
@Injectable()
export class ReportPdfService {
  render(report: FinancialReport): Promise<Buffer> {
    return new Promise((resolvePdf,reject) => {
      const process = spawn(globalThis.process.env.REPORT_PDF_PYTHON || 'python',
        [resolve(globalThis.process.cwd(),'scripts/render_financial_report.py')], { windowsHide:true,stdio:['pipe','pipe','pipe'] });
      const chunks: Buffer[]=[];
      let size=0;
      let settled=false;
      const failure=()=>new ServiceUnavailableException('PDF rendering is unavailable. Configure REPORT_PDF_PYTHON and install scripts/requirements-pdf.txt.');
      const timer=setTimeout(()=>{process.kill();finish(failure());},30000);
      const finish=(error?:Error,buffer?:Buffer)=>{
        if(settled)return;
        settled=true;clearTimeout(timer);
        if(error)reject(error);else resolvePdf(buffer!);
      };
      process.on('error',()=>finish(failure()));
      process.stdin.on('error',()=>finish(failure()));
      process.stderr.resume();
      process.stdout.on('data',(chunk:Buffer)=>{
        size+=chunk.length;
        if(size>20*1024*1024){process.kill();finish(new ServiceUnavailableException('Report PDF exceeds the download size limit.'));return;}
        chunks.push(chunk);
      });
      process.on('close',code=>{
        const buffer=Buffer.concat(chunks);
        if(code!==0 || !buffer.subarray(0,5).equals(Buffer.from('%PDF-')))finish(failure());
        else finish(undefined,buffer);
      });
      process.stdin.end(JSON.stringify(report));
    });
  }
}
