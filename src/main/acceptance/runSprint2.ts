import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
import { marketPoolRepository } from '../db/marketPoolRepository'
import { applicationService } from '../services/applicationService'
import { MARKET_SYNC_END, MARKET_SYNC_START } from '../../shared/constants/market'

export async function runSprint2Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const importsOk = Boolean(ready && Object.values(ready.imports).every(Boolean))
  results.push({
    name: 'python ready + imports',
    ok: importsOk,
    detail: ready ? `python=${ready.python}` : 'null'
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
    // earliest=1.0 latest=1.1; day1 factor=1.0
    // qfq: 10.5 * 1.0 / 1.1 ≈ 9.545
    // hfq: 10.5 * 1.0 / 1.0 = 10.5
    const adjustOk =
      none.count === 2 &&
      qfq.count === 2 &&
      hfq.count === 2 &&
      noneClose === 10.5 &&
      hfqClose === 10.5 &&
      typeof qfqClose === 'number' &&
      Math.abs(qfqClose - 10.5 / 1.1) < 1e-6

    results.push({
      name: 'query ohlcv none/qfq/hfq',
      ok: adjustOk,
      detail: `none=${noneClose}, qfq=${qfqClose}, hfq=${hfqClose}`
    })

    const coverage = await applicationService.getMarketCoverage([fixtureCode])
    results.push({
      name: 'market coverage reports bars',
      ok: coverage.total_bars >= 2,
      detail: `total_bars=${coverage.total_bars}, stocks=${coverage.stock_count}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'duckdb seed + query fixture', ok: false, detail })
  }

  const token = getTushareToken()
  if (!token) {
    let noTokenOk = false
    let detail = ''
    try {
      await applicationService.syncMarketPool()
      detail = 'syncMarketPool unexpectedly succeeded without token'
    } catch (err: unknown) {
      detail = err instanceof Error ? err.message : String(err)
      noTokenOk = /token/i.test(detail)
    }
    results.push({ name: 'syncPool without token shows error', ok: noTokenOk, detail })
    results.push({
      name: 'syncPool with token writes duckdb',
      ok: true,
      detail: 'skipped (no TUSHARE_TOKEN; set env to enable)'
    })
  } else {
    results.push({
      name: 'syncPool without token shows error',
      ok: true,
      detail: 'skipped (token already configured)'
    })

    try {
      const syncResult = await applicationService.syncMarketPool()
      const poolCount = marketPoolRepository.count()
      const dbPath = join(app.getPath('userData'), 'data', 'market.duckdb')
      const ok =
        syncResult.pool_size === 10 &&
        poolCount === 10 &&
        syncResult.bar_count > 0 &&
        existsSync(dbPath)
      results.push({
        name: 'syncPool with token writes duckdb',
        ok,
        detail: `pool=${syncResult.pool_size}, bars=${syncResult.bar_count}, adj=${syncResult.adj_count}, errors=${syncResult.errors.length}, db=${dbPath}`
      })
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      results.push({ name: 'syncPool with token writes duckdb', ok: false, detail })
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== Sprint2 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('==============================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
