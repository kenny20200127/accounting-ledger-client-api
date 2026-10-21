require('dotenv').config({ quiet: true });
require('reflect-metadata');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { DataSource } = require('typeorm');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { LedgerService } = require('../dist/ledger/ledger.service');
let app;
const reportsUserId=randomUUID();
before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const ds=app.get(DataSource);
  const [role]=await ds.query("SELECT r.role_id,r.company_id FROM core.roles r JOIN core.companies c USING(company_id) WHERE c.company_code='KB01' AND r.is_company_admin LIMIT 1");
  assert.ok(role,'Koguna company administrator role is required');
  await ds.query('INSERT INTO core.users(user_id,company_id,username,email,password_hash) VALUES($1,$2,$3,$4,$5)',[reportsUserId,role.company_id,'reports-test-'+reportsUserId,reportsUserId+'@example.test','temporary-unusable-password']);
  await ds.query('INSERT INTO core.user_roles(user_id,role_id) VALUES($1,$2)',[reportsUserId,role.role_id]);
});
after(async () => {try{if(app){const ds=app.get(DataSource);await ds.query('DELETE FROM core.user_roles WHERE user_id=$1',[reportsUserId]);await ds.query('DELETE FROM core.users WHERE user_id=$1',[reportsUserId]);}}finally{await app?.close();}});

