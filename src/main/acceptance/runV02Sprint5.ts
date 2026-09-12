import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
import { stocksRepository } from '../db/stocksRepository'
import { applicationService } from '../services/applicationService'

export async function runV02Sprint5Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  results.push({
    name: 'python ready',
    ok: Boolean(ready && Object.values(imports).every(Boolean)),
    detail: ready ? `python=${ready.python}` : 'null'
  })

  try {
    await pythonBridge.call('data.test.seed_dashboard_fixture', {})

    stocksRepository.upsertMany([
      { ts_code: '000001.SZ', symbol: '000001', name: '平安银行', area: null, industry: null, market: null, list_date: null },
      { ts_code: '000002.SZ', symbol: '000002', name: '万科A', area: null, industry: null, market: null, list_date: null },
      { ts_code: '000003.SZ', symbol: '000003', name: '验收样本', area: null, industry: null, market: null, list_date: null }
    ])

    const constituents = await applicationService.listIndexConstituents('000300.SH')
    results.push({
      name: '沪深300成分查询',
      ok:
        constituents.con_codes.length === 3 &&
        constituents.con_codes.includes('000001.SZ') &&
        constituents.con_codes.includes('000002.SZ') &&
        constituents.as_of === '20240131',
      detail: `as_of=${constituents.as_of ?? 'null'}; codes=${constituents.con_codes.join(',')}`
    })

    const indexBars = await applicationService.queryOhlcv({
      ts_code: '000001.SH',
      adjust: 'none',
      start_date: '20240101',
      end_date: '20240110'
    })
    results.push({
      name: '上证指数走 index_daily',
      ok: indexBars.count >= 2 && indexBars.bars.length >= 2,
      detail: `count=${indexBars.count}; first=${indexBars.bars[0]?.trade_date ?? 'null'}`
    })

    const chengzhi = await applicationService.queryOhlcv({
      ts_code: '399001.SZ',
      adjust: 'none',
      start_date: '20240101',
      end_date: '20240110'
    })
    const lastBar = chengzhi.bars[chengzhi.bars.length - 1]
    results.push({
      name: '深证成指成交量替换',
      ok: lastBar?.vol === 9999,
      detail: `vol=${lastBar?.vol ?? 'null'}`
    })

    await pythonBridge.call('data.test.seed_index_weight_fixture', {
      index_code: '000300.SH',
      trade_date: '20260831',
      con_codes: ['000001.SZ', '000002.SZ']
    })

    const token = getTushareToken()
    if (!token) {
      results.push({
        name: 'sync index_weight skip gate',
        ok: true,
        detail: 'skipped (no TUSHARE_TOKEN; set env to enable live sync gate)'
      })
    } else {
      const syncResult = await applicationService.syncIndexWeights()
      results.push({
        name: 'sync index_weight skip gate',
        ok: syncResult.skipped_count >= 1,
        detail: `updated=${syncResult.updated_count}; skipped=${syncResult.skipped_count}; empty=${syncResult.empty_count}`
      })
    }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'sprint5 fixture + query', ok: false, detail })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== v0.2 Sprint5 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('===================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
