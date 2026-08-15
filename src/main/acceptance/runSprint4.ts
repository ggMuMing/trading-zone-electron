import { app } from 'electron'
import { getTushareToken } from '../config/appConfig'
import { pythonBridge } from '../bridge/pythonBridge'
import { applicationService } from '../services/applicationService'
import { stocksRepository } from '../db/stocksRepository'
import { marketPoolRepository } from '../db/marketPoolRepository'
import { PYTHON_METHODS } from '../../shared/types/pythonProtocol'
import type { MarketSyncPlanResult } from '../../shared/types/pythonProtocol'
import { MARKET_SYNC_START } from '../../shared/constants/market'

const TRADE_DATES = [
  '20240102',
  '20240103',
  '20240104',
  '20240105',
  '20240108',
  '20240109',
  '20240110'
]

function sameDates(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((d, i) => d === expected[i])
}

export async function runSprint4Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  results.push({
    name: 'python ready',
    ok: Boolean(ready && Object.values(imports).every(Boolean)),
    detail: ready ? `python=${ready.python}` : 'null'
  })

  const token = getTushareToken()
  if (!token) {
    try {
      await applicationService.syncMarketWindow({
        start_date: MARKET_SYNC_START,
        end_date: '20240115'
      })
      results.push({
        name: 'sync without token shows error',
        ok: false,
        detail: 'syncMarketWindow unexpectedly succeeded without token'
      })
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      results.push({
        name: 'sync without token shows error',
        ok: /token/i.test(detail),
        detail
      })
    }
  } else {
    results.push({
      name: 'sync without token shows error',
      ok: true,
      detail: 'skipped (token already configured)'
    })
  }

  try {
    await applicationService.clearMarket()

    await pythonBridge.call('data.test.seed_sync_fixture', {
      trade_dates: TRADE_DATES,
      complete_dates: ['20240102', '20240103']
    })

    const planNarrow = await pythonBridge.call<MarketSyncPlanResult>(PYTHON_METHODS.syncMarketPlan, {
      start_date: MARKET_SYNC_START,
      end_date: '20240105'
    })
    const narrowPending = ['20240104', '20240105']
    const narrowComplete = ['20240102', '20240103']
    results.push({
      name: 'plan skips complete days in window',
      ok:
        sameDates(planNarrow.pending_dates, narrowPending) &&
        sameDates(planNarrow.complete_dates, narrowComplete) &&
        planNarrow.pending_count === 2,
      detail: `pending=${planNarrow.pending_dates.join(',')}; complete=${planNarrow.complete_dates.join(',')}`
    })

    const planWide = await pythonBridge.call<MarketSyncPlanResult>(PYTHON_METHODS.syncMarketPlan, {
      start_date: MARKET_SYNC_START,
      end_date: '20240110'
    })
    const widePending = ['20240104', '20240105', '20240108', '20240109', '20240110']
    results.push({
      name: 'expanding end_date only adds new pending days',
      ok: sameDates(planWide.pending_dates, widePending) && planWide.complete_count === 2,
      detail: `pending=${planWide.pending_dates.join(',')}; complete=${planWide.complete_count}`
    })

    await applicationService.clearMarket()
    const empty = await applicationService.getMarketCoverage()
    results.push({
      name: 'clear_market empties coverage summary',
      ok:
        empty.total_bars === 0 &&
        empty.stock_count === 0 &&
        empty.complete_days === 0 &&
        empty.stocks.length === 0 &&
        empty.min_date === null,
      detail: `bars=${empty.total_bars}; stocks=${empty.stock_count}; complete_days=${empty.complete_days}`
    })

    const fixtureCode = '__ACCEPTANCE__.SZ'
    await pythonBridge.call('data.test.seed_market_fixture', { ts_code: fixtureCode })
    const summary = await applicationService.getMarketCoverage()
    const detailed = await applicationService.getMarketCoverage([fixtureCode])
    const queried = await applicationService.queryOhlcv({
      ts_code: fixtureCode,
      start_date: MARKET_SYNC_START,
      end_date: '20240103',
      adjust: 'none'
    })
    results.push({
      name: 'summary coverage omits per-stock dump',
      ok: summary.stocks.length === 0 && summary.total_bars >= 2,
      detail: `summaryStocks=${summary.stocks.length}; bars=${summary.total_bars}`
    })
    results.push({
      name: 'arrow query still works after clear+seed',
      ok: queried.count === 2 && detailed.stocks.length >= 1 && detailed.total_bars >= 2,
      detail: `queryCount=${queried.count}; detailedStocks=${detailed.stocks.length}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'plan / clear / query path', ok: false, detail })
  }

  try {
    stocksRepository.upsertMany([
      {
        ts_code: '600000.SH',
        symbol: '600000',
        name: '浦发银行',
        area: null,
        industry: null,
        market: '主板',
        list_date: null
      },
      {
        ts_code: '000001.SZ',
        symbol: '000001',
        name: '平安银行',
        area: null,
        industry: null,
        market: '主板',
        list_date: null
      },
      {
        ts_code: '300001.SZ',
        symbol: '300001',
        name: '特锐德',
        area: null,
        industry: null,
        market: '创业板',
        list_date: null
      },
      {
        ts_code: '688001.SH',
        symbol: '688001',
        name: '华兴源创',
        area: null,
        industry: null,
        market: '科创板',
        list_date: null
      },
      {
        ts_code: '920000.BJ',
        symbol: '920000',
        name: '北证示例',
        area: null,
        industry: null,
        market: '北交所',
        list_date: null
      }
    ])
    const stats = applicationService.getBoardStats()
    results.push({
      name: 'board stats from market+exchange',
      ok:
        stats.sse_main >= 1 &&
        stats.szse_main >= 1 &&
        stats.chinext >= 1 &&
        stats.star >= 1 &&
        stats.bse >= 1,
      detail: JSON.stringify(stats)
    })

    marketPoolRepository.replaceAll([])
    applicationService.ensureMarketPool()
    const pool = applicationService.getMarketPool()
    results.push({
      name: 'empty pool backfilled from stock list',
      ok: pool.length > 0 && pool.length <= 10,
      detail: `pool=${pool.length}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'board stats / pool backfill', ok: false, detail })
  }

  if (token && process.env.SPRINT4_LIVE === '1') {
    try {
      const live = await applicationService.syncMarketWindow({
        start_date: MARKET_SYNC_START,
        end_date: '20240102'
      })
      results.push({
        name: 'live short window sync',
        ok: live.fetched_days + live.skipped_days > 0,
        detail: `fetched=${live.fetched_days}; skipped=${live.skipped_days}; bars=${live.bar_count}`
      })
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      results.push({ name: 'live short window sync', ok: false, detail })
    }
  } else {
    results.push({
      name: 'live short window sync',
      ok: true,
      detail: token ? 'skipped (set SPRINT4_LIVE=1 to enable)' : 'skipped (no token)'
    })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== Sprint4 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('==============================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
