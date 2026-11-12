import { describe, expect, it } from 'vitest'
import { parseCsv, parseMeasurementCsv, toCsv } from '@/utils/csv'

describe('CSV 解析与生成', () => {
  it('解析 BOM、CRLF、引号与字段内逗号/换行', () => {
    const text = '\uFEFF名称,说明,数值\r\n"纹波,满载","含 ""引号"" 与\n换行",65\r\n半载,普通,58\r\n'
    const parsed = parseCsv(text)
    expect(parsed.headers).toEqual(['名称', '说明', '数值'])
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0][0]).toBe('纹波,满载')
    expect(parsed.rows[0][1]).toContain('含 "引号" 与\n换行')
    expect(parsed.rows[1][2]).toBe('58')
  })

  it('忽略空行并按表头补全缺失列', () => {
    const parsed = parseCsv('a,b,c\n1,2\n\n3,4,5\n')
    expect(parsed.rows).toEqual([
      ['1', '2', ''],
      ['3', '4', '5'],
    ])
  })

  it('生成带 BOM 且正确转义字段', () => {
    const csv = toCsv(['参数', '备注'], [['输出纹波', '含,逗号'], ['效率', '含"引号"']])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"含,逗号"')
    expect(csv).toContain('"含""引号"""')
  })

  it('解析测量 CSV 并容错中文表头', () => {
    const text = '参数,单位,测量值,下限,上限\n输出纹波（满载）,mV,42,,\n满载效率,%,95.6,94,\n'
    const rows = parseMeasurementCsv(text)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ param: '输出纹波（满载）', unit: 'mV', value: 42, max: null })
    expect(rows[1].min).toBe(94)
    expect(rows[1].value).toBe(95.6)
  })

  it('表头缺失时返回空数组而不是抛出异常', () => {
    expect(parseMeasurementCsv('foo,bar\n1,2\n')).toEqual([])
  })
})
