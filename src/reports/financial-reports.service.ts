import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FinancialReportQuery } from './financial-report-query.dto';
import { amount, cents, FinancialReport, groupCode, ReportRow } from './financial-report.types';

type AccountBalance = {
  accountCode: string; accountName: string; accountType: string; isHeader: boolean;
  parentCode: string | null; month: string; ytd: string; closing: string; activity: number; monthActivity: number;
};
@Injectable()
export class FinancialReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async company(companyId: string) {
    const [company] = await this.dataSource.query(`SELECT company_name AS "companyName", COALESCE(address,'') AS address,
      logo_data AS "logoData", primary_color AS "primaryColor", secondary_color AS "secondaryColor", base_currency AS currency FROM core.companies WHERE company_id=$1`, [companyId]);
    if (!company) throw new NotFoundException('Company not found.');
    return company;
  }

  async options(companyId: string) {
    const company = await this.company(companyId);
    const accounts = await this.dataSource.query(`SELECT a.account_code AS "accountCode", a.account_name AS "accountName",
      a.is_header AS "isHeader", p.account_code AS "parentCode", p.account_name AS "parentName"
      FROM accounting.accounts a LEFT JOIN accounting.accounts p ON p.account_id=a.parent_account_id AND p.company_id=a.company_id
      WHERE a.company_id=$1 ORDER BY a.account_code`, [companyId]);
    const groups = new Map<string, { code: string; name: string }>();
    const detailGroups = new Set(accounts.filter(a => !a.isHeader).map(a => groupCode(a)));
    for (const account of accounts) {
      const code = groupCode(account);
      if (account.isHeader && !detailGroups.has(code)) continue;
      if (!groups.has(code) || account.isHeader) groups.set(code, { code, name: account.isHeader ? account.accountName : account.parentName || account.accountName });
    }
    const branches = await this.dataSource.query(`SELECT branch_id AS "branchId", branch_name AS "branchName"
      FROM core.branches WHERE company_id=$1 ORDER BY branch_name,branch_id`, [companyId]);
    const fiscalYears = await this.dataSource.query(`SELECT fiscal_year_id AS "fiscalYearId",year_name AS "yearName",
      start_date::text AS "startDate",end_date::text AS "endDate" FROM accounting.fiscal_years
      WHERE company_id=$1 ORDER BY start_date DESC,fiscal_year_id`, [companyId]);
    return { company, groups: [...groups.values()].sort((a,b) => a.code.localeCompare(b.code)), branches, fiscalYears };
  }

  async generate(query: FinancialReportQuery): Promise<FinancialReport> {
    const company = await this.company(query.companyId);
    let branchName = 'All branches';
    if (query.branchId) {
      const [branch] = await this.dataSource.query('SELECT branch_name FROM core.branches WHERE branch_id=$1 AND company_id=$2', [query.branchId,query.companyId]);
      if (!branch) throw new BadRequestException('Branch must belong to the selected company.');
      branchName = branch.branch_name;
    }
    const years = await this.dataSource.query(`SELECT start_date::text AS start,end_date::text AS end
      FROM accounting.fiscal_years WHERE company_id=$1 AND ${query.fiscalYearId ? 'fiscal_year_id=$2' : 'start_date <= $2 AND end_date >= $2'}
      ORDER BY start_date DESC`, query.fiscalYearId ? [query.companyId,query.fiscalYearId] : [query.companyId,query.asOf]);
    if (query.fiscalYearId && (!years.length || query.asOf < years[0].start || query.asOf > years[0].end)) {
      throw new BadRequestException('The selected fiscal year must belong to the company and contain the report date.');
    }
    if (!query.fiscalYearId && years.length > 1) throw new BadRequestException('Overlapping fiscal years: select the fiscal year for this report.');
    const fiscalYearStart = years[0]?.start ?? query.asOf.slice(0,4)+'-01-01';
    const monthStart = query.asOf.slice(0,7)+'-01';
    const balances: AccountBalance[] = await this.dataSource.query(`
      WITH posted_lines AS (
        SELECT l.account_id,l.debit_amount-l.credit_amount AS net,j.transaction_date
        FROM accounting.journal_entry_lines l JOIN accounting.journal_entries j USING(journal_entry_id)
        WHERE j.company_id=$1 AND j.status IN('POSTED','REVERSED') AND j.transaction_date <= $2
          ${query.branchId ? 'AND j.branch_id=$5' : ''}
      )
      SELECT a.account_code AS "accountCode",a.account_name AS "accountName",t.code AS "accountType",a.is_header AS "isHeader",
        p.account_code AS "parentCode",
        COALESCE(SUM(l.net) FILTER(WHERE l.transaction_date >= $3),0)::numeric(20,2)::text AS month,
        COALESCE(SUM(l.net) FILTER(WHERE l.transaction_date >= $4),0)::numeric(20,2)::text AS ytd,
        COALESCE(SUM(l.net),0)::numeric(20,2)::text AS closing,COUNT(l.account_id)::int AS activity,COUNT(l.account_id) FILTER(WHERE l.transaction_date >= $3)::int AS "monthActivity"
      FROM accounting.accounts a JOIN accounting.account_types t USING(account_type_id)
      LEFT JOIN accounting.accounts p ON p.account_id=a.parent_account_id AND p.company_id=a.company_id
      LEFT JOIN posted_lines l ON l.account_id=a.account_id
      WHERE a.company_id=$1
      GROUP BY a.account_id,a.account_code,a.account_name,t.code,a.is_header,p.account_code ORDER BY a.account_code
    `, query.branchId ? [query.companyId,query.asOf,monthStart,fiscalYearStart,query.branchId] : [query.companyId,query.asOf,monthStart,fiscalYearStart]);
    const labels = new Map<string,string>();
    for (const a of balances) if (a.isHeader) labels.set(groupCode(a),a.accountName);
    const groups = new Map<string,{ code: string; name: string; type: string; month: bigint; ytd: bigint; closing: bigint }>();
    for (const a of balances) {
      if (a.isHeader && !a.activity) continue;
      const code=groupCode(a);
      let group=groups.get(code);
      if (!group) { group={code,name:labels.get(code) || a.accountName,type:a.accountType,month:0n,ytd:0n,closing:0n}; groups.set(code,group); }
      group.month+=cents(a.month); group.ytd+=cents(a.ytd); group.closing+=cents(a.closing);
    }
    if (query.groupCodes && query.report !== 'account-balances') throw new BadRequestException('Account-group filtering is available for the Balance of Account report.');
    if (query.groupCodes?.some(code=>!groups.has(code))) throw new BadRequestException('One or more account groups do not belong to this company.');
    const report: FinancialReport = {
      kind:query.report,title:'',...company,asOf:query.asOf,monthStart,fiscalYearStart,branchName,
      generatedAt:new Date().toISOString(),columns:[],rows:[],totals:[],warnings:[],
    };
    if (!balances.some(a => a.monthActivity > 0)) report.warnings.push('No posted transactions exist for the selected month.');
    const nonzero=(g: {month:bigint;ytd:bigint;closing:bigint})=>query.includeZero || g.month!==0n || g.ytd!==0n || g.closing!==0n;
    const ordered=[...groups.values()].sort((a,b)=>a.code.localeCompare(b.code));
    if (query.report==='trial-balance') {
      report.title='Trial Balance Report';
      report.columns=[{key:'accountCode',label:'Account No.'},{key:'description',label:'Description'},
        {key:'monthDebit',label:'Current Month Debit',numeric:true},{key:'monthCredit',label:'Current Month Credit',numeric:true},
        {key:'ytdDebit',label:'Year to Date Debit',numeric:true},{key:'ytdCredit',label:'Year to Date Credit',numeric:true}];
      const total={monthDebit:0n,monthCredit:0n,ytdDebit:0n,ytdCredit:0n};
      for (const group of ordered.filter(nonzero)) {
        const values={monthDebit:group.month>0n?group.month:0n,monthCredit:group.month<0n?-group.month:0n,
          ytdDebit:group.closing>0n?group.closing:0n,ytdCredit:group.closing<0n?-group.closing:0n};
        report.rows.push({accountCode:/^\d{6}$/.test(group.code)?group.code+'-00000':group.code,description:group.name,
          ...Object.fromEntries(Object.entries(values).map(([key,value])=>[key,amount(value)]))});
        for (const key of Object.keys(total) as (keyof typeof total)[]) total[key]+=values[key];
      }
      report.totals=[{label:'Grand Total',values:Object.fromEntries(Object.entries(total).map(([key,value])=>[key,amount(value)]))}];
      report.balanced=total.monthDebit===total.monthCredit && total.ytdDebit===total.ytdCredit;
      if (!report.balanced) report.warnings.push('Trial balance does not balance. Review the posted journals and account assignments.');
    } else if (query.report==='profit-loss') {
      report.title='Profit & Loss';
      report.columns=[{key:'description',label:'Description'},{key:'monthAmount',label:'Current Month',numeric:true},{key:'ytdAmount',label:'Year to Date',numeric:true}];
      let monthTotal=0n,ytdTotal=0n;
      for (const section of ['Income','Operating Expenses','Depreciation Charges']) {
        const members=ordered.filter(g=>section==='Income'?g.type==='REVENUE':g.type==='EXPENSE' && (/depreciation/i.test(g.name)===(section==='Depreciation Charges')));
        report.rows.push({description:section,isSection:true});
        let month=0n,ytd=0n;
        for (const group of members) {
          month+=group.month;ytd+=group.ytd;
          if (query.includeZero || group.month!==0n || group.ytd!==0n) report.rows.push({description:group.name,section,monthAmount:amount(group.month),ytdAmount:amount(group.ytd)});
        }
        report.rows.push({description:'Total '+section,isTotal:true,monthAmount:amount(month),ytdAmount:amount(ytd)});
        monthTotal+=month;ytdTotal+=ytd;
      }
      report.totals=[{label:'(Profit) / Loss',values:{monthAmount:amount(monthTotal),ytdAmount:amount(ytdTotal)}}];
    } else {
      report.title='Balance of Account';
      report.columns=[{key:'accountCode',label:'Account No.'},{key:'description',label:'Description'},{key:'balance',label:'Balance',numeric:true}];
      let total=0n;
      for (const a of balances) {
        if ((a.isHeader && !a.activity) || (query.groupCodes && !query.groupCodes.includes(groupCode(a)))) continue;
        const closing=cents(a.closing);
        if (!query.includeZero && closing===0n) continue;
        report.rows.push({accountCode:a.accountCode,description:a.accountName,balance:amount(closing)});
        total+=closing;
      }
      report.totals=[{label:'Total',values:{balance:amount(total)}}];
    }
    const [drafts]=await this.dataSource.query(`SELECT COUNT(*)::int AS count FROM accounting.journal_entries
      WHERE company_id=$1 AND transaction_date <= $2 AND status IN('DRAFT','PENDING','APPROVED') ${query.branchId ? 'AND branch_id=$3' : ''}`,query.branchId ? [query.companyId,query.asOf,query.branchId] : [query.companyId,query.asOf]);
    if (drafts.count) report.warnings.push(`${drafts.count} unposted journals through this date are excluded.`);
    const [legacy]=await this.dataSource.query("SELECT to_regclass('accounting.legacy_migration_records') IS NOT NULL AS exists");
    if (legacy.exists) {
      const [snapshots]=await this.dataSource.query(`SELECT COUNT(*)::int AS count FROM accounting.legacy_migration_records
        WHERE company_id=$1 AND source_table='accledger' AND status='SNAPSHOT'`,[query.companyId]);
      if (snapshots.count) report.warnings.push('Legacy balance snapshots are retained separately and are not included in these posted-ledger figures.');
    }
    if (!years.length) report.warnings.push('No fiscal year contains this date; year-to-date uses the calendar year.');
    return report;
  }
}
