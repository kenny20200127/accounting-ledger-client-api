"""Repeatable legacy import: exact company keys, atomic writes, retained source evidence.
Dry runs read the database but never modify it. Invalid vouchers become DRAFT/review.
Ledger snapshots are retained separately; they are not invented opening journals.
"""
import calendar
import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import psycopg2
from psycopg2.extras import Json, execute_values, RealDictCursor
from migrate_old_account import parse_mssql_values, determine_account_type

ROOT = Path(__file__).resolve().parent.parent
TABLES = ['accsystem', 'gb_Branch', 'accmainact', 'accchart', 'accsubtype',
          'ac_costcentre', 'gb_customer', 'gb_agent', 'ac_jvheader', 'ac_jvdetails',
          'ac_rctheader', 'ac_rctdetails', 'ac_pcvheader', 'ac_pcvdetails', 'accledger']
SPECS = [(6, 'jv', 'JV', 'coycode', 'branchcode'),
         (7, 'rct', 'RECEIPT', 'coy_code', 'Branch_code'),
         (8, 'pcv', 'PAYMENT', 'coycode', 'branchcode')]

def text(value):
    return str(value).strip() if value is not None else ''

def encode(value):
    return json.dumps(value, default=str, ensure_ascii=False)

def read_source(path):
    """Accept varying INSERT column order and multiline string literals."""
    result = {t: [] for t in TABLES}
    pattern = re.compile(r'INSERT\s+(?:INTO\s+)?\[dbo\]\.\[([^\]]+)\]\s*\(([^)]+)\)\s+VALUES\s*\(', re.I)
    with open(path, 'rb') as f:
        encoding = 'utf-16' if f.read(2) in (b'\xff\xfe', b'\xfe\xff') else 'utf-8-sig'
    with open(path, encoding=encoding, errors='strict') as f:
        for line in f:
            match = pattern.search(line)
            if not match or match[1] not in result:
                continue
            table = match[1]
            columns = [c.strip().strip('[]') for c in match[2].split(',')]
            buffer = line[match.end():]
            # Quote state and parenthesis depth determine when VALUES closes.
            quoted, depth, pos = False, 1, 0
            while depth:
                while pos < len(buffer) and depth:
                    ch = buffer[pos]
                    if ch == "'":
                        if quoted and pos+1 < len(buffer) and buffer[pos+1] == "'":
                            pos += 2
                            continue
                        quoted = not quoted
                    elif not quoted:
                        if ch == '(': depth += 1
                        elif ch == ')': depth -= 1
                    pos += 1
                if depth:
                    following = next(f, None)
                    if following is None: raise ValueError('Unterminated INSERT for '+table)
                    buffer += following
            values = parse_mssql_values(buffer[:pos-1])
            if len(values) != len(columns):
                raise ValueError(f'{table}: {len(values)} values for {len(columns)} columns')
            result[table].append(dict(zip(columns, values)))
    return result

def parse_date(value):
    s = text(value)
    if re.fullmatch(r'\d{8}', s): s = s[:4]+'-'+s[4:6]+'-'+s[6:]
    try: return date.fromisoformat(s[:10]).isoformat()
    except ValueError: return None

def money(value):
    return Decimal(text(value) or '0').quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def voucher_key(row, prefix, company_column, branch_column, header=False):
    return (text(row.get(company_column)), text(row.get(branch_column)),
            text(row.get(prefix+('h_number' if header else '_number'))))

