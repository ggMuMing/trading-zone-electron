import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { applicationService } from '../services/applicationService'
import type { StrategyParameter, StrategyRunParams } from '../../shared/types/pythonProtocol'

/** Above this size, wiping `market.duckdb` exceeds the worker call timeout and deletes real bars. */
const LARGE_MARKET_DB_BYTES = 32 * 1024 * 1024

const FIXTURE_CODE = '__ACCEPTANCE_S92__.SZ'
const TRADE_DATES = ['20240102', '20240103', '20240104'] as const

const EXPECTED_PARAMETERS: StrategyParameter[] = [
  { name: 'squeeze_period', title: '标准差 / ATR 周期', widget: 'int', default: 20, min: 2 },
  { name: 'wr_n', title: '过去 n 日波幅', widget: 'int', default: 3, min: 1 },
  {
    name: 'range_mode',
    title: '信号 K 波幅',
    widget: 'enum',
    default: 'co',
    options: [
      { value: 'co', label: '收−开' },
      { value: 'cl', label: '收−低' }
    ]
  },
  { name: 'k', title: '波幅系数', widget: 'float', default: 0.6, min: 0 },
  { name: 'vol_x', title: '成交量均线天数', widget: 'int', default: 5, min: 1 },
  { name: 'vol_y', title: '成交倍量', widget: 'float', default: 1, min: 0 }
]

const EXPLICIT_DEFAULTS: Record<string, number | string> = {
  squeeze_period: 20,
  wr_n: 3,
  range_mode: 'co',
  k: 0.6,
  vol_x: 5,
  vol_y: 1
}

type Check = { name: string; ok: boolean; detail: string }

function parameterMatches(actual: StrategyParameter | undefined, expected: StrategyParameter): boolean {
  if (!actual) {
    return false
  }
  if (
    actual.name !== expected.name ||
    actual.title !== expected.title ||
    actual.widget !== expected.widget ||
    actual.default !== expected.default ||
    actual.min !== expected.min ||
    actual.max !== undefined
  ) {
    return false
  }
  const actualOptions = actual.options ?? []
  const expectedOptions = expected.options ?? []
  if (actualOptions.length !== expectedOptions.length) {
    return false
  }
  return expectedOptions.every(
    (option, index) =>
      actualOptions[index]?.value === option.value && actualOptions[index]?.label === option.label
  )
}

function buySignals(series: Record<string, unknown>[]): string {
  return series.map((row) => String(row.buy_signal)).join(',')
}

function impulses(series: Record<string, unknown>[]): string {
  return series.map((row) => JSON.stringify(row.impulse)).join(',')
}

function runRequest(params?: Record<string, number | string>): StrategyRunParams {
  return {
    strategy_id: 'ming_system_ver1',
    ts_code: FIXTURE_CODE,
    start_date: TRADE_DATES[0],
    end_date: TRADE_DATES[TRADE_DATES.length - 1],
    adjust: 'none',
    ...(params !== undefined ? { params } : {})
  }
}

export async function runV02Sprint92Acceptance(): Promise<void> {
  const results: Check[] = []

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  results.push({
    name: 'python ready',
    ok: Boolean(ready && Object.values(imports).every(Boolean)),
    detail: ready ? `python=${ready.python}` : 'null'
  })

  try {
    const listed = await applicationService.listStrategies()
    const ming = listed.strategies.find((item) => item.id === 'ming_system_ver1')
    const actual = ming?.parameters ?? []
    const ok =
      Boolean(ming) &&
      actual.length === EXPECTED_PARAMETERS.length &&
      EXPECTED_PARAMETERS.every((expected, index) => parameterMatches(actual[index], expected))
    results.push({
      name: 'strategy.list ming_system_ver1 declares six defaults',
      ok,
      detail: actual
        .map((item) => {
          const labels = (item.options ?? []).map((option) => `${option.value}:${option.label}`).join('/')
          return `${item.name}=${String(item.default)}${labels ? `(${labels})` : ''}`
        })
        .join(', ') || '(missing)'
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'strategy.list ming_system_ver1 declares six defaults', ok: false, detail })
  }

  const rejected: Array<{ name: string; params: Record<string, number | string> }> = [
    { name: 'unknown param rejected', params: { nope: 1 } },
    { name: 'wr_n=0 rejected', params: { wr_n: 0 } },
    { name: 'range_mode=xx rejected', params: { range_mode: 'xx' } }
  ]
  for (const item of rejected) {
    try {
      await applicationService.runStrategy(runRequest(item.params))
      results.push({ name: item.name, ok: false, detail: 'runStrategy unexpectedly succeeded' })
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      results.push({
        name: item.name,
        ok: detail.includes('invalid_params'),
        detail
      })
    }
  }

  try {
    const dbPath = join(app.getPath('userData'), 'data', 'market.duckdb')
    const dbBytes = existsSync(dbPath) ? statSync(dbPath).size : 0
    if (dbBytes >= LARGE_MARKET_DB_BYTES) {
      console.log(
        `[acceptance] skip clearMarket; market.duckdb is ${dbBytes} bytes. Seeding ${FIXTURE_CODE} only.`
      )
    } else {
      await applicationService.clearMarket()
    }
    await pythonBridge.call('data.test.seed_market_fixture', {
      ts_code: FIXTURE_CODE,
      trade_dates: [...TRADE_DATES]
    })

    const omitted = await applicationService.runStrategy(runRequest())
    const explicit = await applicationService.runStrategy(runRequest(EXPLICIT_DEFAULTS))
    const omittedSignals = buySignals(omitted.series)
    const explicitSignals = buySignals(explicit.series)
    const sellsFalse =
      omitted.series.every((row) => row.sell_signal === false) &&
      explicit.series.every((row) => row.sell_signal === false)
    results.push({
      name: 'omitted params match explicit defaults',
      ok:
        omitted.series.length === TRADE_DATES.length &&
        explicit.series.length === TRADE_DATES.length &&
        omittedSignals === explicitSignals &&
        sellsFalse,
      detail: `omitted=${omittedSignals}; explicit=${explicitSignals}; sellsFalse=${sellsFalse}`
    })

    const closedLow = await applicationService.runStrategy(runRequest({ range_mode: 'cl' }))
    const defaultImpulse = impulses(explicit.series)
    const closedLowImpulse = impulses(closedLow.series)
    const impulseNumbers =
      explicit.series.every((row) => typeof row.impulse === 'number') &&
      closedLow.series.every((row) => typeof row.impulse === 'number')
    results.push({
      name: 'range_mode=cl changes impulse versus default',
      ok:
        closedLow.series.length === TRADE_DATES.length &&
        impulseNumbers &&
        defaultImpulse !== closedLowImpulse,
      detail: `default=${defaultImpulse}; cl=${closedLowImpulse}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'fixture param comparison', ok: false, detail })
  }

  const failed = results.filter((item) => !item.ok)
  console.log('\n===== v0.2 Sprint9.2 Acceptance =====')
  for (const item of results) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name} | ${item.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('=====================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
