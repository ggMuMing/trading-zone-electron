export interface Stock {
  ts_code: string
  symbol: string
  name: string
  area: string | null
  industry: string | null
  market: string | null
  list_date: string | null
  synced_at: string
}
