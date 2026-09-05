import {
  MARKET_POOL_SIZE,
  MARKET_SYNC_END,
  MARKET_SYNC_START
} from '../../shared/constants/market'
import type {
  BoardStats,
  MarketCoverageResult,
  MarketPoolItem,
  MarketQueryParams,
  MarketQueryResult,
  MarketSyncProgress,
  MarketSyncStatus,
  SyncMarketPoolResult,
  SyncMarketWindowResult
} from '../../shared/types/market'
import { parseIndicatorManifest, assertParams, normalizeParams, defaultScriptParams, isLegacyIndicatorSource } from '../../shared/chart/indicatorScript'
import type { ChartInput } from '../../shared/types/chart'
import type {
  ChartLayout,
  ChartLayoutItem,
  LayoutItemKind,
  LayoutItemParams,
  LayoutReorderDirection
} from '../../shared/types/chartLayout'
import { SEED_MA_SCRIPT_ID, SEED_MA_SCRIPT_TITLE } from '../../shared/types/chartLayout'
import type {
  IndicatorManifest,
  IndicatorScript,
  ScriptTryParams,
  ScriptTryResult
} from '../../shared/types/indicatorScript'
import type { Stock } from '../../shared/types/stock'
import {
  PYTHON_METHODS,
  type MarketClearResult,
  type MarketCoverageResult as PyCoverage,
  type MarketPoolSyncResult,
  type MarketQueryResult as PyQueryResult,
  type MarketSyncDayResult,
  type MarketSyncPlanResult,
  type StockListResult
} from '../../shared/types/pythonProtocol'
import { pythonBridge, readExampleMaSource } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
import { chartLayoutRepository } from '../db/chartLayoutRepository'
import { indicatorScriptRepository } from '../db/indicatorScriptRepository'
import { marketPoolRepository } from '../db/marketPoolRepository'
import { stocksRepository } from '../db/stocksRepository'
import { decodeOhlcvArrow } from '../market/arrowOhlcv'

const MARKET_CALL_TIMEOUT_MS = 180_000
const MARKET_DAY_TIMEOUT_MS = 60_000
const DATE_RE = /^[0-9]{8}$/

export type SyncProgressHandler = (progress: MarketSyncProgress) => void

let marketSyncing = false
let lastSyncProgress: MarketSyncProgress | null = null

export interface SyncStockListResult {
  count: number
  fetched: number
}

function requireToken(): string {
  const token = getTushareToken()
  if (!token) {
    throw new Error(
      'Tushare token 未配置。请设置环境变量 TUSHARE_TOKEN，或通过配置写入 userData。'
    )
  }
  return token
}

function formatDayTimings(day: MarketSyncDayResult): string {
  const t = day.timings_ms
  if (!t) {
    return ''
  }
  return ` daily=${t.daily}ms upsert=${t.upsert_daily}ms wait=${t.wait}ms`
}

function assertYyyymmdd(value: string, label: string): string {
  if (!DATE_RE.test(value)) {
    throw new Error(`${label} must be YYYYMMDD`)
  }
  return value
}

