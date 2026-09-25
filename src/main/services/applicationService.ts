import {
  MARKET_POOL_SIZE,
  MARKET_SYNC_DEFAULT_START,
  MARKET_SYNC_EARLIEST,
  todayYyyymmdd
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
  type PipelinePlanResult,
  type PipelineStepRunResult,
  type StockListResult,
  type TradeCalSyncResult,
  type IndexConstituentsResult as PyIndexConstituentsResult,
  type IndexWeightSyncResult as PyIndexWeightSyncResult,
  type StrategyListResult,
  type StrategyRunParams,
  type StrategyRunResult,
  type SwIndustryWorkerResult
} from '../../shared/types/pythonProtocol'
import {
  dailyBarHistoryStepMetas,
  isDailyBarHistoryStepUnlocked,
  isDailyBarPullStepId,
  PIPELINE_STEPS,
  pipelineStepMeta,
  type PipelineStepId
} from '../../shared/constants/pipeline'
import type {
  PipelineRunResult,
  PipelineRunStepOutcome,
  PipelineStatusResult
} from '../../shared/types/pipeline'
import { pythonBridge, readExampleMaSource } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
import { chartLayoutRepository } from '../db/chartLayoutRepository'
import { indicatorScriptRepository } from '../db/indicatorScriptRepository'
import { marketPoolRepository } from '../db/marketPoolRepository'
import { stocksRepository } from '../db/stocksRepository'
import { swIndustryRepository } from '../db/swIndustryRepository'
import { decodeOhlcvArrow } from '../market/arrowOhlcv'
import type { DashboardQueryParams, DashboardQueryResult } from '../../shared/types/dashboard'
import type { IndexConstituentsResult, IndexWeightSyncResult } from '../../shared/types/indexConstituents'
import type {
  SwIndustryBreadcrumb,
  SwIndustryMembersResult,
  SwIndustryNode,
  SwIndustrySyncResult
} from '../../shared/types/swIndustry'

const MARKET_CALL_TIMEOUT_MS = 180_000
const MARKET_DAY_TIMEOUT_MS = 120_000
const DASHBOARD_BACKFILL_TIMEOUT_MS = 1_800_000
const SW_INDUSTRY_SYNC_TIMEOUT_MS = 180_000
/** 全量类步骤按区间分窗拉取，单步可能跑很久。 */
const PIPELINE_STEP_TIMEOUT_MS = 1_800_000
const DATE_RE = /^[0-9]{8}$/

export type SyncProgressHandler = (progress: MarketSyncProgress) => void

let marketSyncing = false
let lastSyncProgress: MarketSyncProgress | null = null
let runningStepId: PipelineStepId | null = null
let lastCalendarError: string | null = null
/** 最近一次跑该步留下的失败信息；成功后清掉，避免失败看起来像空白未开始。 */
const lastStepErrors = new Map<PipelineStepId, string>()

export interface SyncStockListResult {
  count: number
  fetched: number
  listed: number
  delisted: number
  marked_delisted: number
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
    const result = await pythonBridge.call<StockListResult>(
      PYTHON_METHODS.syncStockList,
      { token, list_status: 'L,D' },
      MARKET_CALL_TIMEOUT_MS
    )