test('migration endpoints require authentication', async () => {
  for (const path of ['reports/legacy-migration', 'reports/legacy-migration/issues']) {
    await request(app.getHttpServer()).get('/api/v1/'+path+'?companyId='+randomUUID()).expect(401);
  }
});
test('migration endpoints reject tokens for deleted or nonexistent users', async () => {
  const token = app.get(JwtService).sign({ sub: randomUUID() });
  for (const path of ['reports/legacy-migration', 'reports/legacy-migration/issues']) {
    await request(app.getHttpServer()).get('/api/v1/'+path+'?companyId='+randomUUID())
      .set('Authorization', 'Bearer '+token).expect(401);
  }
});
test('login input is validated', async () => {
  await request(app.getHttpServer()).post('/api/v1/auth/login').send({}).expect(400);
});
test('authorized migration endpoints return counts, validate pagination, and omit raw data', async t => {
  const ds = app.get(DataSource);
  const [user] = await ds.query(`SELECT ur.user_id FROM core.user_roles ur
    JOIN core.role_menus rm ON rm.role_id=ur.role_id
    JOIN core.menus m ON m.menu_id=rm.menu_id
    JOIN core.users u ON u.user_id=ur.user_id
    WHERE m.menu_code='REPORTS' AND rm.can_view AND u.is_active AND NOT u.is_platform_admin AND u.user_id=$1 LIMIT 1`,[reportsUserId]);
  if (!user) return t.skip('A user with Reports access must be seeded for this read-only smoke test.');
  const token = app.get(JwtService).sign({ sub: user.user_id });
  const [company] = await ds.query("SELECT company_id FROM core.companies WHERE company_code='KB01'");
  const companyId = company?.company_id || randomUUID();
  const summary = await request(app.getHttpServer()).get('/api/v1/reports/legacy-migration?companyId='+companyId)
    .set('Authorization','Bearer '+token).expect(200);
  assert.equal(summary.body.journals.postedDebit, summary.body.journals.postedCredit);
  const issues = await request(app.getHttpServer()).get('/api/v1/reports/legacy-migration/issues?companyId='+companyId+'&limit=2')
    .set('Authorization','Bearer '+token).expect(200);
  assert.ok(issues.body.items.length <= 2);
  assert.ok(issues.body.items.every(item => !('sourceData' in item)));
  await request(app.getHttpServer()).get('/api/v1/reports/legacy-migration/issues?companyId='+companyId+'&limit=999')
    .set('Authorization','Bearer '+token).expect(400);
  await request(app.getHttpServer()).get('/api/v1/reports/legacy-migration?companyId=invalid')
    .set('Authorization','Bearer '+token).expect(400);
});
test('trial balance excludes draft/future entries; ledger carries signed opening balances', async () => {
  const ds=app.get(DataSource);
  const runner=ds.createQueryRunner();
  await runner.connect(); await runner.startTransaction();
  try {
    const cid=randomUUID(), fy=randomUUID(), period=randomUUID(), a=randomUUID(), b=randomUUID();
    await runner.query('INSERT INTO core.companies(company_id,company_code,company_name) VALUES($1,$2,$3)',[cid,'TEST-'+cid,'Temporary verification']);
    const [type]=await runner.query("SELECT account_type_id FROM accounting.account_types WHERE code='ASSET'");
    await runner.query('INSERT INTO accounting.fiscal_years(fiscal_year_id,company_id,year_name,start_date,end_date) VALUES($1,$2,$3,$4,$5)',[fy,cid,'TEST 2026','2026-01-01','2026-12-31']);
    await runner.query('INSERT INTO accounting.accounting_periods(period_id,fiscal_year_id,period_number,period_name,start_date,end_date) VALUES($1,$2,1,$3,$4,$5)',[period,fy,'Test period','2026-01-01','2026-12-31']);
    for(const [id,code] of [[a,'A'],[b,'B']]) {
      await runner.query('INSERT INTO accounting.accounts(account_id,company_id,account_code,account_name,account_type_id) VALUES($1,$2,$3,$3,$4)',[id,cid,code,type.account_type_id]);
    }
    for(const [status,day,debit,credit] of [
      ['DRAFT','2026-01-01','100.00','0.00'], ['POSTED','2026-01-02','2.00','0.00'],
      ['REVERSED','2026-01-03','3.00','0.00'], ['POSTED','2026-01-04','0.00','12.34'],
      ['POSTED','2026-03-01','0.00','1.23'], ['POSTED','2030-01-01','99.00','0.00'],
    ]) {
      const jid=randomUUID();
      await runner.query('INSERT INTO accounting.journal_entries(journal_entry_id,company_id,period_id,transaction_date,description,status,total_debit,total_credit) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',[jid,cid,period,day,'Temporary verification',status,debit==='0.00'?credit:debit]);
      await runner.query('INSERT INTO accounting.journal_entry_lines(journal_entry_id,account_id,line_number,debit_amount,credit_amount) VALUES($1,$2,1,$4,$5),($1,$3,2,$5,$4)',[jid,a,b,debit,credit]);
    }
    const service=new LedgerService(null,null,null,null,null,{ query:runner.query.bind(runner) });
    const balance=(await service.trialBalance(cid,'2026-12-31')).find(row=>row.accountId===a);
    assert.equal(balance.totalDebit,'5.00'); assert.equal(balance.totalCredit,'13.57'); assert.equal(balance.balance,'-8.57');
    const ledger=await service.getLedger(cid,a,'2026-03-01','2026-12-31');
    assert.equal(ledger.length,1); assert.equal(ledger[0].runningBalance,'-8.57');
    const view=await runner.query('SELECT * FROM accounting.trial_balance WHERE company_id=$1 AND account_id=$2',[cid,a]);
    assert.equal(view[0].total_debit,'104.00'); // View has no as-of filter; includes future posted entries, excludes drafts.
    assert.equal(view[0].total_credit,'13.57');
  } finally { await runner.rollbackTransaction(); await runner.release(); }
});

test('ledger routes are gated by the LEDGER menu and reachable by company admins', async () => {
  const ds=app.get(DataSource);
  const [company]=await ds.query("SELECT company_id FROM core.companies WHERE company_code='KB01'");
  assert.ok(company);
  const cid=company.company_id;
  await request(app.getHttpServer()).get('/api/v1/ledger-batches?companyId='+cid).expect(401);
  const token=app.get(JwtService).sign({sub:reportsUserId});
  await request(app.getHttpServer()).post('/api/v1/ledger-batches').set('Authorization','Bearer '+token).send({}).expect(400);
  const histories=await request(app.getHttpServer()).get('/api/v1/ledger-batches?companyId='+cid+'&page=1&limit=2')
    .set('Authorization','Bearer '+token).expect(200);
  assert.ok(Array.isArray(histories.body.items));
  const balances=await request(app.getHttpServer()).get('/api/v1/ledger-batches/balances?companyId='+cid)
    .set('Authorization','Bearer '+token).expect(200);
  assert.ok(Array.isArray(balances.body));
});