export const applicationService = {
  async syncStockList(): Promise<SyncStockListResult> {
    const token = requireToken()
    const result = await pythonBridge.call<StockListResult>(PYTHON_METHODS.syncStockList, {
      token
    })

    const count = stocksRepository.upsertMany(result.stocks)
    return {
      count,
      fetched: result.count
    }
  },

  async syncMarketPool(): Promise<SyncMarketPoolResult> {
    const token = requireToken()

    const stockList = await this.syncStockList()
    const allStocks = stocksRepository.listAll()
    const pool = allStocks.slice(0, MARKET_POOL_SIZE)
    if (pool.length === 0) {
      throw new Error('股票列表为空，无法构建股票池')
    }

    const tsCodes = pool.map((s) => s.ts_code)
    const result = await pythonBridge.call<MarketPoolSyncResult>(
      PYTHON_METHODS.syncMarketPool,
      {
        token,
        ts_codes: tsCodes,
        start_date: MARKET_SYNC_START,
        end_date: MARKET_SYNC_END
      },
      MARKET_CALL_TIMEOUT_MS
    )

    marketPoolRepository.replaceAll(tsCodes)

    return {
      pool_size: result.pool_size,
      bar_count: result.bar_count,
      adj_count: result.adj_count,
      ts_codes: result.ts_codes,
      stock_list_count: stockList.count,
      errors: result.errors ?? []
    }
  },

  async syncMarketWindow(
    params: { start_date: string; end_date: string },
    onProgress?: SyncProgressHandler
  ): Promise<SyncMarketWindowResult> {
    if (marketSyncing) {
      throw new Error('行情同步正在进行中')
    }

    const startDate = assertYyyymmdd(params.start_date, 'start_date')
    const endDate = assertYyyymmdd(params.end_date, 'end_date')
    if (startDate > endDate) {
      throw new Error('start_date must be <= end_date')
    }

    const token = requireToken()
    marketSyncing = true

    const emit = (progress: MarketSyncProgress): void => {
      lastSyncProgress = progress
      onProgress?.(progress)
    }

    try {
      emit({
        stage: 'stock_list',
        done_days: 0,
        total_pending: 0,
        skipped_days: 0,
        error_count: 0,
        message: '正在同步股票列表…'
      })

      const stockList = await this.syncStockList()

      emit({
        stage: 'plan',
        done_days: 0,
        total_pending: 0,
        skipped_days: 0,
        error_count: 0,
        message: '正在计算待补齐交易日…'
      })

      const plan = await pythonBridge.call<MarketSyncPlanResult>(
        PYTHON_METHODS.syncMarketPlan,
        { token, start_date: startDate, end_date: endDate }
      )

      const pending = plan.pending_dates ?? []
      const skippedDays = plan.complete_count
      let barCount = 0
      let adjCount = 0
      const errors: Array<{ trade_date: string; message: string }> = []

      for (let index = 0; index < pending.length; index += 1) {
        const tradeDate = pending[index]
        emit({
          stage: 'fetch_day',
          done_days: index,
          total_pending: pending.length,
          skipped_days: skippedDays,
          current_date: tradeDate,
          error_count: errors.length,
          message: `补齐交易日 ${index + 1}/${pending.length}（${tradeDate}）`
        })

        try {
          const day = await pythonBridge.call<MarketSyncDayResult>(
            PYTHON_METHODS.syncMarketDay,
            { token, trade_date: tradeDate },
            MARKET_DAY_TIMEOUT_MS
          )
          barCount += day.bar_count
          adjCount += day.adj_count
          if (day.status !== 'complete' && day.error) {
            errors.push({ trade_date: tradeDate, message: day.error })
          }
          emit({
            stage: 'fetch_day',
            done_days: index + 1,
            total_pending: pending.length,
            skipped_days: skippedDays,
            current_date: tradeDate,
            error_count: errors.length,
            message: `补齐交易日 ${index + 1}/${pending.length}（${tradeDate}）${formatDayTimings(day)}`
          })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push({ trade_date: tradeDate, message })
        }
      }

      this.ensureMarketPool()

      emit({
        stage: 'done',
        done_days: pending.length,
        total_pending: pending.length,
        skipped_days: skippedDays,
        error_count: errors.length,
        message:
          pending.length === 0
            ? `窗口内无需补齐（已跳过 ${skippedDays} 个交易日）`
            : `完成：补齐 ${pending.length} 日，跳过 ${skippedDays} 日`
      })

      return {
        start_date: startDate,
        end_date: endDate,
        stock_list_count: stockList.count,
        fetched_days: pending.length,
        skipped_days: skippedDays,
        bar_count: barCount,
        adj_count: adjCount,
        errors
      }
    } finally {
      marketSyncing = false
    }
  },

  getMarketSyncStatus(): MarketSyncStatus {
    return {
      syncing: marketSyncing,
      progress: lastSyncProgress
    }
  },

  async clearMarket(): Promise<MarketClearResult> {
    if (marketSyncing) {
      throw new Error('行情同步正在进行中，无法清除')
    }
    return pythonBridge.call<MarketClearResult>(PYTHON_METHODS.clearMarket, {})
  },

  ensureMarketPool(): void {
    if (marketPoolRepository.count() > 0) {
      return
    }
    const codes = stocksRepository.listAll().slice(0, MARKET_POOL_SIZE).map((s) => s.ts_code)
    if (codes.length > 0) {
      marketPoolRepository.replaceAll(codes)
    }
  },

  getMarketPool(): MarketPoolItem[] {
    return marketPoolRepository.listWithStocks()
  },

  getBoardStats(): BoardStats {
    return classifyBoardStats(stocksRepository.listAll())
  },

  async queryOhlcv(params: MarketQueryParams): Promise<MarketQueryResult> {
    if (!params.ts_code?.trim()) {
      throw new Error('ts_code is required')
    }

    const payload: Record<string, unknown> = {
      ts_code: params.ts_code.trim(),
      start_date: params.start_date ?? MARKET_SYNC_START,
      end_date: params.end_date ?? MARKET_SYNC_END,
      adjust: params.adjust ?? 'none'
    }
    if (params.limit !== undefined) {
      payload.limit = params.limit
    }

    const result = await pythonBridge.call<PyQueryResult>(PYTHON_METHODS.queryOhlcv, payload)
    const arrowIpc = toUint8Array(result.arrow_ipc)
    const bars = decodeOhlcvArrow(arrowIpc)

    return {
      ts_code: result.ts_code,
      adjust: result.adjust,
      count: result.count,
      bars
    }
  },

  exampleIndicatorSource(): string {
    return readExampleMaSource()
  },

  async getChartLayout(): Promise<ChartLayout> {
    return withNormalizedScriptParams(await ensureScriptLayoutDefaults())
  },

  addChartIndicator(kind: LayoutItemKind, ref: string): ChartLayout {
    if (kind !== 'script') {
      throw new Error('kind must be script')
    }
    const script = indicatorScriptRepository.get(ref)
    if (!script) {
      throw new Error(`脚本不存在：${ref}`)
    }
    return withNormalizedScriptParams(
      chartLayoutRepository.add({
        kind,
        ref,
        params: defaultScriptParams(script.manifest)
      })
    )
  },

  removeChartIndicator(id: string): ChartLayout {
    if (!id.trim()) {
      throw new Error('id is required')
    }
    return withNormalizedScriptParams(chartLayoutRepository.remove(id.trim()))
  },

  updateChartIndicator(id: string, params: LayoutItemParams): ChartLayout {
    if (!id.trim()) {
      throw new Error('id is required')
    }
    const layout = chartLayoutRepository.get()
    const item = layout.items.find((entry) => entry.id === id.trim())
    if (!item) {
      throw new Error(`指标不存在：${id}`)
    }
    const script = indicatorScriptRepository.get(item.ref)
    if (!script) {
      throw new Error(`脚本不存在：${item.ref}`)
    }
    const next = assertParams(script.manifest, params)
    return withNormalizedScriptParams(chartLayoutRepository.update(id.trim(), next))
  },

  reorderChartIndicator(id: string, direction: LayoutReorderDirection): ChartLayout {
    if (!id.trim()) {
      throw new Error('id is required')
    }
    if (direction !== 'up' && direction !== 'down') {
      throw new Error('direction must be up or down')
    }
    const layout = chartLayoutRepository.get()
    const item = layout.items.find((entry) => entry.id === id.trim())
    if (!item) {
      throw new Error(`指标不存在：${id}`)
    }
    const script = indicatorScriptRepository.get(item.ref)
    if (!script) {
      throw new Error(`脚本不存在：${item.ref}`)
    }
    if (script.manifest.overlay) {
      throw new Error('主图指标不能调整窗格顺序')
    }
    const subplotItems = layout.items.filter((entry) => {
      const entryScript = indicatorScriptRepository.get(entry.ref)
      return Boolean(entryScript && !entryScript.manifest.overlay)
    })
    const index = subplotItems.findIndex((entry) => entry.id === item.id)
    const neighborIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || neighborIndex < 0 || neighborIndex >= subplotItems.length) {
      throw new Error(direction === 'up' ? '已经是最上方的副图' : '已经是最下方的副图')
    }
    return withNormalizedScriptParams(
      chartLayoutRepository.swapSortOrder(item.id, subplotItems[neighborIndex].id)
    )
  },

  async listIndicatorScripts(): Promise<IndicatorScript[]> {
    await ensureScriptLayoutDefaults()
    return indicatorScriptRepository.list()
  },

  async tryIndicatorScript(params: ScriptTryParams): Promise<ScriptTryResult> {
    if (typeof params.source !== 'string') {
      throw new Error('source must be a string')
    }
    const payload: Record<string, unknown> = { source: params.source }
    if (params.params !== undefined) {
      payload.params = params.params
    }
    if (params.query !== undefined) {
      const query: Record<string, unknown> = {
        ts_code: params.query.ts_code.trim(),
        start_date: params.query.start_date ?? MARKET_SYNC_START,
        end_date: params.query.end_date ?? MARKET_SYNC_END,
        adjust: params.query.adjust ?? 'none'
      }
      if (params.query.limit !== undefined) {
        query.limit = params.query.limit
      }
      payload.query = query
    }
    return pythonBridge.call<ScriptTryResult>(PYTHON_METHODS.computeScriptTry, payload)
  },

  async createIndicatorScript(title: string, source: string): Promise<IndicatorScript[]> {
    const manifest = await loadScriptManifest(source)
    return indicatorScriptRepository.create({ title, source, manifest })
  },

  async updateIndicatorScript(
    id: string,
    patch: { title?: string; source?: string }
  ): Promise<IndicatorScript[]> {
    if (!id.trim()) {
      throw new Error('id is required')
    }
    const existing = indicatorScriptRepository.get(id.trim())
    if (!existing) {
      throw new Error(`脚本不存在：${id}`)
    }
    const source = patch.source !== undefined ? patch.source : existing.source
    const manifest = await loadScriptManifest(source)
    const scripts = indicatorScriptRepository.update(id.trim(), {
      title: patch.title,
      source: patch.source,
      manifest
    })
    rematerializeScriptLayoutItems(id.trim(), manifest)
    return scripts
  },

  removeIndicatorScript(id: string): IndicatorScript[] {
    if (!id.trim()) {
      throw new Error('id is required')
    }
    const scriptId = id.trim()
    if (chartLayoutRepository.isScriptReferenced(scriptId)) {
      throw new Error('脚本仍被布局引用，无法删除')
    }
    return indicatorScriptRepository.remove(scriptId)
  },

  async buildChartInput(params: MarketQueryParams): Promise<ChartInput | null> {
    if (!params.ts_code?.trim()) {
      throw new Error('ts_code is required')
    }

    const query: Record<string, unknown> = {
      ts_code: params.ts_code.trim(),
      start_date: params.start_date ?? MARKET_SYNC_START,
      end_date: params.end_date ?? MARKET_SYNC_END,
      adjust: params.adjust ?? 'none'
    }
    if (params.limit !== undefined) {
      query.limit = params.limit
    }

    const layout = withNormalizedScriptParams(await ensureScriptLayoutDefaults())
    const instances: Array<{
      id: string
      kind: LayoutItemKind
      ref: string
      params: ChartLayout['items'][number]['params']
      source: string
    }> = []
    for (const item of layout.items) {
      const script = indicatorScriptRepository.get(item.ref)
      if (!script?.source.trim()) {
        continue
      }
      instances.push({
        id: item.id,
        kind: 'script',
        ref: item.ref,
        params: item.params,
        source: script.source
      })
    }
    const chart = await pythonBridge.call<ChartInput | null>(PYTHON_METHODS.computeIndicator, {
      query,
      instances
    })
    return chart
  },

  async getMarketCoverage(tsCodes?: string[] | null): Promise<MarketCoverageResult> {
    const result = await pythonBridge.call<PyCoverage>(PYTHON_METHODS.metaMarketCoverage, {
      ts_codes: tsCodes && tsCodes.length > 0 ? tsCodes : null
    })
    return result
  }
}