    const count = stocksRepository.upsertMany(result.stocks)
    const activeCodes = result.stocks
      .filter((stock) => stock.list_status === 'L')
      .map((stock) => stock.ts_code)
    const markedDelisted = stocksRepository.markMissingAsDelisted(activeCodes)
    return {
      count,
      fetched: result.count,
      listed: result.listed_count ?? activeCodes.length,
      delisted: result.delisted_count ?? 0,
      marked_delisted: markedDelisted
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
        start_date: MARKET_SYNC_DEFAULT_START,
        end_date: todayYyyymmdd()
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

  /**
   * 打开数据管理页时唯一的自动拉取。失败不阻断：保留本地日历，步骤 1 标待更新，
   * 其它步骤仍用本地日历继续判定。
   */
  async refreshCalendar(): Promise<PipelineStatusResult> {
    lastCalendarError = null
    const token = getTushareToken()
    if (!token) {
      lastCalendarError = 'Tushare token 未配置，交易日历未刷新（沿用本地日历）'
    } else if (!marketSyncing) {
      try {
        await pythonBridge.call<TradeCalSyncResult>(
          PYTHON_METHODS.syncTradeCal,
          { token },
          MARKET_CALL_TIMEOUT_MS
        )
        lastStepErrors.delete('trade_cal')
      } catch (err: unknown) {
        lastCalendarError = err instanceof Error ? err.message : String(err)
      }
    }
    return this.getPipelineStatus()
  },

  async getPipelineStatus(): Promise<PipelineStatusResult> {
    const status = await pythonBridge.call<PipelineStatusResult>(
      PYTHON_METHODS.metaPipelineStatus,
      {
        stock_count: stocksRepository.count(),
        delisted_count: stocksRepository.countDelisted(),
        industry_count: swIndustryRepository.countNodes()
      }
    )

    return {
      ...status,
      global: marketSyncing ? 'running' : status.global,
      calendar_error: lastCalendarError,
      steps: status.steps.map((step) => {
        const error = lastStepErrors.get(step.id) ?? null
        if (runningStepId === step.id) {
          return { ...step, status: 'running', error }
        }
        if (error && !step.fresh) {
          return { ...step, status: 'failed', error }
        }
        return { ...step, error }
      })
    }
  },

  /** 必做流水线。已最新的步骤跳过，中断后再次点击从第一个未完成的步骤继续。 */
  async runPipeline(onProgress?: SyncProgressHandler): Promise<PipelineRunResult> {
    const required = PIPELINE_STEPS.filter((step) => step.required).map((step) => step.id)
    return runSteps(required, onProgress)
  },

  /** 历史子步（4.1…）的行内按钮：上一段未初始化时不放行。 */
  async runPipelineStep(
    stepId: PipelineStepId,
    onProgress?: SyncProgressHandler
  ): Promise<PipelineRunResult> {
    const meta = pipelineStepMeta(stepId)
    if (!meta) {
      throw new Error(`未知步骤：${stepId}`)
    }
    if (meta.parent === 'daily_bar') {
      const status = await this.getPipelineStatus()
      const stepById = new Map(status.steps.map((step) => [step.id, step]))
      if (!isDailyBarHistoryStepUnlocked(meta, stepById)) {
        const hist = dailyBarHistoryStepMetas()
        const index = hist.findIndex((step) => step.id === meta.id)
        if (index <= 0) {
          throw new Error('请先完成步骤 4 默认段，再补历史日线')
        }
        throw new Error(`请先完成步骤 ${hist[index - 1]?.ordinal ?? '4.x'}，再补本段历史`)
      }
    }
    return runSteps([stepId], onProgress)
  },

  /** 旧的自选窗口路径：仅保留给历史验收脚本，不再挂在主路径 IPC 上。 */
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
    if (startDate < MARKET_SYNC_EARLIEST) {
      throw new Error(`start_date must be >= ${MARKET_SYNC_EARLIEST}`)
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
        stage: 'dashboard_backfill',
        done_days: pending.length,
        total_pending: pending.length,
        skipped_days: skippedDays,
        error_count: errors.length,
        message: '正在回填指数 / 两融 / 涨跌状态…'
      })

