import { pinyin } from 'pinyin-pro'

import type { Stock } from '../../../shared/types/stock'

/** 名称的拼音首字母，拉丁字母保留。例：平安银行 → payh。 */
export function pinyinInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return ''
  }
  const parts = pinyin(trimmed, {
    pattern: 'first',
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive'
  })
  return parts
    .join('')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

export function matchesStockQuery(stock: Stock, query: string, initials: string): boolean {
  if (
    stock.ts_code.toLowerCase().includes(query) ||
    stock.symbol.toLowerCase().includes(query) ||
    stock.name.toLowerCase().includes(query)
  ) {
    return true
  }
  return /^[a-z]+$/.test(query) && initials.includes(query)
}
