// Parse SQL Server Management Studio dump lines:
// INSERT [dbo].[table] ([col], ...) VALUES (...);
'use strict';
const fs = require('node:fs');

function splitTuple(s) {
  const out = [];
  let cur = '';
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "'") {
        if (s[i + 1] === "'") {
          cur += "''";
          i++;
          continue;
        }
        inStr = false;
      }
      cur += ch;
    } else if (ch === "'") {
      inStr = true;
      cur += ch;
    } else if (ch === '(') {
      depth++;
      cur += ch;
    } else if (ch === ')') {
      depth--;
      cur += ch;
    } else if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

function toValue(raw) {
  if (raw === 'NULL') return null;
  if (/^N'/.test(raw)) return raw.slice(2, -1).replaceAll("''", "'");
  const cast = raw.match(/^CAST\(N?'([^']*)' AS \w*Date/i);
  if (cast) return cast[1];
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  return raw;
}

const HEADER = /^INSERT \[dbo\]\.\[(\w+)\] \(([^)]*)\) VALUES \((.*)\)\s*$/;

function* rows(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(HEADER);
    if (!m) continue;
    const [, table, colsRaw, valuesRaw] = m;
    const cols = colsRaw
      .split('], [')
      .map((c) => c.trim().replaceAll('[', '').replaceAll(']', ''));
    const vals = splitTuple(valuesRaw);
    if (cols.length !== vals.length) {
      throw new Error(`column/value mismatch in ${table}: ${cols.length} vs ${vals.length}`);
    }
    const row = {};
    cols.forEach((c, i) => (row[c] = toValue(vals[i])));
    yield { table: table.toLowerCase(), row };
  }
}

module.exports = { rows };
