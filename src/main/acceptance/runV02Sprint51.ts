import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { applicationService } from '../services/applicationService'
import { DASHBOARD_BREADTH_UNIVERSE_ALL } from '../../shared/constants/dashboard'

const FIXTURE_LAST_DAY = '20240103'

function seriesPoint(
  breadth: {
    series: Array<{ trade_date: string; limit_up_count: number; limit_down_count: number }>
  },
  tradeDate: string
): { trade_date: string; limit_up_count: number; limit_down_count: number } | undefined {
  return (breadth.series ?? []).find((point) => point.trade_date === tradeDate)
}

export async function runV02Sprint51Acceptance(): Promise<void> {
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

    const queryParams = {
      ts_code: '000001.SH',
      start_date: '20240101',
      end_date: '20240110'
    }

    const allMarket = await applicationService.queryDashboard({
      ...queryParams,
      breadth_universe: DASHBOARD_BREADTH_UNIVERSE_ALL
    })
    const allPoint = seriesPoint(allMarket.breadth, FIXTURE_LAST_DAY)
    results.push({
      name: '全市场 universe 回显',
      ok: allMarket.breadth.universe === DASHBOARD_BREADTH_UNIVERSE_ALL,
      detail: `universe=${allMarket.breadth.universe ?? 'null'}`
    })
    results.push({
      name: '全市场 fixture 日序列点',
      ok: allPoint?.limit_up_count === 1 && allPoint?.limit_down_count === 2,
      detail: allPoint ? JSON.stringify(allPoint) : 'missing'
    })

    const hs300 = await applicationService.queryDashboard({
      ...queryParams,
      breadth_universe: '000300.SH'
    })
    const hs300Point = seriesPoint(hs300.breadth, FIXTURE_LAST_DAY)
    results.push({
      name: '沪深300 成分快照',
      ok: hs300.breadth.universe === '000300.SH' && hs300.breadth.constituent_as_of != null,
      detail: `as_of=${hs300.breadth.constituent_as_of ?? 'null'}`
    })
    results.push({
      name: '沪深300 fixture 日序列点',
      ok: hs300Point?.limit_up_count === 1 && hs300Point?.limit_down_count === 0,
      detail: hs300Point ? JSON.stringify(hs300Point) : 'missing'
    })

    const csi2000 = await applicationService.queryDashboard({
      ...queryParams,
      breadth_universe: '932000.CSI'
    })
    const csiPoint = seriesPoint(csi2000.breadth, FIXTURE_LAST_DAY)
    results.push({
      name: '中证2000 成分快照',
      ok: csi2000.breadth.universe === '932000.CSI' && csi2000.breadth.constituent_as_of != null,
      detail: `as_of=${csi2000.breadth.constituent_as_of ?? 'null'}`
    })
    results.push({
      name: '中证2000 fixture 日序列点',
      ok: csiPoint?.limit_up_count === 0 && csiPoint?.limit_down_count === 2,
      detail: csiPoint ? JSON.stringify(csiPoint) : 'missing'
    })

    results.push({
      name: '三宇宙 fixture 日序列互异',
      ok:
        Boolean(allPoint && hs300Point && csiPoint) &&
        (allPoint!.limit_up_count !== hs300Point!.limit_up_count ||
          allPoint!.limit_down_count !== hs300Point!.limit_down_count) &&
        (hs300Point!.limit_up_count !== csiPoint!.limit_up_count ||
          hs300Point!.limit_down_count !== csiPoint!.limit_down_count),
      detail: `all=${JSON.stringify(allPoint)} hs300=${JSON.stringify(hs300Point)} csi=${JSON.stringify(csiPoint)}`
    })

    await pythonBridge.call('data.test.clear_index_weight_fixture', {
      index_code: '932000.CSI'
    })
    const missingIndex = await applicationService.queryDashboard({
      ...queryParams,
      breadth_universe: '932000.CSI'
    })
    results.push({
      name: '无成分快照时为空',
      ok:
        missingIndex.breadth.universe === '932000.CSI' &&
        missingIndex.breadth.constituent_as_of == null &&
        missingIndex.breadth.up_count === 0 &&
        missingIndex.breadth.limit_up_count === 0 &&
        missingIndex.breadth.down_count === 0 &&
        missingIndex.breadth.limit_down_count === 0 &&
        (missingIndex.breadth.series?.length ?? 0) === 0,
      detail: `as_of=${missingIndex.breadth.constituent_as_of ?? 'null'}; series=${missingIndex.breadth.series?.length ?? 0}`
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'sprint5.1 fixture + query', ok: false, detail })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== v0.2 Sprint5.1 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('=====================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
