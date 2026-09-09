import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { applicationService } from '../services/applicationService'
import { DASHBOARD_DISPLAY_INDICES } from '../../shared/constants/dashboard'

export async function runV02Sprint4Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  results.push({
    name: 'python ready',
    ok: Boolean(ready && Object.values(imports).every(Boolean)),
    detail: ready ? `python=${ready.python}` : 'null'
  })

  try {
    const seeded = await pythonBridge.call<{
      index_count: number
      margin_count: number
      limit_count: number
      display_count: number
      db_path: string
    }>('data.test.seed_dashboard_fixture', {})

    results.push({
      name: 'seed dashboard fixture',
      ok: seeded.index_count > 0 && seeded.margin_count === 6 && seeded.limit_count === 10,
      detail: `index=${seeded.index_count}; margin=${seeded.margin_count}; limit=${seeded.limit_count}`
    })

    const snapshot = await applicationService.queryDashboard({
      ts_code: '000001.SH',
      start_date: '20240101',
      end_date: '20240110'
    })

    results.push({
      name: 'display indices count',
      ok: snapshot.indices.length === DASHBOARD_DISPLAY_INDICES.length,
      detail: `count=${snapshot.indices.length}`
    })

    const chengzhi = snapshot.indices.find((item) => item.ts_code === '399001.SZ')
    results.push({
      name: '深证成指成交量用深圳A指合成',
      ok: chengzhi?.vol === 9999,
      detail: `vol=${chengzhi?.vol ?? 'null'}; amount=${chengzhi?.amount ?? 'null'}`
    })

    results.push({
      name: 'selected kline bars',
      ok: snapshot.selected_ts_code === '000001.SH' && snapshot.bars.length === 2,
      detail: `selected=${snapshot.selected_ts_code}; bars=${snapshot.bars.length}`
    })

    results.push({
      name: 'margin totals in 亿元',
      ok: snapshot.margin.value === 11000 && snapshot.margin.change === 1000,
      detail: `value=${snapshot.margin.value}; change=${snapshot.margin.change}; n=${snapshot.margin.series.length}`
    })

    results.push({
      name: 'turnover series present',
      ok: (snapshot.turnover.series.length ?? 0) >= 2 && snapshot.turnover.value != null,
      detail: `value=${snapshot.turnover.value}; n=${snapshot.turnover.series.length}`
    })

    const hist = snapshot.breadth.histogram
    const histOk =
      snapshot.breadth.up_count === 4 &&
      snapshot.breadth.limit_up_count === 1 &&
      snapshot.breadth.down_count === 4 &&
      snapshot.breadth.limit_down_count === 2 &&
      snapshot.breadth.flat_count === 2 &&
      hist[0] === 1 &&
      hist[2] === 2 &&
      hist[3] === 1 &&
      hist[4] === 2 &&
      hist[5] === 1 &&
      hist[6] === 1 &&
      hist[8] === 2
    results.push({
      name: 'breadth counts and 9-bin histogram',
      ok: histOk,
      detail: `up=${snapshot.breadth.up_count} lu=${snapshot.breadth.limit_up_count} down=${snapshot.breadth.down_count} ld=${snapshot.breadth.limit_down_count} flat=${snapshot.breadth.flat_count} hist=${JSON.stringify(hist)}`
    })

    const chuangye = await applicationService.queryDashboard({
      ts_code: '399006.SZ',
      start_date: '20240101',
      end_date: '20240110'
    })
    const lastBar = chuangye.bars[chuangye.bars.length - 1]
    const lastVol = lastBar?.vol
    results.push({
      name: '创业板指K线成交量用创业板综合成',
      ok: lastVol === 8888,
      detail: `vol=${lastVol ?? 'null'}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'dashboard seed + query', ok: false, detail })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== v0.2 Sprint4 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('===================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
