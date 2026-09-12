import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { applicationService } from '../services/applicationService'
import { DASHBOARD_BASIS_PRODUCTS } from '../../shared/constants/dashboard'
import type { DashboardBasisProduct } from '../../shared/types/dashboard'

const EXPECTED_ORDER = ['IH', 'IF', 'IC', 'IM'] as const
const EXPECTED_LAST_BASIS: Record<(typeof EXPECTED_ORDER)[number], number> = {
  IH: 10,
  IF: 20,
  IC: -5,
  IM: 30
}

function almostEqual(left: number, right: number, eps = 1e-6): boolean {
  return Math.abs(left - right) < eps
}

function lastPoint(product: DashboardBasisProduct | undefined) {
  if (!product || product.series.length === 0) {
    return undefined
  }
  return product.series[product.series.length - 1]
}

export async function runV02Sprint52Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  results.push({
    name: 'python ready',
    ok: Boolean(ready && Object.values(imports).every(Boolean)),
    detail: ready ? `python=${ready.python}` : 'null'
  })

  try {
    const seeded = await pythonBridge.call<{ fut_count?: number }>('data.test.seed_dashboard_fixture', {})
    results.push({
      name: 'seed 写入四品种主力收盘',
      ok: (seeded.fut_count ?? 0) >= 8,
      detail: `fut_count=${seeded.fut_count ?? 0}`
    })

    const snapshot = await applicationService.queryDashboard({
      ts_code: '000001.SH',
      start_date: '20240101',
      end_date: '20240110'
    })
    const basis = snapshot.basis ?? []

    results.push({
      name: 'basis 四项且顺序 IH/IF/IC/IM',
      ok:
        basis.length === 4 &&
        basis.every((item, index) => item.product === EXPECTED_ORDER[index]),
      detail: basis.map((item) => item.product).join(',')
    })

    for (const meta of DASHBOARD_BASIS_PRODUCTS) {
      const item = basis.find((product) => product.product === meta.product)
      results.push({
        name: `${meta.product} 合约代码`,
        ok: item?.fut_code === meta.fut_code && item?.spot_code === meta.spot_code,
        detail: `fut=${item?.fut_code ?? 'null'}; spot=${item?.spot_code ?? 'null'}`
      })
      results.push({
        name: `${meta.product} 序列至少两日`,
        ok: (item?.series.length ?? 0) >= 2,
        detail: `series=${item?.series.length ?? 0}`
      })
      const point = lastPoint(item)
      results.push({
        name: `${meta.product} 末日基差公式`,
        ok: Boolean(
          point &&
            almostEqual(point.basis, point.spot_close - point.fut_close) &&
            almostEqual(point.basis, EXPECTED_LAST_BASIS[meta.product])
        ),
        detail: point
          ? `basis=${point.basis}; fut=${point.fut_close}; spot=${point.spot_close}`
          : 'missing'
      })
    }

    const lastValues = EXPECTED_ORDER.map((product) => lastPoint(basis.find((item) => item.product === product))?.basis)
    results.push({
      name: '四品种末日基差互异',
      ok: new Set(lastValues.filter((value) => value != null)).size === 4,
      detail: lastValues.join(',')
    })

    await pythonBridge.call('data.test.clear_fut_daily_fixture', {})
    const empty = await applicationService.queryDashboard({
      ts_code: '000001.SH',
      start_date: '20240101',
      end_date: '20240110'
    })
    const emptyBasis = empty.basis ?? []
    results.push({
      name: '无期货时 query 仍成功且 series 为空',
      ok:
        emptyBasis.length === 4 &&
        emptyBasis.every((item) => item.series.length === 0) &&
        empty.indices.length > 0,
      detail: `basis=${emptyBasis.length}; emptySeries=${emptyBasis.every((item) => item.series.length === 0)}; indices=${empty.indices.length}`
    })

    await pythonBridge.call('data.test.seed_dashboard_fixture', {})
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'sprint5.2 fixture + query', ok: false, detail })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== v0.2 Sprint5.2 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('=====================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