def prepare_voucher(header, details, prefix, accounts):
    issues, lines = [], []
    txn_date = parse_date(header.get(prefix+'h_date'))
    if not txn_date: issues.append('Invalid transaction date')
    if not details: issues.append('No source detail rows')
    deleted = (text(header.get('deletedind') or header.get('deleteind')).upper() == 'Y'
               or bool(header.get('datedeleted')))
    for d in details:
        if d.get('datedeleted') or text(d.get('deletemarker')).upper() in ('Y','YES'):
            continue
        code = text(d.get(prefix+'_account'))
        account = accounts.get(code)
        debit, credit = money(d.get(prefix+'_debit')), money(d.get(prefix+'_credit'))
        if debit == credit == 0: continue
        if debit < 0 or credit < 0 or (debit > 0 and credit > 0):
            issues.append('Invalid debit/credit line for '+code)
            continue
        if not account:
            issues.append('Missing account '+code)
            continue
        if account['is_header'] or not account['allow_posting'] or not account['is_active']:
            issues.append('Non-posting account '+code)
        lines.append((account['account_id'], text(d.get(prefix+'_remark')), debit, credit))
    debit = sum((x[2] for x in lines), Decimal(0))
    credit = sum((x[3] for x in lines), Decimal(0))
    header_debit = money(header.get(prefix+'h_debit'))
    header_credit = money(header.get(prefix+'h_credit'))
    if debit != header_debit or credit != header_credit:
        issues.append('Header totals do not match imported lines')
    # Cash voucher headers explicitly name the bank account; details exclude
    # that bank counterpart. Require exact detail/header agreement first.
    if prefix in ('rct','pcv') and debit != credit and not issues:
        bank_code = text(header.get(prefix+'h_bank'))
        bank = accounts.get(bank_code)
        detail_banks = {text(d.get(prefix+'_bank')) for d in details if text(d.get(prefix+'_bank'))}
        if not bank or bank['is_header'] or not bank['allow_posting'] or not bank['is_active']:
            issues.append('Missing or non-posting voucher bank '+bank_code)
        elif detail_banks and detail_banks != {bank_code}:
            issues.append('Detail bank accounts conflict with header bank')
        elif any(l[0] == bank['account_id'] for l in lines):
            issues.append('Bank already appears in details; counterpart needs review')
        else:
            delta = debit-credit
            lines.append((bank['account_id'], 'Bank counterpart from source voucher header',
                          max(-delta,Decimal(0)),max(delta,Decimal(0))))
            debit = sum((x[2] for x in lines),Decimal(0))
            credit = sum((x[3] for x in lines),Decimal(0))
    if len(lines) < 2: issues.append('Fewer than two valid lines')
    if debit <= 0 or debit != credit: issues.append(f'Unbalanced detail totals: {debit} / {credit}')
    return txn_date, lines, debit, credit, sorted(set(issues)), deleted

