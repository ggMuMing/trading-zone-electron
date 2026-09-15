/** Earliest allowed sync / query start. Instruments without data that far begin at first bar. */
export const MARKET_SYNC_EARLIEST = '20060101'
/** Settings picker default — avoids aiming an 18-year window on first click. */
export const MARKET_SYNC_DEFAULT_START = '20240101'
/** Query-floor alias; prefer MARKET_SYNC_EARLIEST at new call sites. */
export const MARKET_SYNC_START = MARKET_SYNC_EARLIEST
/** Legacy pool/query cap; new call sites should use todayYyyymmdd(). */
export const MARKET_SYNC_END = '20251231'
export const MARKET_POOL_SIZE = 10

export function todayYyyymmdd(from: Date = new Date()): string {
  const y = from.getFullYear()
  const m = String(from.getMonth() + 1).padStart(2, '0')
  const d = String(from.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** Calendar date one year before `from` (same month/day). */
export function oneYearAgoYyyymmdd(from: Date = new Date()): string {
  const anchor = new Date(from)
  anchor.setFullYear(anchor.getFullYear() - 1)
  return todayYyyymmdd(anchor)
}

export function yyyymmddToIso(value: string): string {
  if (value.length !== 8) {
    return value
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

export function isoToYyyymmdd(value: string): string {
  return value.replaceAll('-', '')
}
