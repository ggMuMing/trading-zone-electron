const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function isoToUtc(iso: string): number | null {
  const match = ISO_DATE.exec(iso)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = Date.UTC(year, month - 1, day)
  const date = new Date(utc)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return utc
}

/**
 * 在升序交易日里定位目标日。命中则用当天；否则用日历距离最近的交易日，距离相同取较早的一天。
 */
export function nearestTradingDate(times: readonly string[], target: string): string | null {
  if (times.length === 0 || isoToUtc(target) === null) {
    return null
  }
  const first = times[0]
  if (!first || target <= first) {
    return first ?? null
  }
  const last = times[times.length - 1]
  if (!last || target >= last) {
    return last ?? null
  }

  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const midTime = times[mid]
    if (midTime !== undefined && midTime < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  const next = times[lo]
  if (!next || next === target) {
    return next ?? null
  }
  const prev = times[lo - 1]
  if (!prev) {
    return next
  }
  const targetMs = isoToUtc(target)
  const prevMs = isoToUtc(prev)
  const nextMs = isoToUtc(next)
  if (targetMs === null || prevMs === null || nextMs === null) {
    return prev
  }
  return targetMs - prevMs <= nextMs - targetMs ? prev : next
}