test('large list endpoints paginate, search globally, validate input, and preserve array responses', async t => {
  const ds=app.get(DataSource);
  const [user]=await ds.query(`SELECT ur.user_id FROM core.user_roles ur
    JOIN core.role_menus rm ON rm.role_id=ur.role_id JOIN core.menus m ON m.menu_id=rm.menu_id
    JOIN core.users u ON u.user_id=ur.user_id
    WHERE m.menu_code IN('CHART_OF_ACCOUNTS','JOURNAL_ENTRIES','CUSTOMERS','SUPPLIERS') AND rm.can_view AND u.is_active AND NOT u.is_platform_admin AND u.user_id=$1
    GROUP BY ur.user_id HAVING COUNT(DISTINCT m.menu_code)=4 LIMIT 1`,[reportsUserId]);
  if(!user) return t.skip('Seed a user with access to all four paginated lists for this read-only route test.');
  const token=app.get(JwtService).sign({sub:user.user_id});
  const [company]=await ds.query("SELECT company_id FROM core.companies WHERE company_code='KB01'");
  assert.ok(company);
  const cid=company.company_id;
  const get=url=>request(app.getHttpServer()).get(url).set('Authorization','Bearer '+token);
  for(const [route,id,table] of [['accounts','accountId','accounting.accounts'],['journals','journalEntryId','accounting.journal_entries'],['customers','customerId','sales.customers'],['suppliers','supplierId','purchasing.suppliers']]) {
    const base='/api/v1/'+route+'?companyId='+cid;
    const first=(await get(base+'&page=1&limit=2').expect(200)).body;
    const second=(await get(base+'&page=2&limit=2').expect(200)).body;
    const [count]=await ds.query('SELECT COUNT(*)::int AS count FROM '+table+' WHERE company_id=$1',[cid]);
    assert.equal(first.total,count.count); assert.equal(first.items.length,2);
    assert.equal(first.page,1); assert.equal(first.limit,2); assert.equal(first.totalPages,Math.ceil(first.total/2));
    assert.ok(second.items.every(item=>!first.items.some(other=>other[id]===item[id])));
    const repeat=(await get(base+'&page=2&limit=2').expect(200)).body;
    assert.deepEqual(repeat.items.map(item=>item[id]),second.items.map(item=>item[id]));
    const empty=(await get(base+'&page=1000000&limit=2').expect(200)).body;
    assert.deepEqual(empty.items,[]); assert.equal(empty.total,first.total);
    await get('/api/v1/'+route+'?companyId='+randomUUID()+'&page=1&limit=2').expect(403);
    for(const query of ['page=0','page=-1','page=1.2','page=abc','page=1000001','limit=0','limit=101','limit=abc','q='+('x'.repeat(101))]) {
      await get(base+'&'+query).expect(400);
    }
    if(route==='journals') assert.ok(first.items.every(item=>Array.isArray(item.lines)));
    if(route==='accounts') {
      const searched=(await get(base+'&page=1&limit=1&q='+encodeURIComponent(second.items[0].accountCode)).expect(200)).body;
      assert.equal(searched.total,1); assert.equal(searched.items[0].accountId,second.items[0].accountId);
      const legacy=(await get(base).expect(200)).body;
      assert.ok(Array.isArray(legacy)); assert.equal(legacy.length,first.total);
      const defaultSize=(await get(base+'&page=1').expect(200)).body;
      assert.equal(defaultSize.limit,25); assert.equal(defaultSize.items.length,Math.min(25,first.total));
    }
  }
});

