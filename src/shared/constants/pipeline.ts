/** Mirror of python/worker/pipeline_steps.py. Ranges are code constants, never user input. */

import { yyyymmddToIso } from './market'
import type { PipelineStepState } from '../types/pipeline'

export type CorePipelineStepId =
  | 'trade_cal'
  | 'index_daily'
  | 'stock_list'
  | 'daily_bar'
  | 'delisted'
  | 'index_weight'
  | 'sw_industry'
  | 'fut_daily'
  | 'margin'

/** 股票日线历史子步：`daily_bar_hist_YYYY`，YYYY 为闭区间左端年份。 */
export type DailyBarHistStepId = `daily_bar_hist_${number}`

export type PipelineStepId = CorePipelineStepId | DailyBarHistStepId

export interface PipelineStepMeta {
  id: PipelineStepId
  /** Display ordinal shown in the 序号 column. */
  ordinal: string
  title: string
  required: boolean
  /** Optional history sub-step: unlocked only after its parent is initialized. */
  parent?: PipelineStepId
}

export interface DailyBarHistorySegment {
  id: DailyBarHistStepId
  subOrdinal: number
  start: string
  end: string
}

/** Outer bound for 全量拉取; each instrument is trimmed by its own listing date. */
export const PIPELINE_FULL_RANGE_START = '20000101'
/** 股票日线默认段左端。更早历史走 4.1、4.2… 闭区间子步。 */
export const PIPELINE_DAILY_BAR_START = '20240101'
/** 历史子步下沿（含）：每 3 年一段倒序排到该年。 */
export const PIPELINE_DAILY_BAR_HISTORY_EARLIEST = '20000101'
export const PIPELINE_DAILY_BAR_HISTORY_BLOCK_YEARS = 3

function buildDailyBarHistorySegments(): DailyBarHistorySegment[] {
  const segments: DailyBarHistorySegment[] = []
  let exclusiveEnd = PIPELINE_DAILY_BAR_START
  let subOrdinal = 1

  while (exclusiveEnd > PIPELINE_DAILY_BAR_HISTORY_EARLIEST) {
    const exclusiveYear = Number.parseInt(exclusiveEnd.slice(0, 4), 10)
    let startYear = exclusiveYear - PIPELINE_DAILY_BAR_HISTORY_BLOCK_YEARS
    let start: string
    if (startYear < 2000) {
      start = PIPELINE_DAILY_BAR_HISTORY_EARLIEST
      startYear = 2000
    } else {
      start = `${startYear}0101`
    }
    const endYear = exclusiveYear - 1
    const end = `${endYear}1231`

    segments.push({
      id: `daily_bar_hist_${startYear}`,
      subOrdinal,
      start,
      end
    })
    subOrdinal += 1
    if (start === PIPELINE_DAILY_BAR_HISTORY_EARLIEST) {
      break
    }
    exclusiveEnd = start
  }

  return segments
}

export const DAILY_BAR_HISTORY_SEGMENTS: readonly DailyBarHistorySegment[] =
  buildDailyBarHistorySegments()

const DAILY_BAR_HISTORY_STEP_METAS: PipelineStepMeta[] = DAILY_BAR_HISTORY_SEGMENTS.map(
  (seg) => ({
    id: seg.id,
    ordinal: `4.${seg.subOrdinal}`,
    title: `股票日线：${yyyymmddToIso(seg.start)} ～ ${yyyymmddToIso(seg.end)}`,
    required: false,
    parent: 'daily_bar'
  })
)

export const PIPELINE_STEPS: readonly PipelineStepMeta[] = [
  { id: 'trade_cal', ordinal: '1', title: '交易日历', required: true },
  { id: 'index_daily', ordinal: '2', title: '大盘指数&宽基指数日线数据', required: true },
  { id: 'stock_list', ordinal: '3', title: '上市股票列表', required: true },
  {
    id: 'daily_bar',
    ordinal: '4',
    title: '股票日线：日线数据+复权数据+涨跌停',
    required: true
  },
  ...DAILY_BAR_HISTORY_STEP_METAS,
  { id: 'delisted', ordinal: '5', title: '退市股票列表', required: true },
  { id: 'index_weight', ordinal: '6', title: '宽基指数成分股列表', required: true },
  { id: 'sw_industry', ordinal: '7', title: '行业分类&成分股', required: true },
  { id: 'fut_daily', ordinal: '8', title: '股指期货主力合约收盘价历史数据', required: true },
  { id: 'margin', ordinal: '9', title: '两融历史数据', required: true }
]

export function pipelineStepMeta(id: string): PipelineStepMeta | undefined {
  return PIPELINE_STEPS.find((step) => step.id === id)
}

export function isDailyBarHistoryStepId(id: string): id is DailyBarHistStepId {
  return id.startsWith('daily_bar_hist_')
}

export function isDailyBarPullStepId(id: string): boolean {
  return id === 'daily_bar' || isDailyBarHistoryStepId(id)
}

export function dailyBarHistoryStepMetas(): PipelineStepMeta[] {
  return PIPELINE_STEPS.filter((step) => step.parent === 'daily_bar')
}

/** 倒序解锁：4.1 在默认段初始化后可跑；4.2 需 4.1 最新，依此类推。 */
export function isDailyBarHistoryStepUnlocked(
  meta: PipelineStepMeta,
  stepById: ReadonlyMap<string, PipelineStepState>
): boolean {
  if (meta.parent !== 'daily_bar') {
    return true
  }
  const parent = stepById.get('daily_bar')
  if (!parent?.initialized) {
    return false
  }
  const hist = dailyBarHistoryStepMetas()
  const index = hist.findIndex((step) => step.id === meta.id)
  if (index <= 0) {
    return true
  }
  const previous = hist[index - 1]
  return stepById.get(previous.id)?.status === 'fresh'
}

export function dailyBarHistorySegment(stepId: string): DailyBarHistorySegment | undefined {
  return DAILY_BAR_HISTORY_SEGMENTS.find((seg) => seg.id === stepId)
}
