/** `L` 在市、`D` 退市。全市场宇宙默认只看 L，退市宇宙看 D。 */
export type StockListStatus = 'L' | 'D'

export interface Stock {
  ts_code: string
  symbol: string
  name: string
  area: string | null
  industry: string | null
  market: string | null
  list_date: string | null
  list_status: StockListStatus
  delist_date: string | null
  synced_at: string
}

/** 写入时退市字段可省，迁移后的老行默认按在市处理。 */
export type StockUpsertRow = Omit<Stock, 'synced_at' | 'list_status' | 'delist_date'> & {
  list_status?: StockListStatus
  delist_date?: string | null
}