async function loadScriptManifest(source: string): Promise<IndicatorManifest> {
  const result = await applicationService.tryIndicatorScript({ source })
  if (!result.ok) {
    throw new Error(result.error || '脚本 load 失败')
  }
  if (!result.manifest) {
    throw new Error('script try did not return manifest')
  }
  return parseIndicatorManifest(result.manifest)
}

let scriptLayoutSeeded: Promise<void> | null = null

/** Seed once, then always read the current layout from SQLite (never cache items). */
async function ensureScriptLayoutDefaults(): Promise<ChartLayout> {
  if (!scriptLayoutSeeded) {
    scriptLayoutSeeded = seedScriptLayoutDefaults().then(() => undefined)
  }
  try {
    await scriptLayoutSeeded
  } catch (err) {
    scriptLayoutSeeded = null
    throw err
  }
  return chartLayoutRepository.get()
}

async function seedScriptLayoutDefaults(): Promise<ChartLayout> {
  chartLayoutRepository.deleteBuiltinItems()
  chartLayoutRepository.ensureDefault()
  const existingSeed = indicatorScriptRepository.get(SEED_MA_SCRIPT_ID)
  if (existingSeed && isLegacyIndicatorSource(existingSeed.source)) {
    indicatorScriptRepository.removeAll()
    chartLayoutRepository.clearItems()
  }
  if (!indicatorScriptRepository.get(SEED_MA_SCRIPT_ID)) {
    const source = readExampleMaSource()
    const manifest = await loadScriptManifest(source)
    indicatorScriptRepository.createWithId({
      id: SEED_MA_SCRIPT_ID,
      title: SEED_MA_SCRIPT_TITLE,
      source,
      manifest
    })
  }
  const current = chartLayoutRepository.get()
  if (current.items.length > 0) {
    return current
  }
  const script = indicatorScriptRepository.get(SEED_MA_SCRIPT_ID)
  if (!script) {
    return current
  }
  return chartLayoutRepository.add({
    kind: 'script',
    ref: SEED_MA_SCRIPT_ID,
    params: defaultScriptParams(script.manifest)
  })
}

