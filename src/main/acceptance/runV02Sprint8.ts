import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { applicationService } from '../services/applicationService'

const FIXTURE_CODE = '__ACCEPTANCE_S8__.SZ'
const TRADE_DATES = ['20240102', '20240103', '20240104'] as const
const REQUIRED_FIELDS = [
  'time',
  'open',
  'high',
  'low',
  'close',
  'vol',
  'buy_signal',
  'sell_signal'
] as const

function seriesRowOk(row: Record<string, unknown>): boolean {
  for (const key of REQUIRED_FIELDS) {
    if (!(key in row)) {
      return false
    }
  }
  return typeof row.buy_signal === 'boolean' && typeof row.sell_signal === 'boolean' && row.sell_signal === false
}

export async function runV02Sprint8Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  results.push({
    name: 'python ready',
    ok: Boolean(ready && Object.values(imports).every(Boolean)),
    detail: ready ? `python=${ready.python}` : 'null'
  })

  try {
    const listed = await applicationService.listStrategies()
    const listedIds = listed.strategies.map((item) => item.id)
    results.push({
      name: 'strategy.list includes ming_system_ver1',
      ok: listedIds.includes('ming_system_ver1'),
      detail: listedIds.join(',') || '(empty)'
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'strategy.list includes ming_system_ver1', ok: false, detail })
  }

  try {
    await applicationService.runStrategy({
      strategy_id: 'not_a_real_strategy',
      ts_code: FIXTURE_CODE,
      start_date: '20240102',
      end_date: '20240104',
      adjust: 'none'
    })
    results.push({
      name: 'unknown strategy_id rejected',
      ok: false,
      detail: 'runStrategy unexpectedly succeeded'
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({
      name: 'unknown strategy_id rejected',
      ok: detail.includes('invalid_params') && detail.includes('unknown strategy_id'),
      detail
    })
  }

  try {
    await applicationService.clearMarket()
    await pythonBridge.call('data.test.seed_market_fixture', {
      ts_code: FIXTURE_CODE,
      trade_dates: [...TRADE_DATES]
    })

    const emptyRun = await applicationService.runStrategy({
      strategy_id: 'ming_system_ver1',
      ts_code: '__MISSING_S8__.SZ',
      start_date: '20240102',
      end_date: '20240104',
      adjust: 'none'
    })
    results.push({
      name: 'missing bars returns empty series',
      ok: emptyRun.stats.bar_count === 0 && emptyRun.series.length === 0,
      detail: `bar_count=${emptyRun.stats.bar_count}; series=${emptyRun.series.length}`
    })

    const ran = await applicationService.runStrategy({
      strategy_id: 'ming_system_ver1',
      ts_code: FIXTURE_CODE,
      start_date: '20240102',
      end_date: '20240104',
      adjust: 'none'
    })
    const rowsOk = ran.series.every((row) => seriesRowOk(row))
    results.push({
      name: 'strategy.run returns fixture bars and required fields',
      ok:
        ran.strategy_id === 'ming_system_ver1' &&
        ran.ts_code === FIXTURE_CODE &&
        ran.stats.bar_count === TRADE_DATES.length &&
        ran.series.length === TRADE_DATES.length &&
        rowsOk &&
        ran.series.every((row) => row.sell_signal === false),
      detail: `bar_count=${ran.stats.bar_count}; series=${ran.series.length}; buy_count=${ran.stats.buy_count}; rowsOk=${rowsOk}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'strategy.run fixture path', ok: false, detail })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== v0.2 Sprint8 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('===================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}