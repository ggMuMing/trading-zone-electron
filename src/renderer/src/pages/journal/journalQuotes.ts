import { isoToYyyymmdd, todayYyyymmdd } from '../../../../shared/constants/market'

export async function queryDailyClose(tsCode: string, isoDate: string): Promise<number | null> {
  const ymd = isoToYyyymmdd(isoDate)
  const result = await window.api.market.query({
    ts_code: tsCode,
    adjust: 'none',
    start_date: ymd,
    end_date: ymd
  })
  const bar = result.bars.find((item) => item.trade_date === ymd) ?? result.bars.at(-1)
  const close = bar?.close
  return close != null && Number.isFinite(close) ? close : null
}

/** `market.query` 的 limit 从窗口起点向后截，这里取区间内最后一根收盘。 */
export async function queryLatestCloses(codes: string[]): Promise<Record<string, number | null>> {
  const end = todayYyyymmdd()
  const startAnchor = new Date()
  startAnchor.setDate(startAnchor.getDate() - 120)
  const start = todayYyyymmdd(startAnchor)
  const pairs = await Promise.all(
    codes.map(async (code) => {
      try {
        const result = await window.api.market.query({
          ts_code: code,
          adjust: 'none',
          start_date: start,
          end_date: end
        })
        const close = result.bars.at(-1)?.close
        return [code, close != null && Number.isFinite(close) ? close : null] as const
      } catch {
        return [code, null] as const
      }
    })
  )
  return Object.fromEntries(pairs)
}
