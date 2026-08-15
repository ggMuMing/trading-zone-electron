import { existsSync } from 'fs'
import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { applicationService } from '../services/applicationService'
import { PYTHON_METHODS } from '../../shared/types/pythonProtocol'
import type { MarketQueryResult as PyQueryResult } from '../../shared/types/pythonProtocol'
import { MARKET_SYNC_END, MARKET_SYNC_START } from '../../shared/constants/market'

function isBinary(value: unknown): boolean {
  return value instanceof Uint8Array && value.byteLength > 0
}

export async function runSprint3Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const requiredImports = ['msgpack', 'pyarrow']
  const imports = ready?.imports ?? {}
  const importsOk = Boolean(
    ready &&
      Object.values(imports).every(Boolean) &&
      requiredImports.every((name) => imports[name] === true)
  )
  results.push({
    name: 'python ready + msgpack/pyarrow',
    ok: importsOk,
    detail: ready
      ? `python=${ready.python}; msgpack=${String(imports.msgpack)}; pyarrow=${String(imports.pyarrow)}`
      : 'null'
  })

  const fixtureCode = '__ACCEPTANCE__.SZ'
  try {
    const seeded = await pythonBridge.call<{
      ts_code: string
      bar_count: number
      adj_count: number
      db_path: string
    }>('data.test.seed_market_fixture', { ts_code: fixtureCode })

    const dbExists = existsSync(seeded.db_path)
    results.push({
      name: 'duckdb file exists after seed',
      ok: dbExists && seeded.bar_count === 2 && seeded.adj_count === 2,
      detail: `${seeded.db_path}; bars=${seeded.bar_count}; adj=${seeded.adj_count}`
    })

    const raw = await pythonBridge.call<PyQueryResult>(PYTHON_METHODS.queryOhlcv, {
      ts_code: fixtureCode,
      start_date: MARKET_SYNC_START,
      end_date: MARKET_SYNC_END,
      adjust: 'none'
    })
    results.push({
      name: 'query returns arrow_ipc binary',
      ok: raw.count === 2 && isBinary(raw.arrow_ipc) && !('bars' in raw),
      detail: `count=${raw.count}; ipcBytes=${raw.arrow_ipc?.byteLength ?? 0}`
    })

    const none = await applicationService.queryOhlcv({
      ts_code: fixtureCode,
      start_date: MARKET_SYNC_START,
      end_date: MARKET_SYNC_END,
      adjust: 'none'
    })
    const qfq = await applicationService.queryOhlcv({
      ts_code: fixtureCode,
      start_date: MARKET_SYNC_START,
      end_date: MARKET_SYNC_END,
      adjust: 'qfq'
    })
    const hfq = await applicationService.queryOhlcv({
      ts_code: fixtureCode,
      start_date: MARKET_SYNC_START,
      end_date: MARKET_SYNC_END,
      adjust: 'hfq'
    })

    const noneClose = none.bars.find((b) => b.trade_date === '20240102')?.close ?? null
    const qfqClose = qfq.bars.find((b) => b.trade_date === '20240102')?.close ?? null
    const hfqClose = hfq.bars.find((b) => b.trade_date === '20240102')?.close ?? null
    const adjustOk =
      none.count === 2 &&
      qfq.count === 2 &&
      hfq.count === 2 &&
      noneClose === 10.5 &&
      hfqClose === 10.5 &&
      typeof qfqClose === 'number' &&
      Math.abs(qfqClose - 10.5 / 1.1) < 1e-6

    results.push({
      name: 'query ohlcv none/qfq/hfq via ApplicationService',
      ok: adjustOk,
      detail: `none=${noneClose}, qfq=${qfqClose}, hfq=${hfqClose}`
    })

    const limited = await applicationService.queryOhlcv({
      ts_code: fixtureCode,
      start_date: MARKET_SYNC_START,
      end_date: MARKET_SYNC_END,
      adjust: 'none',
      limit: 1
    })
    results.push({
      name: 'query limit=1 returns one row',
      ok: limited.count === 1 && limited.bars.length === 1 && limited.bars[0]?.trade_date === '20240102',
      detail: `count=${limited.count}; date=${limited.bars[0]?.trade_date ?? 'none'}`
    })

    const coverage = await applicationService.getMarketCoverage([fixtureCode])
    results.push({
      name: 'market coverage still works',
      ok: coverage.total_bars >= 2,
      detail: `total_bars=${coverage.total_bars}, stocks=${coverage.stock_count}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'arrow query + coverage', ok: false, detail })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== Sprint3 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('==============================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
