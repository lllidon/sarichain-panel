export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns: string[]) {
  const quote = (value: unknown) => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const csv = '\uFEFF' + [columns.map(quote).join(','), ...rows.map(row => columns.map(key => quote(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readCsv(file: File): Promise<Record<string, string>[]> {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && !cell) quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift()!.map(value => value.trim());
  if (!headers.length || headers.some(value => !value) || new Set(headers).size !== headers.length) throw new Error('سرستون‌های فایل معتبر نیستند.');
  return rows.filter(values => values.some(value => value.trim())).map(values =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function csvValue(value: string): unknown {
  if (!value) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('{') || value.startsWith('[')) {
    try { return JSON.parse(value); } catch { throw new Error('ساختار JSON یکی از سلول‌ها معتبر نیست.'); }
  }
  return value;
}