test('pagination treats LIKE wildcards literally and counts matches across all pages', async () => {
  const {Account}=require('../dist/accounts/account.entity');
  const {findCompanyList}=require('../dist/common/find-company-list');
  const runner=app.get(DataSource).createQueryRunner();
  await runner.connect(); await runner.startTransaction();
  try {
    const cid=randomUUID();
    await runner.query('INSERT INTO core.companies(company_id,company_code,company_name) VALUES($1,$2,$3)',[cid,'PAGING-'+cid,'Temporary paging fixture']);
    const [type]=await runner.query("SELECT account_type_id FROM accounting.account_types WHERE code='ASSET'");
    for(const code of ['A01','A02','A03','A04','A05','A%_06']) {
      await runner.query('INSERT INTO accounting.accounts(company_id,account_code,account_name,account_type_id) VALUES($1,$2,$3,$4)',[cid,code,'Same name',type.account_type_id]);
    }
    const repo=runner.manager.getRepository(Account);
    const options={order:{accountCode:'ASC',accountId:'ASC'},relations:{accountType:true}};
    const fields=['accountCode','accountName'];
    const first=await findCompanyList(repo,{companyId:cid,page:1,limit:2,q:'Same name'},options,fields);
    const next=await findCompanyList(repo,{companyId:cid,page:2,limit:2,q:'Same name'},options,fields);
    assert.equal(first.total,6); assert.equal(first.totalPages,3);
    assert.ok(next.items.every(item=>!first.items.some(a=>a.accountId===item.accountId)));
    const literal=await findCompanyList(repo,{companyId:cid,page:1,limit:2,q:'%_'},options,fields);
    assert.equal(literal.total,1); assert.equal(literal.items[0].accountCode,'A%_06');
    const none=await findCompanyList(repo,{companyId:cid,page:1,limit:2,q:'absent'},options,fields);
    assert.deepEqual(none.items,[]); assert.equal(none.totalPages,0);
  } finally { await runner.rollbackTransaction(); await runner.release(); }
});

test('financial report endpoints require login and Reports permissions', async () => {
  const token=app.get(JwtService).sign({sub:randomUUID()});
  for (const path of ['reports/financial/options','reports/financial','reports/financial/pdf']) {
    const url='/api/v1/'+path+'?companyId='+randomUUID()+'&asOf=2026-03-31';
    await request(app.getHttpServer()).get(url).expect(401);
    await request(app.getHttpServer()).get(url).set('Authorization','Bearer '+token).expect(401);
  }
});

test('financial report previews and PDF downloads validate filters and scoped company data', async t => {
  const ds=app.get(DataSource);
  const [user]=await ds.query(`SELECT ur.user_id FROM core.user_roles ur JOIN core.role_menus rm USING(role_id)
    JOIN core.menus m USING(menu_id) JOIN core.users u USING(user_id) WHERE m.menu_code='REPORTS' AND rm.can_view AND u.is_active AND NOT u.is_platform_admin AND u.user_id=$1 LIMIT 1`,[reportsUserId]);
  if(!user)return t.skip('A user with Reports permission must be seeded.');
  const token=app.get(JwtService).sign({sub:user.user_id});
  const [company]=await ds.query("SELECT company_id FROM core.companies WHERE company_code='KB01'");
  const get=url=>request(app.getHttpServer()).get(url).set('Authorization','Bearer '+token);
  const base='/api/v1/reports/financial?companyId='+company.company_id+'&asOf=2026-03-31';
  const options=(await get('/api/v1/reports/financial/options?companyId='+company.company_id).expect(200)).body;
  assert.ok(options.groups.some(g=>g.code==='156000'));
  for(const kind of ['trial-balance','profit-loss','account-balances']) {
    const result=(await get(base+'&report='+kind).expect(200)).body;
    assert.equal(result.kind,kind);assert.ok(Array.isArray(result.rows));assert.equal(result.companyName,options.company.companyName);
  }
  for(const extra of ['&report=other','&includeZero=bad','&groupCodes=unknown&report=account-balances','&groupCodes=156000','&report=account-balances&groupCodes=']) {
    await get(base+extra).expect(400);
  }
  for(const key of ['branchId','fiscalYearId'])await get(base+'&'+key+'='+randomUUID()).expect(403);
  await get(base.replace('2026-03-31','2026-02-30')).expect(400);
  await get(base.replace('2026-03-31','2026-03-31T12:00:00Z')).expect(400);
  await get(base.replace(company.company_id,randomUUID())).expect(403);
  const pdf=await get(base.replace('/financial?','/financial/pdf?')+'&report=account-balances&groupCodes=156000,157000')
    .buffer(true).parse((response,callback)=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>callback(null,Buffer.concat(chunks)));}).expect(200);
  assert.match(pdf.headers['content-type'],/application\/pdf/);
  assert.match(pdf.headers['content-disposition'],/account-balances-2026-03-31\.pdf/);
  assert.equal(pdf.body.subarray(0,5).toString(),'%PDF-');
});

