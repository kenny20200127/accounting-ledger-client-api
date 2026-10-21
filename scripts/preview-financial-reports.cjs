require('dotenv').config({quiet:true});
require('reflect-metadata');
const { NestFactory }=require('@nestjs/core');
const { AppModule }=require('../dist/app.module');
const { DataSource }=require('typeorm');
const { FinancialReportsService }=require('../dist/reports/financial-reports.service');
const { ReportPdfService }=require('../dist/reports/report-pdf.service');
const fs=require('node:fs/promises');
const path=require('node:path');
async function preview(){
 const app=await NestFactory.create(AppModule,{logger:false});
 try{
  await app.init();
  const [company]=await app.get(DataSource).query("SELECT company_id FROM core.companies WHERE company_code='KB01'");
  const service=app.get(FinancialReportsService),pdf=app.get(ReportPdfService);
  const out=path.resolve('output/pdf');await fs.mkdir(out,{recursive:true});
  for(const report of ['trial-balance','profit-loss','account-balances']){
   const query={companyId:company.company_id,report,asOf:'2026-03-31',includeZero:true};
   if(report==='account-balances')query.groupCodes=['151100'];
   const data=await service.generate(query);
   await fs.writeFile(path.join(out,report+'-preview.pdf'),await pdf.render(data));
   await fs.writeFile(path.resolve('tmp/pdfs',report+'-preview.json'),JSON.stringify(data));
   console.log(JSON.stringify({report,rows:data.rows.length,totals:data.totals,warnings:data.warnings}));
  }
 }finally{await app.close();}
}
preview().catch(e=>{console.error(e.message);process.exitCode=1;});