def migrate(path, dry_run=False, phases=None):
    phases = set(phases or range(1,10))
    if not phases <= set(range(1,10)): raise ValueError('Phases must be between 1 and 9')
    source = read_source(path)
    systems = source['accsystem']
    if len(systems) != 1 or not text(systems[0].get('coycode')):
        raise ValueError('Exactly one identifiable source company is required')
    system = systems[0]
    company_code = text(system['coycode'])
    conn = psycopg2.connect(host=os.getenv('DB_HOST','localhost'), port=os.getenv('DB_PORT','5432'),
        user=os.getenv('DB_USERNAME','postgres'), password=os.getenv('DB_PASSWORD'),
        dbname=os.getenv('DB_DATABASE','accountingdb'))
    report = {'companyCode': company_code, 'dryRun': dry_run, 'sourceCounts': {k:len(v) for k,v in source.items()},
              'vouchers': {}, 'issues': [], 'masterData': {}}
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Single transaction and advisory lock serialize retries.
            cur.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', ('old-account:'+company_code,))
            cur.execute('SELECT * FROM core.companies WHERE company_code=%s', (company_code,))
            company = cur.fetchone()
            if not company: raise ValueError('Create the source company before resuming: '+company_code)
            cid = company['company_id']
            if not dry_run:
                backup_dir = ROOT/'database'/'backups'
                backup_dir.mkdir(exist_ok=True)
                backup = {}
                for table in ['core.companies','core.branches','sales.customers','purchasing.suppliers',
                              'accounting.accounts','accounting.fiscal_years','accounting.accounting_periods',
                              'accounting.journal_entries','accounting.journal_entry_lines']:
                    cur.execute('SELECT * FROM '+table)
                    backup[table] = list(cur.fetchall())
                backup_path = backup_dir/('before-old-account-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json')
                backup_path.write_text(encode(backup), encoding='utf-8')
                report['backupFile'] = str(backup_path)
                cur.execute((ROOT/'database/migrations/20261014_resume_old_account.sql').read_text(encoding='utf-8-sig'))

            if 1 in phases and not dry_run:
                cur.execute("""UPDATE core.companies SET company_name=%s,address=%s,city=%s,state=%s,
                  phone=%s,email=%s WHERE company_id=%s""",
                  (text(system.get('coyname')),text(system.get('coyaddress')) or None,
                   text(system.get('town')) or None,text(system.get('state')) or None,
                   text(system.get('telephone')) or None,text(system.get('email')) or None,cid))
                for branch in source['gb_Branch']:
                    cur.execute("""INSERT INTO core.branches(company_id,branch_code,branch_name,address,phone,email)
                      VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(company_id,branch_code) DO UPDATE SET
                      branch_name=EXCLUDED.branch_name,address=EXCLUDED.address,phone=EXCLUDED.phone,email=EXCLUDED.email""",
                      (cid,text(branch.get('Branch_code')),text(branch.get('Branch_desc')),
                       text(branch.get('Branch_address')) or None,text(branch.get('Branch_phone')) or None,
                       text(branch.get('Branch_email')) or None))
            cur.execute('SELECT code,account_type_id FROM accounting.account_types')
            types = {r['code']:r['account_type_id'] for r in cur.fetchall()}
            if 2 in phases and not dry_run:
                for table, header in [('accmainact',True),('accchart',False)]:
                    for r in source[table]:
                        code = text(r.get('acctnumber'))
                        if not code: continue
                        type_code = determine_account_type(r.get('acctcode1'),r.get('acctype'))
                        if type_code not in types: raise ValueError('Missing account type '+type_code)
                        cur.execute('''INSERT INTO accounting.accounts
                          (company_id,account_code,account_name,account_type_id,is_header,allow_posting,is_control_account)
                          VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(company_id,account_code) DO UPDATE SET
                          account_name=EXCLUDED.account_name,account_type_id=EXCLUDED.account_type_id,
                          is_header=EXCLUDED.is_header,allow_posting=EXCLUDED.allow_posting,
                          is_control_account=EXCLUDED.is_control_account''',
                          (cid,code,text(r.get('description'))[:150],types[type_code],header,not header,text(r.get('acctsubtype')) in ('2','3')))
                # Assign each detail to its six-digit header if present.
                cur.execute('''UPDATE accounting.accounts a SET parent_account_id=p.account_id
                  FROM accounting.accounts p WHERE a.company_id=%s AND p.company_id=a.company_id
                  AND NOT a.is_header AND p.is_header AND p.account_code=split_part(a.account_code,'-',1)||'-00000'
                  AND a.account_id<>p.account_id''',(cid,))
            cur.execute('SELECT * FROM accounting.accounts WHERE company_id=%s',(cid,))
            accounts = {r['account_code']:r for r in cur.fetchall()}
            if not accounts: raise ValueError('Import source accounts before vouchers')
            cur.execute('SELECT branch_code,branch_id FROM core.branches WHERE company_id=%s',(cid,))
            branches = {r['branch_code']:r['branch_id'] for r in cur.fetchall()}
            # Keep the source branch identity; the earlier HQ alias was an assumption.
            branch_codes = set()
            for _,p,_,cc,bc in SPECS:
                for h in source['ac_'+p+'header']:
                    if text(h.get(cc)) != company_code: raise ValueError('Unexpected source company')
                    branch_codes.add(text(h.get(bc)))
            if not dry_run:
                for code in sorted(branch_codes-set(branches)):
                    cur.execute('''INSERT INTO core.branches(company_id,branch_code,branch_name,is_active)
                      VALUES(%s,%s,%s,TRUE) RETURNING branch_id''',(cid,code,'Legacy branch '+code))
                    branches[code] = cur.fetchone()['branch_id']
            # Derive all historical periods from actual voucher dates.
            dates = [parse_date(h.get(p+'h_date')) for _,p,_,_,_ in SPECS for h in source['ac_'+p+'header']]
            years = sorted({int(d[:4]) for d in dates if d} | {date.today().year})
            if not dry_run and (3 in phases or phases & {6,7,8}):
                for year in years:
                    cur.execute('''INSERT INTO accounting.fiscal_years(company_id,year_name,start_date,end_date,is_closed)
                      VALUES(%s,%s,%s,%s,%s) ON CONFLICT(company_id,year_name) DO NOTHING''',
                      (cid,f'FY {year}',f'{year}-01-01',f'{year}-12-31',year<date.today().year))
                    cur.execute('SELECT fiscal_year_id FROM accounting.fiscal_years WHERE company_id=%s AND year_name=%s',(cid,f'FY {year}'))
                    fy = cur.fetchone()['fiscal_year_id']
                    for month in range(1,13):
                        end = date(year,month,calendar.monthrange(year,month)[1])
                        current = year == date.today().year and month == date.today().month
                        cur.execute('''INSERT INTO accounting.accounting_periods
                          (fiscal_year_id,period_number,period_name,start_date,end_date,is_open,is_closed)
                          VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(fiscal_year_id,period_number) DO NOTHING''',
                          (fy,month,f'{calendar.month_name[month]} {year}',date(year,month,1),end,current,end<date.today()))
            cur.execute('''SELECT ap.period_id,ap.start_date,ap.end_date FROM accounting.accounting_periods ap
              JOIN accounting.fiscal_years fy USING(fiscal_year_id) WHERE fy.company_id=%s''',(cid,))
            periods = {(r['start_date'].year,r['start_date'].month):r['period_id'] for r in cur.fetchall()}
            cur.execute("""SELECT conrelid::regclass::text AS referencing_table FROM pg_constraint
              WHERE contype='f' AND confrelid='purchasing.suppliers'::regclass""")
            supplier_references = list(cur.fetchall())
            # Upsert source customers and suppliers only into the exact company.
            for phase,table,target,codecol,namecol,accountcol in [
                (4,'gb_customer','sales.customers','customer_code','customer_name','receivable_account_id'),
                (5,'gb_agent','purchasing.suppliers','supplier_code','supplier_name','payable_account_id')]:
                if phase not in phases: continue
                count = 0
                for r in source[table]:
                    customer = phase == 4
                    code = text(r.get('CM_Code' if customer else 'Agent_Code'))
                    name = text(r.get('CM_Name' if customer else 'Agent_Name'))
                    if not code or not name: continue
                    count += 1
                    if dry_run: continue
                    linked = accounts.get(text(r.get('CM_GEN_CODE' if customer else 'Agent_Code')))
                    aid = linked['account_id'] if linked and not linked['is_header'] else None
                    phone = text(r.get('CM_PhoneNo' if customer else 'Agent_Phone')) or None
                    address = ', '.join(text(r.get(k)) for k in ['CM_Addr1','CM_Addr2','CM_Addr3'] if text(r.get(k))) if customer else text(r.get('Agent_Address'))
                    addresscol = 'billing_address' if customer else 'address'
                    idcol = 'customer_id' if customer else 'supplier_id'
                    unused = ('NOT EXISTS(SELECT 1 FROM sales.invoices i WHERE i.customer_id=t.customer_id) '
                              'AND NOT EXISTS(SELECT 1 FROM sales.customer_payments p WHERE p.customer_id=t.customer_id)') if customer else (
                              'TRUE')
                    cur.execute(f"""SELECT {idcol} FROM {target} t WHERE company_id<>%s
                      AND {codecol}=%s AND {namecol}=%s AND phone IS NOT DISTINCT FROM %s
                      AND {addresscol} IS NOT DISTINCT FROM %s AND {unused}
                      AND NOT EXISTS(SELECT 1 FROM {target} x WHERE x.company_id=%s AND x.{codecol}=%s)
                      FOR UPDATE""",(cid,code,name[:150],phone,address or None,cid,code))
                    misplaced = cur.fetchall()
                    if len(misplaced)==1 and (customer or not supplier_references):
                        cur.execute(f'UPDATE {target} SET company_id=%s,{accountcol}=%s WHERE {idcol}=%s',
                                    (cid,aid,misplaced[0][idcol]))
                        report['masterData']['relocated'] = report['masterData'].get('relocated',0)+1
                    cur.execute(f'''INSERT INTO {target}(company_id,{codecol},{namecol},phone,{addresscol},{accountcol},is_active)
                      VALUES(%s,%s,%s,%s,%s,%s,TRUE) ON CONFLICT(company_id,{codecol}) DO UPDATE SET
                      {namecol}=EXCLUDED.{namecol},phone=EXCLUDED.phone,{addresscol}=EXCLUDED.{addresscol},
                      {accountcol}=COALESCE(EXCLUDED.{accountcol},{target}.{accountcol})''',
                      (cid,code,name[:150],phone,address or None,aid))
                    if customer:
                        cur.execute('UPDATE sales.customers SET email=%s WHERE company_id=%s AND customer_code=%s',
                                    (text(r.get('CM_Email')) or None,cid,code))
                report['masterData'][table] = count

            # Retain snapshots and lookup rows, not cumulative balances as new transactions.
            snapshots = []
            for table in TABLES:
                if table.endswith('header'): continue
                occurrences = Counter()
                for r in source[table]:
                    digest = hashlib.sha256(encode(r).encode()).hexdigest()
                    occurrences[digest] += 1
                    snapshots.append((cid,table,digest+':'+str(occurrences[digest]),'SNAPSHOT',Json(r,dumps=encode)))
            if not dry_run:
                execute_values(cur,'''INSERT INTO accounting.legacy_migration_records
                  (company_id,source_table,source_key,status,source_data) VALUES %s
                  ON CONFLICT(company_id,source_table,source_key) DO UPDATE SET source_data=EXCLUDED.source_data''',snapshots,page_size=1000)

            for phase,prefix,source_type,cc,bc in SPECS:
                if phase not in phases: continue
                by_key = defaultdict(list)
                for d in source['ac_'+prefix+'details']:
                    by_key[voucher_key(d,prefix,cc,bc)].append(d)
                stats = Counter()
                header_counts = Counter(voucher_key(h,prefix,cc,bc,True) for h in source['ac_'+prefix+'header'])
                seen = Counter()
                for h in source['ac_'+prefix+'header']:
                    key = voucher_key(h,prefix,cc,bc,True)
                    seen[key] += 1
                    source_key = '|'.join(key) + (':'+str(seen[key]) if header_counts[key]>1 else '')
                    txn_date,lines,debit,credit,issues,deleted = prepare_voucher(h,by_key.get(key,[]),prefix,accounts)
                    if header_counts[key]>1:
                        issues.append('Duplicate source voucher number; detail ownership needs review')
                        lines, debit, credit = [], Decimal(0), Decimal(0)
                    status = 'CANCELLED' if deleted else ('DRAFT' if issues else 'POSTED')
                    record_status = 'DELETED' if deleted else ('REVIEW' if issues else 'IMPORTED')
                    stats[record_status] += 1
                    if issues and not deleted: report['issues'].append({'table':'ac_'+prefix+'header','key':source_key,'issues':issues})
                    if dry_run: continue
                    # The tracking key owns the journal on every subsequent run.
                    cur.execute('''SELECT journal_entry_id,source_data FROM accounting.legacy_migration_records
                      WHERE company_id=%s AND source_table=%s AND source_key=%s''',(cid,'ac_'+prefix+'header',source_key))
                    prior = cur.fetchone()
                    jid = prior['journal_entry_id'] if prior else None
                    if prior:
                        if prior['source_data'] != json.loads(encode(h)):
                            raise ValueError('Tracked source header changed; review before reimport: '+source_key)
                        # Never undo a user's later edits or double import lines.
                        stats['UNCHANGED'] += 1
                        continue
                    # Recover only pristine empty headers matching the old importer exactly.
                    cur.execute('''SELECT j.* FROM accounting.journal_entries j WHERE source_type=%s
                      AND reference_number=%s AND transaction_date=%s AND total_debit=%s AND total_credit=%s
                      AND created_by IS NULL AND posted_by IS NULL AND source_id IS NULL AND reversed_journal_id IS NULL
                      AND status='POSTED' AND NOT EXISTS(SELECT 1 FROM accounting.journal_entry_lines l WHERE l.journal_entry_id=j.journal_entry_id)
                      ORDER BY j.journal_number FOR UPDATE''',(source_type,key[2],txn_date,money(h.get(prefix+'h_debit')),money(h.get(prefix+'h_credit'))))
                    candidates = cur.fetchall()
                    if len(candidates)>1 and header_counts[key]==1: raise ValueError('Multiple old headers match '+source_key)
                    existing = candidates[0] if candidates else None
                    period = periods.get((int(txn_date[:4]),int(txn_date[5:7]))) if txn_date else None
                    if not period:
                        # Bad dates retain source evidence without inventing a date.
                        if existing: raise ValueError('Cannot resolve historical period '+source_key)
                        jid = None
                    else:
                        branch = branches[key[1]]
                        description = text(h.get(prefix+'h_remark')) or source_type+' '+key[2]
                        if existing:
                            jid = existing['journal_entry_id']
                            cur.execute('''UPDATE accounting.journal_entries SET company_id=%s,branch_id=%s,period_id=%s,
                              description=%s,status=%s,total_debit=%s,total_credit=%s,posted_at=%s WHERE journal_entry_id=%s''',
                              (cid,branch,period,description,status,debit,credit,datetime.now() if status=='POSTED' else None,jid))
                            stats['REPAIRED'] += 1
                        else:
                            cur.execute('''INSERT INTO accounting.journal_entries
                              (company_id,branch_id,period_id,transaction_date,reference_number,description,source_type,status,total_debit,total_credit,posted_at)
                              VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING journal_entry_id''',
                              (cid,branch,period,txn_date,key[2],description,source_type,status,debit,credit,datetime.now() if status=='POSTED' else None))
                            jid = cur.fetchone()['journal_entry_id']
                            stats['CREATED'] += 1
                        if lines:
                            execute_values(cur,'''INSERT INTO accounting.journal_entry_lines
                              (journal_entry_id,account_id,line_number,description,debit_amount,credit_amount) VALUES %s''',
                              [(jid,*line[:1],i+1,line[1],line[2],line[3]) for i,line in enumerate(lines)])
                    cur.execute('''INSERT INTO accounting.legacy_migration_records
                      (company_id,source_table,source_key,journal_entry_id,status,issues,source_data)
                      VALUES(%s,%s,%s,%s,%s,%s,%s)''',
                      (cid,'ac_'+prefix+'header',source_key,jid,record_status,Json(issues),Json(h,dumps=encode)))
                report['vouchers'][source_type] = dict(stats)
            if 9 in phases and not dry_run:
                # Cancel the empty, synthetic balance header from the failed import.
                # Its totals are not an authoritative opening balance and must not be replayed.
                codes = sorted({text(r.get('branch')) for r in source['accledger']})
                cur.execute('''UPDATE accounting.journal_entries j SET status='CANCELLED'
                  WHERE source_type='OPENING' AND description='Opening Balance Migration'
                  AND reference_number=ANY(%s) AND transaction_date='2006-01-01' AND created_by IS NULL
                  AND posted_by IS NULL AND source_id IS NULL AND status='POSTED'
                  AND NOT EXISTS(SELECT 1 FROM accounting.journal_entry_lines l WHERE l.journal_entry_id=j.journal_entry_id)''',
                  (['OB-'+b for b in codes],))
                report['cancelledSyntheticOpeningHeaders'] = cur.rowcount
            if dry_run: conn.rollback()
            else: conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    out = ROOT/'database'/('old-account-dry-run.json' if dry_run else 'old-account-migration-report.json')
    out.write_text(encode(report),encoding='utf-8')
    print(encode({k:v for k,v in report.items() if k!='issues'}))
    print(f'Review records: {len(report["issues"])}. Report: {out}')
    return report