test('financial reports compute month, fiscal-year, closing balances, net profit, branch filters, and reversals exactly', async () => {
  const { FinancialReportsService }=require('../dist/reports/financial-reports.service');
  const runner=app.get(DataSource).createQueryRunner();
  await runner.connect();await runner.startTransaction();
  try {
    const cid=randomUUID(),fy=randomUUID(),fyPrior=randomUUID(),period=randomUUID(),priorPeriod=randomUUID(),branchA=randomUUID(),branchB=randomUUID();
    await runner.query('INSERT INTO core.companies(company_id,company_code,company_name,address) VALUES($1,$2,$3,$4)',[cid,'REPORT-'+cid,'Report fixture & company','Test address']);
    for(const [id,code] of [[branchA,'A'],[branchB,'B']])await runner.query('INSERT INTO core.branches(branch_id,company_id,branch_code,branch_name) VALUES($1,$2,$3,$3)',[id,cid,code]);
    for(const [id,pid,year] of [[fy,period,'2026'],[fyPrior,priorPeriod,'2025']]) {
      await runner.query('INSERT INTO accounting.fiscal_years(fiscal_year_id,company_id,year_name,start_date,end_date) VALUES($1,$2,$3,$4,$5)',[id,cid,'FY '+year,year+'-01-01',year+'-12-31']);
      await runner.query('INSERT INTO accounting.accounting_periods(period_id,fiscal_year_id,period_number,period_name,start_date,end_date) VALUES($1,$2,1,$3,$4,$5)',[pid,id,'Fixture '+year,year+'-01-01',year+'-12-31']);
    }
    const typeRows=await runner.query('SELECT code,account_type_id FROM accounting.account_types');
    const types=Object.fromEntries(typeRows.map(r=>[r.code,r.account_type_id]));
    const accounts={};
    for(const [group,name,type] of [['156000','Bank balances','ASSET'],['410000','Commission income','REVENUE'],['512000','Operating expense','EXPENSE'],['310000','Capital','EQUITY']]) {
      const header=randomUUID(),detail=randomUUID();accounts[group]=detail;
      await runner.query(`INSERT INTO accounting.accounts(account_id,company_id,account_code,account_name,account_type_id,is_header,allow_posting)
        VALUES($1,$2,$3,$4,$5,TRUE,FALSE)`,[header,cid,group+'-00000',name,types[type]]);
      await runner.query(`INSERT INTO accounting.accounts(account_id,company_id,parent_account_id,account_code,account_name,account_type_id)
        VALUES($1,$2,$3,$4,$5,$6)`,[detail,cid,header,group+'-00001',name+' detail',types[type]]);
    }
    async function journal(day,status,debitGroup,creditGroup,value,branch=branchA) {
      const id=randomUUID();
      await runner.query('INSERT INTO accounting.journal_entries(journal_entry_id,company_id,branch_id,period_id,transaction_date,description,status,total_debit,total_credit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',[id,cid,branch,day.startsWith('2025')?priorPeriod:period,day,'Report fixture',status,value]);
      await runner.query('INSERT INTO accounting.journal_entry_lines(journal_entry_id,account_id,line_number,debit_amount,credit_amount) VALUES($1,$2,1,$4,0),($1,$3,2,0,$4)',[id,accounts[debitGroup],accounts[creditGroup],value]);
    }
    await journal('2025-12-01','POSTED','156000','310000','1000.00');
    await journal('2026-01-12','POSTED','156000','410000','200.00');
    await journal('2026-03-03','POSTED','156000','410000','100.00');
    await journal('2026-03-05','POSTED','512000','156000','40.00');
    await journal('2026-03-07','POSTED','512000','156000','10.00',branchB);
    await journal('2026-03-09','REVERSED','156000','410000','20.00');
    await journal('2026-03-09','POSTED','410000','156000','20.00');
    await journal('2026-03-10','DRAFT','512000','156000','100.00');
    await journal('2026-04-01','POSTED','156000','410000','900.00');
    const service=new FinancialReportsService({query:runner.query.bind(runner)});
    const base={companyId:cid,asOf:'2026-03-31',includeZero:true};
    const trial=await service.generate({...base,report:'trial-balance'});
    assert.equal(trial.balanced,true);
    assert.equal(trial.rows.length,4); // Header accounts and detail accounts are not counted twice.
    assert.deepEqual(trial.totals[0].values,{monthDebit:'100.00',monthCredit:'100.00',ytdDebit:'1300.00',ytdCredit:'1300.00'});
    const bank=trial.rows.find(row=>row.accountCode==='156000-00000');assert.equal(bank.monthDebit,'50.00');assert.equal(bank.ytdDebit,'1250.00');
    const pnl=await service.generate({...base,report:'profit-loss'});
    assert.deepEqual(pnl.totals[0].values,{monthAmount:'-50.00',ytdAmount:'-250.00'});
    assert.ok(pnl.warnings.includes('1 unposted journals through this date are excluded.'));
    const branch=await service.generate({...base,report:'profit-loss',branchId:branchA});assert.equal(branch.totals[0].values.monthAmount,'-60.00');
    const detail=await service.generate({...base,report:'account-balances',groupCodes:['156000']});
    assert.equal(detail.rows.length,1);assert.equal(detail.totals[0].values.balance,'1250.00');
    assert.equal(detail.rows[0].accountCode,'156000-00001');
    const options=await service.options(cid);assert.equal(options.groups.length,4);assert.equal(options.groups.find(g=>g.code==='156000').name,'Bank balances');
    const selected=await service.generate({...base,report:'profit-loss',fiscalYearId:fy});assert.equal(selected.totals[0].values.ytdAmount,'-250.00');
    const overlapping=randomUUID();
    await runner.query('INSERT INTO accounting.fiscal_years(fiscal_year_id,company_id,year_name,start_date,end_date) VALUES($1,$2,$3,$4,$5)',[overlapping,cid,'Alternate FY','2025-07-01','2026-06-30']);
    await assert.rejects(()=>service.generate({...base,report:'profit-loss'}),/Overlapping fiscal years/);
    const alternate=await service.generate({...base,report:'profit-loss',fiscalYearId:overlapping});assert.equal(alternate.fiscalYearStart,'2025-07-01');
    await assert.rejects(()=>service.generate({...base,report:'profit-loss',branchId:randomUUID()}),/Branch must belong/);
    await assert.rejects(()=>service.generate({...base,report:'account-balances',groupCodes:['missing'],fiscalYearId:fy}),/account groups/);
  }finally{await runner.rollbackTransaction();await runner.release();}
});

