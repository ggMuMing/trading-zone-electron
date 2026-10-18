import type { ChartInput } from '../../../../shared/types/chart'

function sliceAt(input: ChartInput, end: number): ChartInput {
  const timeDomain = input.timeDomain.slice(0, end + 1)
  const keep = new Set(timeDomain)
  const filter = <T extends { time: string }>(points: T[]): T[] =>
    points.filter((point) => keep.has(point.time))
  const series: ChartInput['series'] = {}
  for (const [id, points] of Object.entries(input.series)) {
    series[id] = filter(points)
  }
  return {
    ...input,
    timeDomain,
    candle: filter(input.candle),
    volume: input.volume ? filter(input.volume) : undefined,
    series
  }
}

/** 把整段图表截到 endIso（含）。截止日不在序列里时，截到它之前的最后一根。 */
export function sliceChartInput(input: ChartInput, endIso: string): ChartInput {
  const exact = input.timeDomain.indexOf(endIso)
  if (exact >= 0) {
    if (exact >= input.timeDomain.length - 1) {
      return input
    }
    return sliceAt(input, exact)
  }
  const after = input.timeDomain.findIndex((time) => time > endIso)
  if (after <= 0) {
    return input
  }
  return sliceAt(input, after - 1)
}
