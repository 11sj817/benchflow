/** 轻量 CSV 解析 / 生成 —— 不引入第三方依赖，浏览器与 Node 测试环境均可运行。 */

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

/** 支持 BOM、CRLF、双引号转义、字段内逗号与换行。 */
export function parseCsv(text: string, delimiter = ','): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // skip CR, handled by LF
    } else {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  const headers = nonEmpty[0].map((h) => h.trim())
  const body = nonEmpty.slice(1).map((r) => headers.map((_, idx) => (r[idx] ?? '').trim()))
  return { headers, rows: body }
}

const escapeCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 生成带 BOM 的 CSV，Excel 中文不乱码。 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))]
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 以 Excel 可识别的 HTML 表格导出 .xls（无需 SheetJS）。 */
export function downloadXls(title: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<html><head><meta charset="utf-8" /><title>${esc(title)}</title></head><body>
<table border="1"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`
  downloadText(`${title}.xls`, html, 'application/vnd.ms-excel;charset=utf-8')
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}

/** 解析测量记录 CSV：param,unit,value,min,max（表头大小写与中文均可容错）。 */
export function parseMeasurementCsv(text: string): { param: string; unit: string; value: number | null; min: number | null; max: number | null }[] {
  const { headers, rows } = parseCsv(text)
  const find = (...names: string[]) =>
    headers.findIndex((h) => names.some((n) => h.toLowerCase().includes(n.toLowerCase())))
  const idx = {
    param: find('param', '参数', 'name'),
    unit: find('unit', '单位'),
    value: find('value', '测量', '值'),
    min: find('min', '下限'),
    max: find('max', '上限'),
  }
  if (idx.param < 0 || idx.value < 0) return []
  const num = (v: string) => (v === '' || Number.isNaN(Number(v)) ? null : Number(v))
  return rows
    .filter((r) => r[idx.param])
    .map((r) => ({
      param: r[idx.param],
      unit: idx.unit >= 0 ? r[idx.unit] : '',
      value: num(r[idx.value] ?? ''),
      min: idx.min >= 0 ? num(r[idx.min] ?? '') : null,
      max: idx.max >= 0 ? num(r[idx.max] ?? '') : null,
    }))
}
