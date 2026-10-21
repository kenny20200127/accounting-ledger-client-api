#!/usr/bin/env python3
"""Resume the legacy accounting import through resume_old_account.py.
Run via npm run migrate:old-account to load .env without exposing credentials.
Phases: 1 source company/branches; 2 accounts; 3 historical periods;
4 customers; 5 agents/suppliers; 6 journals; 7 receipts; 8 payments;
9 retain ledger snapshots and cancel the failed synthetic opening header.
Dry runs read the configured database but perform no database writes.
"""

import os
import re
import argparse
from typing import Optional
from decimal import Decimal

# Optional dotenv support
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SQL_FILE = r"C:\Users\ilekh\OneDrive\Documents\oldaccount\oldAccountscript.sql"
def parse_mssql_values(values_str: str) -> list:
    """Parse a SQL Server VALUES(...) string into a Python list."""
    values = []
    i = 0
    s = values_str.strip()
    while i < len(s):
        # skip whitespace and commas between values
        while i < len(s) and s[i] in (' ', '\t', '\r', '\n'):
            i += 1
        if i >= len(s):
            break
        if s[i] == ',':
            i += 1
            continue

        # NULL
        if s[i:i+4].upper() == 'NULL':
            values.append(None)
            i += 4
            continue

        # N'string' or 'string'
        if s[i] == 'N' and i+1 < len(s) and s[i+1] == "'":
            i += 1  # skip N
        if s[i] == "'":
            i += 1
            buf = []
            while i < len(s):
                if s[i] == "'" and i+1 < len(s) and s[i+1] == "'":
                    buf.append("'")
                    i += 2
                elif s[i] == "'":
                    i += 1
                    break
                else:
                    buf.append(s[i])
                    i += 1
            values.append(''.join(buf))
            continue

        # CAST(N'...' AS DateTime)  or  CAST(N'...' AS smalldatetime)
        if s[i:i+4].upper() == 'CAST':
            depth = 0
            j = i
            while j < len(s):
                if s[j] == '(':
                    depth += 1
                elif s[j] == ')':
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
                j += 1
            cast_expr = s[i:j]
            # extract the string inside CAST(N'...' AS ...)
            inner = re.search(r"N?'(.*?)'\s+AS\s+", cast_expr, re.IGNORECASE | re.DOTALL)
            values.append(inner.group(1) if inner else None)
            i = j
            continue

        # number (int or float)
        num_match = re.match(r'-?[\d]+(?:\.\d+)?(?:[eE][+-]?\d+)?', s[i:])
        if num_match:
            raw = num_match.group(0)
            values.append(Decimal(raw) if '.' in raw or 'e' in raw.lower() else int(raw))
            i += len(raw)
            continue

        # skip any other token
        i += 1

    return values


# ─── Parse old SQL file into table data ───────────────────────────────────────
ACCOUNT_TYPE_HINTS = {
    # Based on first digit of account code (old system uses hierarchical codes like 111100-00001)
    '1': 'ASSET',
    '2': 'LIABILITY',
    '3': 'EQUITY',
    '4': 'REVENUE',
    '5': 'EXPENSE',
    '6': 'EXPENSE',
    '7': 'EXPENSE',
    '8': 'REVENUE',
    '9': 'EXPENSE',
}

def determine_account_type(acctcode1: Optional[str], acctype: Optional[str]) -> str:
    if acctype:
        upper = acctype.upper().strip()
        if 'ASSET' in upper: return 'ASSET'
        if 'LIAB' in upper: return 'LIABILITY'
        if 'EQUITY' in upper or 'CAPITAL' in upper: return 'EQUITY'
        if 'REVENUE' in upper or 'INCOME' in upper or 'PREMIUM' in upper: return 'REVENUE'
        if 'EXPENSE' in upper or 'COST' in upper: return 'EXPENSE'
    if acctcode1:
        return ACCOUNT_TYPE_HINTS.get(str(acctcode1).strip(), 'ASSET')
    return 'ASSET'


# ─── Main migration ───────────────────────────────────────────────────────────
def run_migration(dry_run: bool = False, phases: list[int] = None):
    from resume_old_account import migrate
    return migrate(SQL_FILE, dry_run, phases)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate old accounting data to new PostgreSQL system")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, do not write to DB")
    parser.add_argument("--phase", type=int, nargs="+", metavar="N",
                        help="Run specific phases (1-9). Default: all")
    parser.add_argument('--sql-file', default=SQL_FILE, help='Path to SQL Server export')
    args = parser.parse_args()
    SQL_FILE = args.sql_file

    phases = args.phase if args.phase else list(range(1, 10))
    run_migration(dry_run=args.dry_run, phases=phases)
