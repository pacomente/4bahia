// Exportación CSV (abre directo en Excel). BOM UTF-8 + separador ';' para Excel en español.
export function toCsv(rows, columns) {
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))];
  return '﻿' + lines.join('\r\n');
}

export function sendCsv(res, filename, rows, columns) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(rows, columns));
}
