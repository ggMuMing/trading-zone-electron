import { app } from 'electron'
import { pythonBridge } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
import { stocksRepository } from '../db/stocksRepository'
import { swIndustryRepository } from '../db/swIndustryRepository'
import { applicationService } from '../services/applicationService'
import type { SwIndustryMemberRow, SwIndustryNode } from '../../shared/types/swIndustry'

const BANK_L1: SwIndustryNode = {
  index_code: '801780.SI',
  industry_code: '480000',
  parent_code: '0',
  level: 'L1',
  name: '银行',
  is_pub: '1',
  src: 'SW2021'
}
const BANK_L2: SwIndustryNode = {
  index_code: '801783.SI',
  industry_code: '480300',
  parent_code: '480000',
  level: 'L2',
  name: '股份制银行Ⅱ',
  is_pub: '1',
  src: 'SW2021'
}
const BANK_L3: SwIndustryNode = {
  index_code: '857831.SI',
  industry_code: '480301',
  parent_code: '480300',
  level: 'L3',
  name: '股份制银行Ⅲ',
  is_pub: '1',
  src: 'SW2021'
}
const ELEC_L1: SwIndustryNode = {
  index_code: '801080.SI',
  industry_code: '270000',
  parent_code: '0',
  level: 'L1',
  name: '电子',
  is_pub: '1',
  src: 'SW2021'
}
const ELEC_L2: SwIndustryNode = {
  index_code: '801085.SI',
  industry_code: '270500',
  parent_code: '270000',
  level: 'L2',
  name: '消费电子',
  is_pub: '1',
  src: 'SW2021'
}
const ELEC_L3: SwIndustryNode = {
  index_code: '850854.SI',
  industry_code: '270504',
  parent_code: '270500',
  level: 'L3',
  name: '消费电子零部件及组装',
  is_pub: '1',
  src: 'SW2021'
}

const BANK_MEMBER: SwIndustryMemberRow = {
  ts_code: '000001.SZ',
  l1_code: '801780.SI',
  l2_code: '801783.SI',
  l3_code: '857831.SI',
  in_date: '19910403'
}
const ELEC_MEMBER: SwIndustryMemberRow = {
  ts_code: '000002.SZ',
  l1_code: '801080.SI',
  l2_code: '801085.SI',
  l3_code: '850854.SI',
  in_date: '19910129'
}
const DELISTED_MEMBER: SwIndustryMemberRow = {
  ts_code: '600687.SH',
  l1_code: '801780.SI',
  l2_code: '801783.SI',
  l3_code: '857831.SI',
  in_date: '20130701'
}

export async function runV02Sprint6Acceptance(): Promise<void> {
  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  const ready = pythonBridge.getReadyInfo()
  const imports = ready?.imports ?? {}
  results.push({
    name: 'python ready',
    ok: Boolean(ready && Object.values(imports).every(Boolean)),
    detail: ready ? `python=${ready.python}` : 'null'
  })

  try {
    stocksRepository.upsertMany([
      {
        ts_code: '000001.SZ',
        symbol: '000001',
        name: '平安银行',
        area: null,
        industry: null,
        market: null,
        list_date: null
      },
      {
        ts_code: '000002.SZ',
        symbol: '000002',
        name: '万科A',
        area: null,
        industry: null,
        market: null,
        list_date: null
      },
      {
        ts_code: '000003.SZ',
        symbol: '000003',
        name: '验收样本',
        area: null,
        industry: null,
        market: null,
        list_date: null
      }
    ])

    swIndustryRepository.replaceTree([BANK_L1, BANK_L2, BANK_L3, ELEC_L1, ELEC_L2, ELEC_L3])
    swIndustryRepository.replaceMembers([BANK_MEMBER, ELEC_MEMBER, DELISTED_MEMBER])

    const tree = applicationService.listSwIndustryTree()
    const bankL2 = tree.find((row) => row.index_code === '801783.SI')
    const bankL3 = tree.find((row) => row.index_code === '857831.SI')
    results.push({
      name: 'tree parent_code uses industry_code',
      ok:
        tree.length === 6 &&
        bankL2?.parent_code === '480000' &&
        bankL3?.parent_code === '480300',
      detail: `count=${tree.length}; l2_parent=${bankL2?.parent_code ?? 'null'}; l3_parent=${bankL3?.parent_code ?? 'null'}`
    })

    const children = swIndustryRepository.listChildren('480000')
    results.push({
      name: 'listChildren bank L2 only',
      ok: children.length === 1 && children[0]?.index_code === '801783.SI',
      detail: `codes=${children.map((row) => row.index_code).join(',')}`
    })

    const bankMembers = applicationService.listSwIndustryMembers('801780.SI')
    results.push({
      name: 'L1 members exclude other industry',
      ok:
        bankMembers.con_codes.includes('000001.SZ') &&
        !bankMembers.con_codes.includes('000002.SZ') &&
        !bankMembers.con_codes.includes('600687.SH'),
      detail: `codes=${bankMembers.con_codes.join(',')}`
    })

    const crumb = applicationService.getSwIndustryBreadcrumb('000001.SZ')
    results.push({
      name: 'breadcrumb 000001.SZ',
      ok:
        crumb?.l1.index_code === '801780.SI' &&
        crumb.l1.name === '银行' &&
        crumb.l2.index_code === '801783.SI' &&
        crumb.l3.index_code === '857831.SI',
      detail: crumb
        ? `${crumb.l1.name}/${crumb.l2.name}/${crumb.l3.name}`
        : 'null'
    })

    const missing = applicationService.getSwIndustryBreadcrumb('000003.SZ')
    results.push({
      name: 'breadcrumb missing is null',
      ok: missing === null,
      detail: missing ? 'object' : 'null'
    })

    const token = getTushareToken()
    if (!token) {
      results.push({
        name: 'sync sw_industry live',
        ok: true,
        detail: 'skipped (no TUSHARE_TOKEN; set env to enable live sync)'
      })
    } else {
      const syncResult = await applicationService.syncSwIndustry()
      const stockCount = stocksRepository.count()
      results.push({
        name: 'sync sw_industry live',
        ok:
          syncResult.classify_count === 511 &&
          syncResult.member_count === stockCount &&
          syncResult.member_fetched >= syncResult.member_count,
        detail: `classify=${syncResult.classify_count}; fetched=${syncResult.member_fetched}; stored=${syncResult.member_count}; stocks=${stockCount}; errors=${syncResult.errors.length}`
      })
    }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name: 'sprint6 fixture + query', ok: false, detail })
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n===== v0.2 Sprint6 Acceptance =====')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`)
  }
  console.log(failed.length === 0 ? 'ALL PASSED' : `FAILED: ${failed.length}`)
  console.log('===================================\n')

  app.exit(failed.length === 0 ? 0 : 1)
}
