export const MARKET_SYNC_START = '20240101'
export const MARKET_SYNC_END = '20251231'
export const MARKET_POOL_SIZE = 10

export function todayYyyymmdd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
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
