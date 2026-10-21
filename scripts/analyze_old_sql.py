import os
import re
import sys
from collections import defaultdict

sql_path = r"C:\Users\ilekh\OneDrive\Documents\oldaccount\oldAccountscript.sql"

tables = set()
views = set()
inserts = defaultdict(int)
table_definitions = {} # table -> list of column lines

current_table = None
is_create_table = False

create_table_re = re.compile(r'CREATE\s+TABLE\s+\[dbo\]\.\[([^\]]+)\]', re.IGNORECASE)
create_view_re = re.compile(r'CREATE\s+VIEW\s+\[dbo\]\.\[([^\]]+)\]', re.IGNORECASE)
insert_re = re.compile(r'INSERT\s+(?:INTO\s+)?\[dbo\]\.\[([^\]]+)\]', re.IGNORECASE)

print("Starting scan of oldAccountscript.sql with utf-16...", flush=True)
with open(sql_path, 'r', encoding='utf-16', errors='replace') as f:
    for line_num, line in enumerate(f, 1):
        if line_num % 100000 == 0:
            print(f"Processed {line_num} lines...", flush=True)

        ct_match = create_table_re.search(line)
        if ct_match:
            current_table = ct_match.group(1)
            tables.add(current_table)
            table_definitions[current_table] = []
            is_create_table = True
            continue

        if is_create_table:
            if line.strip().startswith(') ON [PRIMARY]') or line.strip() == ')' or line.strip().startswith(') ON'):
                is_create_table = False
                current_table = None
            elif current_table:
                table_definitions[current_table].append(line.strip())

        cv_match = create_view_re.search(line)
        if cv_match:
            views.add(cv_match.group(1))

        ins_match = insert_re.search(line)
        if ins_match:
            ins_tbl = ins_match.group(1)
            inserts[ins_tbl] += 1

print("\n--- SUMMARY ---", flush=True)
print(f"Total Tables found: {len(tables)}", flush=True)
print(f"Total Views found: {len(views)}", flush=True)
print(f"Tables with INSERT statements: {len(inserts)}", flush=True)

print("\n--- TABLES WITH ROW COUNTS ---", flush=True)
for tbl, count in sorted(inserts.items(), key=lambda x: -x[1]):
    print(f"  {tbl}: {count} rows", flush=True)

print("\n--- TABLES WITHOUT INSERTS ---", flush=True)
for tbl in sorted(tables - set(inserts.keys())):
    print(f"  {tbl}", flush=True)

# Save detailed table schemas to a file for reference
with open("old_tables_schema.txt", "w", encoding="utf-8") as out:
    for tbl in sorted(tables):
        out.write(f"=== TABLE: {tbl} (Rows: {inserts.get(tbl, 0)}) ===\n")
        for col in table_definitions.get(tbl, []):
            out.write(f"  {col}\n")
        out.write("\n")

print("\nSchema details written to old_tables_schema.txt", flush=True)
