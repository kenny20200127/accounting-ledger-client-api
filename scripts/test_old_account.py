import tempfile
import unittest
from pathlib import Path
from decimal import Decimal
from resume_old_account import read_source, prepare_voucher, money, parse_date, voucher_key
from migrate_old_account import parse_mssql_values

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.accounts = {c:dict(account_id=c,is_header=False,allow_posting=True,is_active=True) for c in ['A','B','BANK']}
    def test_parser_preserves_money_quotes_and_dates(self):
        values=parse_mssql_values("N'O''Brien, Lagos', 99999999999999.9900, CAST(N'2006-01-02T00:00:00' AS DateTime), NULL")
        self.assertEqual(values,["O'Brien, Lagos",Decimal('99999999999999.9900'),'2006-01-02T00:00:00',None])
    def test_multiline_insert_and_changed_column_order(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'source.sql'
            p.write_text("INSERT [dbo].[accchart] ([acctnumber], [description]) VALUES (N'A', N'first\nline')\nINSERT INTO [dbo].[accchart] ([description], [acctnumber]) VALUES (N'second', N'B')",encoding='utf-16')
            rows=read_source(p)['accchart']
            self.assertEqual(rows,[{'acctnumber':'A','description':'first\nline'},{'description':'second','acctnumber':'B'}])
    def voucher(self,p='jv',debit='10',credit='10'):
        return {p+'h_date':'20060102',p+'h_debit':debit,p+'h_credit':credit,p+'h_bank':'BANK'}
    def detail(self,p,account,debit,credit):
        return {p+'_account':account,p+'_debit':debit,p+'_credit':credit,p+'_bank':'BANK'}
    def test_balanced_journal(self):
        r=prepare_voucher(self.voucher(),[self.detail('jv','A','10','0'),self.detail('jv','B','0','10')],'jv',self.accounts)
        self.assertEqual(r[4],[])
        self.assertEqual(r[2],r[3])
    def test_missing_account_never_silently_posts(self):
        r=prepare_voucher(self.voucher(),[self.detail('jv','A','10','0'),self.detail('jv','MISSING','0','10')],'jv',self.accounts)
        self.assertIn('Missing account MISSING',r[4])
    def test_cash_counterparts_come_from_explicit_bank(self):
        for p,debit,credit in [('rct','0','10'),('pcv','10','0')]:
            r=prepare_voucher(self.voucher(p,debit,credit),[self.detail(p,'A',debit,credit)],p,self.accounts)
            self.assertEqual(r[4],[])
            self.assertEqual(r[2],Decimal('10'))
            self.assertEqual(r[2],r[3])
            self.assertEqual(r[1][-1][0],'BANK')
    def test_header_mismatch_does_not_generate_bank_line(self):
        r=prepare_voucher(self.voucher('rct','0','11'),[self.detail('rct','A','0','10')],'rct',self.accounts)
        self.assertIn('Header totals do not match imported lines',r[4])
        self.assertEqual(len(r[1]),1)
    def test_invalid_line_and_bank_conflict_are_reviewed(self):
        r=prepare_voucher(self.voucher(),[self.detail('jv','A','10','10')],'jv',self.accounts)
        self.assertIn('Invalid debit/credit line for A',r[4])
        d=self.detail('rct','A','0','10'); d['rct_bank']='B'
        r=prepare_voucher(self.voucher('rct','0','10'),[d],'rct',self.accounts)
        self.assertIn('Detail bank accounts conflict with header bank',r[4])
    def test_company_and_branch_are_part_of_identity(self):
        a={'coycode':'KB01','branchcode':'4','jv_number':'J1'}
        b={**a,'coycode':'OTHER'}
        self.assertNotEqual(voucher_key(a,'jv','coycode','branchcode'),voucher_key(b,'jv','coycode','branchcode'))
    def test_invalid_calendar_dates_and_rounding(self):
        self.assertIsNone(parse_date('20060230'))
        self.assertEqual(money('0.0050'),Decimal('0.01'))

if __name__=='__main__': unittest.main()
