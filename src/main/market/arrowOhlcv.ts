import { tableFromIPC } from 'apache-arrow'
import type { OhlcvBar } from '../../shared/types/market'

function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function decodeOhlcvArrow(arrowIpc: Uint8Array): OhlcvBar[] {
  const table = tableFromIPC(arrowIpc)
  const tsCode = table.getChild('ts_code')
  const tradeDate = table.getChild('trade_date')
  const open = table.getChild('open')
  const high = table.getChild('high')
  const low = table.getChild('low')
  const close = table.getChild('close')
  const preClose = table.getChild('pre_close')
  const change = table.getChild('change')
  const pctChg = table.getChild('pct_chg')
  const vol = table.getChild('vol')
  const amount = table.getChild('amount')
  const ahVol = table.getChild('ah_vol')
  const ahAmount = table.getChild('ah_amount')
  const adjFactor = table.getChild('adj_factor')

  const bars: OhlcvBar[] = []
  for (let i = 0; i < table.numRows; i += 1) {
    bars.push({
      ts_code: String(tsCode?.get(i) ?? ''),
      trade_date: String(tradeDate?.get(i) ?? ''),
      open: toNumOrNull(open?.get(i)),
      high: toNumOrNull(high?.get(i)),
      low: toNumOrNull(low?.get(i)),
      close: toNumOrNull(close?.get(i)),
      pre_close: toNumOrNull(preClose?.get(i)),
      change: toNumOrNull(change?.get(i)),
      pct_chg: toNumOrNull(pctChg?.get(i)),
      vol: toNumOrNull(vol?.get(i)),
      amount: toNumOrNull(amount?.get(i)),
      ah_vol: toNumOrNull(ahVol?.get(i)),
      ah_amount: toNumOrNull(ahAmount?.get(i)),
      adj_factor: toNumOrNull(adjFactor?.get(i))
    })
  }
  return bars
}
