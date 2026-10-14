// ---------------------------------------------------------------
// CSV writer for admin exports. Opens cleanly in Excel / Google Sheets:
//   - UTF-8 BOM so Tamil names and ₹ show correctly in Excel
//   - quotes, commas and newlines escaped
//   - formula injection blocked: a cell a student controls that starts
//     with = + - @ (or tab/CR) is prefixed with ' so Excel shows it as
//     text instead of running it (e.g. a project titled =HYPERLINK(...))
// ---------------------------------------------------------------
const cell = (v) => {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString().slice(0, 10) : Array.isArray(v) ? v.join('; ') : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;   // plain negative numbers stay numbers
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// columns: [{ key, label, get?(row) }]
const toCsv = (rows, columns) =>
  `﻿${[columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(c.get ? c.get(r) : r[c.key])).join(','))].join('\r\n')}\r\n`;

const sendCsv = (res, filename, rows, columns) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`);
  res.set('Cache-Control', 'no-store');
  res.send(toCsv(rows, columns));
};

module.exports = { toCsv, sendCsv, cell };
