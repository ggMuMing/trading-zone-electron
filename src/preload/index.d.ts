import { ElectronAPI } from '@electron-toolkit/preload'
import type { Stock } from '../shared/types/stock'
import type { MarketClearResult, WorkerReadyMessage } from '../shared/types/pythonProtocol'
import type { ChartInput } from '../shared/types/chart'
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