      try {
        const backfill = await pythonBridge.call<{ error?: string | null }>(
          PYTHON_METHODS.syncDashboardBackfill,
          { token, start_date: startDate, end_date: endDate },
          DASHBOARD_BACKFILL_TIMEOUT_MS
        )
        if (backfill.error) {
          errors.push({ trade_date: endDate, message: backfill.error })
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push({ trade_date: endDate, message: `dashboard_backfill: ${message}` })
      }

      emit({
        stage: 'done',
        done_days: pending.length,
        total_pending: pending.length,
        skipped_days: skippedDays,
        error_count: errors.length,
        message:
          pending.length === 0
            ? `窗口内股票日已齐，已检查看板回填（跳过 ${skippedDays} 个交易日）`
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
    const result = await pythonBridge.call<MarketClearResult>(PYTHON_METHODS.clearMarket, {})
    // 清除是闩锁唯一的复位入口，配套把上一轮的失败痕迹也抹掉。
    lastStepErrors.clear()
    lastCalendarError = null
    lastSyncProgress = null
    return result
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
      start_date: params.start_date ?? MARKET_SYNC_EARLIEST,
      end_date: params.end_date ?? todayYyyymmdd(),
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

  async queryDashboard(params: DashboardQueryParams = {}): Promise<DashboardQueryResult> {
    const tsCode = params.ts_code?.trim()
    const payload: Record<string, unknown> = {
      start_date: params.start_date ?? MARKET_SYNC_EARLIEST,
      end_date: params.end_date ?? todayYyyymmdd()
    }
    if (tsCode) {
      payload.ts_code = tsCode
    }
    if (params.breadth_universe) {
      payload.breadth_universe = params.breadth_universe
    }
    return pythonBridge.call<DashboardQueryResult>(PYTHON_METHODS.queryDashboard, payload)
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
        start_date: params.query.start_date ?? MARKET_SYNC_EARLIEST,
        end_date: params.query.end_date ?? todayYyyymmdd(),
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
      start_date: params.start_date ?? MARKET_SYNC_EARLIEST,
      end_date: params.end_date ?? todayYyyymmdd(),
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
  },

  async syncIndexWeights(): Promise<IndexWeightSyncResult> {
    const token = requireToken()
    return pythonBridge.call<PyIndexWeightSyncResult>(PYTHON_METHODS.syncIndexWeight, { token })
  },

  async syncSwIndustry(): Promise<SwIndustrySyncResult> {
    const token = requireToken()
    const result = await pythonBridge.call<SwIndustryWorkerResult>(
      PYTHON_METHODS.syncSwIndustry,
      { token },
      SW_INDUSTRY_SYNC_TIMEOUT_MS
    )
    swIndustryRepository.replaceTree(result.classify ?? [])
    const written = swIndustryRepository.replaceMembers(result.members ?? [])
    return {
      classify_count: result.classify?.length ?? 0,
      member_fetched: result.members?.length ?? 0,
      member_count: written.member_count,
      skipped_not_in_stocks: written.skipped_not_in_stocks,
      errors: result.errors ?? []
    }
  },

  listSwIndustryTree(): SwIndustryNode[] {
    return swIndustryRepository.listTree()
  },

  listSwIndustryMembers(indexCode: string): SwIndustryMembersResult {
    const code = indexCode.trim()
    if (!code) {
      throw new Error('index_code is required')
    }
    return {
      index_code: code,
      con_codes: swIndustryRepository.listMemberCodes(code)
    }
  },

  getSwIndustryBreadcrumb(tsCode: string): SwIndustryBreadcrumb | null {
    const code = tsCode.trim()
    if (!code) {
      throw new Error('ts_code is required')
    }
    return swIndustryRepository.getBreadcrumb(code)
  },

  async listIndexConstituents(indexCode: string): Promise<IndexConstituentsResult> {
    const code = indexCode.trim()
    if (!code) {
      throw new Error('index_code is required')
    }
    const result = await pythonBridge.call<PyIndexConstituentsResult>(
      PYTHON_METHODS.queryIndexConstituents,
      { index_code: code }
    )
    const codeSet = new Set(result.con_codes)
    const stocks = stocksRepository.listAll().filter((stock) => codeSet.has(stock.ts_code))
    return {
      index_code: result.index_code,
      as_of: result.as_of,
      con_codes: stocks.map((stock) => stock.ts_code)
    }
  },

  async listStrategies(): Promise<StrategyListResult> {
    return pythonBridge.call<StrategyListResult>(PYTHON_METHODS.strategyList)
  },

  async runStrategy(params: StrategyRunParams): Promise<StrategyRunResult> {
    const strategyId = params.strategy_id?.trim()
    if (!strategyId) {
      throw new Error('strategy_id is required')
    }
    const tsCode = params.ts_code?.trim()
    if (!tsCode) {
      throw new Error('ts_code is required')
    }
    const startDate = params.start_date ?? MARKET_SYNC_EARLIEST
    const endDate = params.end_date ?? todayYyyymmdd()
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      throw new Error('start_date and end_date must be YYYYMMDD')
    }
    if (startDate > endDate) {
      throw new Error('start_date must be <= end_date')
    }
    const adjust = params.adjust ?? 'qfq'
    if (adjust !== 'none' && adjust !== 'qfq' && adjust !== 'hfq') {
      throw new Error('adjust must be none | qfq | hfq')
    }
    return pythonBridge.call<StrategyRunResult>(PYTHON_METHODS.strategyRun, {
      strategy_id: strategyId,
      ts_code: tsCode,
      start_date: startDate,
      end_date: endDate,
      adjust,
      ...(params.params !== undefined ? { params: params.params } : {})
    })
  }
}

function emitProgress(
  handler: SyncProgressHandler | undefined,
  progress: MarketSyncProgress
): void {
  lastSyncProgress = progress
  handler?.(progress)
}

async function runSteps(
  stepIds: PipelineStepId[],
  onProgress?: SyncProgressHandler
): Promise<PipelineRunResult> {
  if (marketSyncing) {
    throw new Error('行情同步正在进行中')
  }
  const token = requireToken()

  const before = await applicationService.getPipelineStatus()
  const freshIds = new Set(before.steps.filter((step) => step.fresh).map((step) => step.id))

  const outcomes: PipelineRunStepOutcome[] = []
  const errors: Array<{ step_id: string; message: string }> = []
  marketSyncing = true
  try {
    for (let index = 0; index < stepIds.length; index += 1) {
      const stepId = stepIds[index]
      const meta = pipelineStepMeta(stepId)
      const label = meta ? `步骤 ${meta.ordinal} ${meta.title}` : stepId
      if (freshIds.has(stepId)) {
        outcomes.push({ step_id: stepId, ran: false, message: '已最新，跳过', error: null })
        continue
      }
      runningStepId = stepId
      emitProgress(onProgress, {
        stage: 'step',
        done_days: 0,
        total_pending: 0,
        skipped_days: 0,
        error_count: errors.length,
        step_id: stepId,
        step_index: index + 1,
        step_total: stepIds.length,
        message: `${label}…`
      })
      try {
        const message = await executeStep(stepId, token, index, stepIds.length, onProgress)
        lastStepErrors.delete(stepId)
        outcomes.push({ step_id: stepId, ran: true, message, error: null })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        lastStepErrors.set(stepId, message)
        errors.push({ step_id: stepId, message })
        outcomes.push({ step_id: stepId, ran: true, message: `${label} 失败`, error: message })
      } finally {
        runningStepId = null
      }
    }
  } finally {
    marketSyncing = false
    runningStepId = null
  }

  const ranCount = outcomes.filter((item) => item.ran && !item.error).length
  const skippedCount = outcomes.filter((item) => !item.ran).length
  emitProgress(onProgress, {
    stage: 'done',
    done_days: 0,
    total_pending: 0,
    skipped_days: skippedCount,
    error_count: errors.length,
    message:
      errors.length > 0
        ? `完成 ${ranCount} 步，跳过 ${skippedCount} 步，失败 ${errors.length} 步`
        : `完成 ${ranCount} 步，跳过 ${skippedCount} 步`
  })

  return { steps: outcomes, ran_count: ranCount, skipped_count: skippedCount, errors }
}

async function executeStep(
  stepId: PipelineStepId,
  token: string,
  stepIndex: number,
  stepTotal: number,
  onProgress?: SyncProgressHandler
): Promise<string> {
  if (stepId === 'stock_list') {
    const result = await applicationService.syncStockList()
    await markStepSynced(stepId)
    return `在市 ${result.listed} 只，退市 ${result.delisted} 只，本次新标记退市 ${result.marked_delisted} 只`
  }

  if (stepId === 'sw_industry') {
    const result = await applicationService.syncSwIndustry()
    await markStepSynced(stepId)
    const errHint = result.errors.length > 0 ? `；失败 ${result.errors.length} 个一级` : ''
    return `分类 ${result.classify_count} 个，成分 ${result.member_count} 只${errHint}`
  }

  if (stepId === 'delisted') {
    // 派生步：不自己拉数，跟随步骤 3 与步骤 4 默认段。
    return `退市 ${stocksRepository.countDelisted()} 只（由股票列表与股票日线派生）`
  }

  if (isDailyBarPullStepId(stepId)) {
    return runDailyBarStep(stepId, token, stepIndex, stepTotal, onProgress)
  }

  const result = await pythonBridge.call<PipelineStepRunResult>(
    PYTHON_METHODS.syncPipelineStep,
    { token, step_id: stepId },
    PIPELINE_STEP_TIMEOUT_MS
  )
  if (result.error) {
    throw new Error(result.error)
  }
  return result.detail ?? `写入 ${result.row_count} 行`
}

/** 分批拉股票日线。区间来自 Python 的固定窗口，pending 只来自 `sync_trade_date` 水位。 */
async function runDailyBarStep(
  stepId: PipelineStepId,
  token: string,
  stepIndex: number,
  stepTotal: number,
  onProgress?: SyncProgressHandler
): Promise<string> {
  const plan = await pythonBridge.call<PipelinePlanResult>(PYTHON_METHODS.metaPipelinePlan, {
    step_id: stepId
  })
  const meta = pipelineStepMeta(stepId)
  const ordinal = meta ? `步骤 ${meta.ordinal}` : stepId
  const pending = plan.pending_dates ?? []
  const failures: string[] = []
  let barCount = 0
  let adjCount = 0

  for (let index = 0; index < pending.length; index += 1) {
    const tradeDate = pending[index]
    emitProgress(onProgress, {
      stage: 'fetch_day',
      done_days: index,
      total_pending: pending.length,
      skipped_days: plan.complete_count,
      current_date: tradeDate,
      error_count: failures.length,
      step_id: stepId,
      step_index: stepIndex + 1,
      step_total: stepTotal,
      message: `${ordinal} 补齐交易日 ${index + 1}/${pending.length}（${tradeDate}）`
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
        failures.push(`${tradeDate}: ${day.error}`)
      }
    } catch (err: unknown) {
      failures.push(`${tradeDate}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  applicationService.ensureMarketPool()

  if (failures.length > 0) {
    throw new Error(
      `补齐 ${pending.length - failures.length}/${pending.length} 日，失败 ${failures.length} 日：${failures[0]}`
    )
  }
  return `补齐 ${pending.length} 日，跳过 ${plan.complete_count} 日，日线 ${barCount} 行 / 复权 ${adjCount} 行`
}

/** 快照类步骤把「跑过的那个已收盘开市日」记下来，作为是否过期的标尺。 */
async function markStepSynced(stepId: PipelineStepId): Promise<void> {
  await pythonBridge.call(PYTHON_METHODS.metaMarkStep, { step_id: stepId })
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
