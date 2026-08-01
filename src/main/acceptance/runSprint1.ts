import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
import { getDb } from '../db/sqlite'
import { stocksRepository } from '../db/stocksRepository'
import { applicationService } from '../services/applicationService'

export async function runSprint1Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const importsOk = Boolean(ready && Object.values(ready.imports).every(Boolean))
  results.push({
    name: 'python ready + imports',
    ok: importsOk,
    detail: ready ? `python=${ready.python}` : 'null'
  })

  const dbPath = join(app.getPath('userData'), 'data', 'trading-zone.db')
  results.push({
    name: 'sqlite file exists',
    ok: existsSync(dbPath),
    detail: dbPath
  })

  // Local persistence without Tushare network.
  const fixtureCode = '__ACCEPTANCE__.SZ'
  getDb().prepare('DELETE FROM stocks WHERE ts_code = ?').run(fixtureCode)
  const upserted = stocksRepository.upsertMany([
    {
      ts_code: fixtureCode,
      symbol: 'ACCEPT',
      name: '验收股票',
      area: '深圳',
      industry: '测试',
      market: '主板',
      list_date: '20200101'
    }
  ])
  const listed = stocksRepository.listAll()
  const found = listed.find((s) => s.ts_code === fixtureCode)
  results.push({
    name: 'sqlite upsert + list persistence',
    ok: upserted === 1 && Boolean(found),
    detail: found ? `found ${found.ts_code} / ${found.name}` : 'fixture missing'
  })
  getDb().prepare('DELETE FROM stocks WHERE ts_code = ?').run(fixtureCode)

  // Expect clear error when token is missing.
  const token = getTushareToken()
  if (!token) {
    let noTokenOk = false
    let detail = ''
    try {
      await applicationService.syncStockList()
      detail = 'sync unexpectedly succeeded without token'
    } catch (err: unknown) {
      detail = err instanceof Error ? err.message : String(err)
      noTokenOk = /token/i.test(detail)
    }
    results.push({ name: 'sync without token shows error', ok: noTokenOk, detail })
    results.push({
      name: 'sync with token writes sqlite',
      ok: true,
      detail: 'skipped (no TUSHARE_TOKEN; set env to enable)'
    })
  } else {
    results.push({
      name: 'sync without token shows error',
      ok: true,
      detail: 'skipped (token already configured)'
    })

    try {
      const before = stocksRepository.count()
      const syncResult = await applicationService.syncStockList()
      const after = stocksRepository.listAll()
      const ok = syncResult.count > 0 && after.length > 0
      results.push({
        name: 'sync with token writes sqlite',
        ok,
        detail: `before=${before}, fetched=${syncResult.fetched}, upserted=${syncResult.count}, listed=${after.length}`
      })
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      results.push({ name: 'sync with token writes sqlite', ok: false, detail })
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== Sprint1 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('==============================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
