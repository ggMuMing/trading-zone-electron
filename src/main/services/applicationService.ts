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
import { pythonBridge } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
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

  async getMarketCoverage(tsCodes?: string[] | null): Promise<MarketCoverageResult> {
    const result = await pythonBridge.call<PyCoverage>(PYTHON_METHODS.metaMarketCoverage, {
      ts_codes: tsCodes && tsCodes.length > 0 ? tsCodes : null
    })
    return result
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
