import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
import { stocksRepository } from '../db/stocksRepository'
import { swIndustryRepository } from '../db/swIndustryRepository'
import { applicationService } from '../services/applicationService'
import type { PipelineStatusResult, PipelineStepState } from '../../shared/types/pipeline'
import type { SwIndustryNode } from '../../shared/types/swIndustry'

const LISTED_CODE = '__ACCEPT_S9_L__.SZ'
const DELISTED_CODE = '__ACCEPT_S9_D__.SZ'
const DROPPED_CODE = '__ACCEPT_S9_DROP__.SZ'

const ACCEPT_L1: SwIndustryNode = {
  index_code: '801780.SI',
  industry_code: '480000',
  parent_code: '0',
  level: 'L1',
  name: '银行',
  is_pub: '1',
  src: 'SW2021'
}

/** 4.1 闭区间内的开市日，固定在 [20210101, 20231231) 之内。 */
const HISTORY_DAYS = ['20210104', '20220104', '20230104'] as const

function daysAgo(offset: number): string {
  const day = new Date()
  day.setDate(day.getDate() - offset)
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${year}${month}${date}`
}

function stepOf(status: PipelineStatusResult, id: string): PipelineStepState | undefined {
  return status.steps.find((step) => step.id === id)
}

function describe(status: PipelineStatusResult): string {
  const steps = status.steps
    .map((step) => `${step.id}=${step.status}${step.initialized ? '+init' : ''}`)
    .join(' ')
  return `global=${status.global} last_closed=${status.last_closed_trade_date ?? 'null'} ${steps}`
}

export async function runV02Sprint9Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []
  const record = (name: string, ok: boolean, detail: string): void => {
    results.push({ name, ok, detail })
  }

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  record(
    'python ready',
    Boolean(ready && Object.values(imports).every(Boolean)),
    ready ? `python=${ready.python}` : 'null'
  )

  // 默认段内的开市日：最后一天留在今天之前，避免收盘时刻影响 last_closed 判定。
  const defaultWindowDays = [daysAgo(7), daysAgo(6), daysAgo(5), daysAgo(4), daysAgo(3)]
  const lastDay = defaultWindowDays[defaultWindowDays.length - 1]
  const extraDay = daysAgo(2)

  try {
    await applicationService.clearMarket()
    const empty = await applicationService.getPipelineStatus()
    record(
      '清库后全局为初始，日线未开始',
      empty.global === 'init' &&
        empty.last_closed_trade_date === null &&
        stepOf(empty, 'daily_bar')?.status === 'not_started' &&
        stepOf(empty, 'daily_bar')?.initialized === false &&
        stepOf(empty, 'trade_cal')?.status === 'not_started',
      describe(empty)
    )

    // 只补最新一天并写入一根日线：MAX(trade_date) 已对齐右端，但水位有洞。
    await pythonBridge.call('data.test.seed_sync_fixture', {
      trade_dates: defaultWindowDays,
      complete_dates: [lastDay]
    })
    await pythonBridge.call('data.test.seed_market_fixture', {
      ts_code: LISTED_CODE,
      trade_dates: [lastDay]
    })
    const holed = await applicationService.getPipelineStatus()
    const holedDaily = stepOf(holed, 'daily_bar')
    record(
      '水位有洞时日线未开始（MAX(trade_date) 不能代替水位）',
      holedDaily?.status === 'not_started' && holedDaily.fresh === false,
      `daily_bar=${holedDaily?.status} fresh=${holedDaily?.fresh} coverage=${holedDaily?.coverage_start}~${holedDaily?.coverage_end}`
    )

    // 补齐默认段 + 各全量步骤 + 两个快照步骤，凑出「必做全最新」。
    await pythonBridge.call('data.test.seed_pipeline_fixture', {
      trade_dates: defaultWindowDays
    })
    stocksRepository.upsertMany([
      {
        ts_code: LISTED_CODE,
        symbol: 'S9L',
        name: '验收在市',
        area: null,
        industry: null,
        market: null,
        list_date: null,
        list_status: 'L'
      },
      {
        ts_code: DELISTED_CODE,
        symbol: 'S9D',
        name: '验收退市',
        area: null,
        industry: null,
        market: null,
        list_date: null,
        list_status: 'D',
        delist_date: '20250101'
      },
      {
        ts_code: DROPPED_CODE,
        symbol: 'S9X',
        name: '验收待摘',
        area: null,
        industry: null,
        market: null,
        list_date: null,
        list_status: 'L'
      }
    ])
    swIndustryRepository.replaceTree([ACCEPT_L1])
    await pythonBridge.call('data.meta.mark_step', { step_id: 'stock_list' })
    await pythonBridge.call('data.meta.mark_step', { step_id: 'sw_industry' })

    const filled = await applicationService.getPipelineStatus()
    const filledDaily = stepOf(filled, 'daily_bar')
    const history = stepOf(filled, 'daily_bar_hist_2021')
    record(
      '默认段拉全后日线最新并置位闩锁',
      filledDaily?.status === 'fresh' && filledDaily.initialized === true,
      `daily_bar=${filledDaily?.status} detail=${filledDaily?.detail ?? '—'}`
    )
    record(
      '4.1 未开始不把全局打成初始',
      filled.global === 'fresh' &&
        history?.required === false &&
        history.status === 'not_started',
      describe(filled)
    )
    record(
      '派生的退市步骤跟随步骤 3 与步骤 4',
      stepOf(filled, 'delisted')?.status === 'fresh',
      `delisted=${stepOf(filled, 'delisted')?.status} detail=${stepOf(filled, 'delisted')?.detail ?? '—'}`
    )

    // 多出一个已收盘开市日却没有水位：应当是待更新，不能退回未开始。
    await pythonBridge.call('data.test.seed_sync_fixture', {
      trade_dates: [extraDay],
      complete_dates: []
    })
    const lagging = await applicationService.getPipelineStatus()
    const laggingDaily = stepOf(lagging, 'daily_bar')
    record(
      '缺最新一天是待更新且闩锁不回退',
      laggingDaily?.status === 'stale' &&
        laggingDaily.initialized === true &&
        lagging.global === 'stale',
      describe(lagging)
    )

    // 4.1 是闭区间：拉全后不因为「今天又过了一天」变待更新。
    await pythonBridge.call('data.test.seed_sync_fixture', {
      trade_dates: [...HISTORY_DAYS],
      complete_dates: [...HISTORY_DAYS]
    })
    const withHistory = await applicationService.getPipelineStatus()
    const historyDone = stepOf(withHistory, 'daily_bar_hist_2021')
    record(
      '4.1 闭区间拉全后保持最新',
      historyDone?.status === 'fresh' &&
        historyDone.initialized === true &&
        stepOf(withHistory, 'daily_bar')?.status === 'stale',
      `daily_bar_hist_2021=${historyDone?.status} detail=${historyDone?.detail ?? '—'}`
    )

    await applicationService.clearMarket()
    const reset = await applicationService.getPipelineStatus()
    record(
      '清除所有数据复位闩锁',
      reset.global === 'init' && stepOf(reset, 'daily_bar')?.initialized === false,
      describe(reset)
    )

    // 水位表本身不得被删：清库之后仍能写入并读回。
    await pythonBridge.call('data.test.seed_sync_fixture', {
      trade_dates: [lastDay],
      complete_dates: [lastDay]
    })
    const coverage = await applicationService.getMarketCoverage()
    record(
      'sync_trade_date 仍在（清库只删行不删表）',
      coverage.complete_days === 1,
      `complete_days=${coverage.complete_days}`
    )
  } catch (err: unknown) {
    record('pipeline fixture path', false, err instanceof Error ? err.message : String(err))
  }

  try {
    const listed = stocksRepository.listAll().map((stock) => stock.ts_code)
    const delisted = stocksRepository.listDelisted().map((stock) => stock.ts_code)
    record(
      '默认股票宇宙只含在市，退市另起一份',
      listed.includes(LISTED_CODE) &&
        !listed.includes(DELISTED_CODE) &&
        delisted.includes(DELISTED_CODE),
      `listed=${listed.length} delisted=${delisted.length}`
    )

    const activeCodes = stocksRepository
      .listAll()
      .map((stock) => stock.ts_code)
      .filter((code) => code !== DROPPED_CODE)
    const changed = stocksRepository.markMissingAsDelisted(activeCodes)
    const nowDelisted = stocksRepository.listDelisted().map((stock) => stock.ts_code)
    record(
      '本次未返回的在市代码被标记退市',
      changed === 1 && nowDelisted.includes(DROPPED_CODE),
      `changed=${changed}; delisted=${nowDelisted.length}`
    )

    record(
      '空的在市集合不会误伤全表',
      stocksRepository.markMissingAsDelisted([]) === 0,
      `listed=${stocksRepository.count()}`
    )
  } catch (err: unknown) {
    record('stocks delist path', false, err instanceof Error ? err.message : String(err))
  }

  if (!getTushareToken()) {
    try {
      await applicationService.runPipeline()
      record('无 Token 时拒绝跑流水线', false, 'runPipeline unexpectedly succeeded')
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      record('无 Token 时拒绝跑流水线', detail.includes('Tushare token'), detail)
    }
  } else {
    record('无 Token 时拒绝跑流水线', true, 'skipped (TUSHARE_TOKEN configured)')
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== v0.2 Sprint9 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('===================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
