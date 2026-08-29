import { ElectronAPI } from '@electron-toolkit/preload'
import type { Stock } from '../shared/types/stock'
import type { MarketClearResult, WorkerReadyMessage } from '../shared/types/pythonProtocol'
import type { ChartInput } from '../shared/types/chart'
import type { ChartLayout, LayoutItemParams } from '../shared/types/chartLayout'
import type { IndicatorScript, ScriptTryParams, ScriptTryResult } from '../shared/types/indicatorScript'
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
} from '../shared/types/market'

export interface SyncStockListResult {
  count: number
  fetched: number
}

export interface AppApi {
  ping: () => void
  stocks: {
    list: () => Promise<Stock[]>
    count: () => Promise<number>
    sync: () => Promise<SyncStockListResult>
    boardStats: () => Promise<BoardStats>
  }
  market: {
    syncPool: () => Promise<SyncMarketPoolResult>
    sync: (params: { start_date: string; end_date: string }) => Promise<SyncMarketWindowResult>
    clear: () => Promise<MarketClearResult>
    pool: () => Promise<MarketPoolItem[]>
    query: (params: MarketQueryParams) => Promise<MarketQueryResult>
    coverage: () => Promise<MarketCoverageResult>
    syncStatus: () => Promise<MarketSyncStatus>
    onSyncProgress: (callback: (progress: MarketSyncProgress) => void) => () => void
  }
  chart: {
    build: (params: MarketQueryParams) => Promise<ChartInput | null>
  }
  chartLayout: {
    get: () => Promise<ChartLayout>
    add: (params: { kind: 'script'; ref: string }) => Promise<ChartLayout>
    remove: (params: { id: string }) => Promise<ChartLayout>
    update: (params: { id: string; params: LayoutItemParams }) => Promise<ChartLayout>
  }
  indicatorScript: {
    list: () => Promise<IndicatorScript[]>
    exampleSource: () => Promise<string>
    try: (params: ScriptTryParams) => Promise<ScriptTryResult>
    create: (params: { title: string; source: string }) => Promise<IndicatorScript[]>
    update: (params: { id: string; title?: string; source?: string }) => Promise<IndicatorScript[]>
    remove: (params: { id: string }) => Promise<IndicatorScript[]>
  }
  config: {
    hasTushareToken: () => Promise<boolean>
    getTushareTokenMasked: () => Promise<string | null>
    setTushareToken: (token: string) => Promise<boolean>
  }
  python: {
    ready: () => Promise<WorkerReadyMessage | null>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}

export {}