test('invoices auto-number sequentially, reject duplicates, and download as PDF', async t => {
  const ds=app.get(DataSource);
  await request(app.getHttpServer()).get('/api/v1/invoices/'+randomUUID()+'/pdf').expect(401);
  const [user]=await ds.query(`SELECT ur.user_id FROM core.user_roles ur
    JOIN core.role_menus rm ON rm.role_id=ur.role_id
    JOIN core.menus m ON m.menu_id=rm.menu_id
    WHERE m.menu_code='INVOICES' AND rm.can_view AND ur.user_id=$1 LIMIT 1`,[reportsUserId]);
  if(!user)return t.skip('A user with Invoices permission must be seeded.');
  const token=app.get(JwtService).sign({sub:user.user_id});
  const [company]=await ds.query("SELECT company_id FROM core.companies WHERE company_code='KB01'");
  const [customer]=await ds.query('SELECT customer_id FROM sales.customers WHERE company_id=$1 AND is_active LIMIT 1',[company.company_id]);
  const [account]=await ds.query("SELECT a.account_id FROM accounting.accounts a JOIN accounting.account_types t USING(account_type_id) WHERE a.company_id=$1 AND a.is_active AND a.allow_posting AND NOT a.is_header AND t.code='REVENUE' LIMIT 1",[company.company_id]);
  if(!customer||!account)return t.skip('KB01 invoice fixtures must be seeded.');
  const post=body=>request(app.getHttpServer()).post('/api/v1/invoices').set('Authorization','Bearer '+token).send(body);
  const revenue=await request(app.getHttpServer()).get('/api/v1/accounts?companyId='+company.company_id+'&type=REVENUE&postable=true').set('Authorization','Bearer '+token).expect(200);
  for(const a of revenue.body){
    assert.equal(a.accountType.code,'REVENUE');
    assert.ok(a.allowPosting&&!a.isHeader&&a.isActive);
  }
  assert.ok(revenue.body.some(a=>a.accountId===account.account_id),'filtered list must contain the postable revenue account');
  const unfiltered=await request(app.getHttpServer()).get('/api/v1/accounts?companyId='+company.company_id+'&type=REVENUE').set('Authorization','Bearer '+token).expect(200);
  assert.ok(unfiltered.body.some(a=>a.isHeader),'type filter alone keeps header accounts');
  const line={description:'E2E verification line',quantity:'2.0000',unitPrice:'100.00',discountAmount:'0.00',taxAmount:'0.00',revenueAccountId:account.account_id};
  const base={companyId:company.company_id,customerId:customer.customer_id,invoiceDate:'2024-06-30',lines:[line]};
  const created=[];
  try {
    const first=await post(base).expect(201);
    const second=await post(base).expect(201);
    created.push(first.body.invoiceId,second.body.invoiceId);
    assert.match(first.body.invoiceNumber,/^INV-20240630-\d{4}$/);
    assert.equal(second.body.invoiceNumber,'INV-20240630-'+String(Number(first.body.invoiceNumber.slice(-4))+1).padStart(4,'0'));
    assert.equal(first.body.totalAmount,'200.00');
    const manual=await post({...base,invoiceNumber:first.body.invoiceNumber}).expect(400);
    assert.match(manual.body.message,/generated automatically/);
    const pdf=await request(app.getHttpServer()).get('/api/v1/invoices/'+first.body.invoiceId+'/pdf').set('Authorization','Bearer '+token)
      .buffer(true).parse((res,done)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>done(null,Buffer.concat(chunks)));}).expect(200);
    assert.match(pdf.headers['content-type'],/application\/pdf/);
    assert.match(pdf.headers['content-disposition'],new RegExp(first.body.invoiceNumber+'\.pdf'));
    assert.equal(pdf.body.subarray(0,5).toString(),'%PDF-');
    fs.mkdirSync('output/pdf',{recursive:true});
    fs.writeFileSync('output/pdf/invoice-download-verification.pdf',pdf.body);
    // Tenant ownership runs before existence: unknown ids surface as 403 for company users.
    await request(app.getHttpServer()).get('/api/v1/invoices/'+randomUUID()+'/pdf').set('Authorization','Bearer '+token).expect(403);
  } finally {
    if(created.length)await ds.query('DELETE FROM sales.invoices WHERE invoice_id = ANY($1)',[created]);
  }
});
