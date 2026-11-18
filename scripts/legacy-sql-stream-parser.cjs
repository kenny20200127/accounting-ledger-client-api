// Stream a SQL Server Management Studio dump without loading it into memory.
// Handles multi-line INSERT statements and quoted newlines.
'use strict';
const fs = require('node:fs');
const readline = require('node:readline');

const HEADER = /^INSERT \[dbo\]\.\[([^\]]+)\] \((.*)\) VALUES \(([\s\S]*)\)$/;

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

// Returns a promise; onLine({table,row}) is called per parsed row. Errors abort.
async function stream(file, onLine) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let buffer = null;
  for await (let line of rl) {
    if (buffer === null) {
      if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
      if (!line.startsWith('INSERT [dbo].[')) continue;
      buffer = line;
    } else {
      buffer += '\n' + line;
    }
    const start = buffer.indexOf(' VALUES (');
    if (start < 0) {
      // Header itself can wrap before VALUES; keep accumulating.
      if (buffer.length > 1 << 20) throw new Error('Unterminated INSERT header');
      continue;
    }
    const valuesRaw = buffer.slice(start + ' VALUES ('.length);
    // Find the parenthesis that closes VALUES, ignoring parens inside strings.
    let depth = 1;
    let inStr = false;
    let end = -1;
    for (let i = 0; i < valuesRaw.length; i++) {
      const ch = valuesRaw[i];
      if (inStr) {
        if (ch === "'") {
          if (valuesRaw[i + 1] === "'") i++;
          else inStr = false;
        }
      } else if (ch === "'") {
        inStr = true;
      } else if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) continue; // Statement spans more lines.
    const header = HEADER.exec(buffer.slice(0, start + ' VALUES ('.length) + valuesRaw.slice(0, end + 1) + ')');
    if (!header) throw new Error('Unparseable INSERT: ' + buffer.slice(0, 120));
    const [, table, colsRaw, inner] = header;
    const cols = colsRaw.split('], [').map((c) => c.replaceAll('[', '').replaceAll(']', ''));
    const vals = splitTuple(inner);
    if (cols.length !== vals.length) {
      throw new Error(`column/value mismatch in ${table}: ${cols.length} vs ${vals.length}`);
    }
    const row = {};
    cols.forEach((c, i) => (row[c] = toValue(vals[i])));
    onLine({ table: table.toLowerCase(), row });
    buffer = null;
  }
  if (buffer !== null) {
    // A final row without a closing line parse.
    throw new Error('Dump ended inside an INSERT statement');
  }
}

module.exports = { stream };