function rematerializeScriptLayoutItems(scriptId: string, manifest: IndicatorManifest): void {
  const layout = chartLayoutRepository.get()
  for (const item of layout.items) {
    if (item.kind === 'script' && item.ref === scriptId) {
      const next = normalizeParams(manifest, item.params)
      chartLayoutRepository.update(item.id, next)
    }
  }
}

function normalizeScriptLayoutItem(item: ChartLayoutItem): ChartLayoutItem {
  const script = indicatorScriptRepository.get(item.ref)
  if (!script) {
    return item
  }
  try {
    return {
      ...item,
      params: normalizeParams(script.manifest, item.params)
    }
  } catch {
    return item
  }
}

function withNormalizedScriptParams(layout: ChartLayout): ChartLayout {
  return {
    ...layout,
    items: layout.items.map((item) => normalizeScriptLayoutItem(item))
  }
}

function classifyBoardStats(stocks: Stock[]): BoardStats {
  const stats: BoardStats = {
    sse_main: 0,
    szse_main: 0,
    chinext: 0,
    star: 0,
    bse: 0,
    other: 0,
    total: stocks.length
  }

  for (const stock of stocks) {
    const market = stock.market ?? ''
    const code = stock.ts_code
    if (market === '创业板') {
      stats.chinext += 1
    } else if (market === '科创板') {
      stats.star += 1
    } else if (market === '北交所') {
      stats.bse += 1
    } else if (market === '主板' || market === '中小板') {
      if (code.endsWith('.SH')) {
        stats.sse_main += 1
      } else if (code.endsWith('.SZ')) {
        stats.szse_main += 1
      } else {
        stats.other += 1
      }
    } else {
      stats.other += 1
    }
  }

  return stats
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value
  }
  throw new Error('arrow_ipc is missing or not binary')
}
