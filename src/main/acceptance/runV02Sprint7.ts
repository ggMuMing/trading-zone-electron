import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { applicationService } from '../services/applicationService'
import { PYTHON_METHODS } from '../../shared/types/pythonProtocol'
import type { MarketSyncPlanResult } from '../../shared/types/pythonProtocol'
import { MARKET_SYNC_EARLIEST } from '../../shared/constants/market'

const FIXTURE_CODE = '__ACCEPTANCE_S7__.SZ'
const EARLY_DAYS = ['20060104', '20060105'] as const
const LATE_COMPLETE = ['20240102', '20240103'] as const

function sameDates(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((d, i) => d === expected[i])
}

export async function runV02Sprint7Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  results.push({
    name: 'python ready',
    ok: Boolean(ready && Object.values(imports).every(Boolean)),
    detail: ready ? `python=${ready.python}` : 'null'
  })

  try {
    await applicationService.syncMarketWindow({
      start_date: '20051231',
      end_date: '20060131'
    })
    results.push({
      name: 'start_date before 20060101 rejected',
      ok: false,
      detail: 'syncMarketWindow unexpectedly succeeded'
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({
      name: 'start_date before 20060101 rejected',
      ok: detail.includes(MARKET_SYNC_EARLIEST),
      detail
    })
  }

  try {
    await applicationService.clearMarket()

    await pythonBridge.call('data.test.seed_sync_fixture', {
      trade_dates: [...EARLY_DAYS, ...LATE_COMPLETE],
      complete_dates: [...LATE_COMPLETE]
    })

    const planEarly = await pythonBridge.call<MarketSyncPlanResult>(PYTHON_METHODS.syncMarketPlan, {
      start_date: MARKET_SYNC_EARLIEST,
      end_date: '20081231'
    })
    results.push({
      name: '2006-2008 window pending excludes 2024 complete days',
      ok:
        sameDates(planEarly.pending_dates, EARLY_DAYS) &&
        planEarly.complete_count === 0 &&
        !planEarly.pending_dates.some((day) => day.startsWith('2024')),
      detail: `pending=${planEarly.pending_dates.join(',')}; complete=${planEarly.complete_count}`
    })

    const planLate = await pythonBridge.call<MarketSyncPlanResult>(PYTHON_METHODS.syncMarketPlan, {
      start_date: '20240101',
      end_date: '20240110'
    })
    results.push({
      name: '2024 complete days still skipped after earlier window plan',
      ok:
        sameDates(planLate.complete_dates, LATE_COMPLETE) &&
        planLate.pending_count === 0,
      detail: `complete=${planLate.complete_dates.join(',')}; pending=${planLate.pending_dates.join(',')}`
    })

    await pythonBridge.call('data.test.seed_market_fixture', {
      ts_code: FIXTURE_CODE,
      trade_dates: [...EARLY_DAYS]
    })
    const queried = await applicationService.queryOhlcv({
      ts_code: FIXTURE_CODE,
      start_date: MARKET_SYNC_EARLIEST,
      end_date: '20061231',
      adjust: 'none'
    })
    const firstDate = queried.bars[0]?.trade_date
    results.push({
      name: 'query from 20060101 returns 2006 fixture bars',
      ok: queried.count === 2 && firstDate === EARLY_DAYS[0],
      detail: `count=${queried.count}; first=${firstDate ?? 'null'}`
    })

    const defaultQuery = await applicationService.queryOhlcv({
      ts_code: FIXTURE_CODE,
      adjust: 'none'
    })
    results.push({
      name: 'queryOhlcv default start is 20060101',
      ok: defaultQuery.count === 2 && defaultQuery.bars[0]?.trade_date === EARLY_DAYS[0],
      detail: `count=${defaultQuery.count}; first=${defaultQuery.bars[0]?.trade_date ?? 'null'}`
    })

    await pythonBridge.call('data.test.seed_dashboard_fixture', {
      trade_dates: [...EARLY_DAYS]
    })
    const dashboard = await applicationService.queryDashboard({
      ts_code: '000001.SH',
      start_date: MARKET_SYNC_EARLIEST,
      end_date: '20060131'
    })
    const dashDates = dashboard.bars.map((bar) => bar.trade_date)
    results.push({
      name: 'dashboard index bars include 2006 window',
      ok: EARLY_DAYS.every((day) => dashDates.includes(day)),
      detail: `bars=${dashDates.join(',')}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'plan / query / dashboard path', ok: false, detail })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== v0.2 Sprint7 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('===================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
