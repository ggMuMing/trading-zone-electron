import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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

const api = {
  ping: (): void => {
    ipcRenderer.send('ping')
  },
  stocks: {
    list: (): Promise<Stock[]> => ipcRenderer.invoke('stocks:list'),
    count: (): Promise<number> => ipcRenderer.invoke('stocks:count'),
    sync: (): Promise<SyncStockListResult> => ipcRenderer.invoke('stocks:sync'),
    boardStats: (): Promise<BoardStats> => ipcRenderer.invoke('stocks:boardStats')
  },
  market: {
    syncPool: (): Promise<SyncMarketPoolResult> => ipcRenderer.invoke('market:syncPool'),
    sync: (params: { start_date: string; end_date: string }): Promise<SyncMarketWindowResult> =>
      ipcRenderer.invoke('market:sync', params),
    clear: (): Promise<MarketClearResult> => ipcRenderer.invoke('market:clear'),
    pool: (): Promise<MarketPoolItem[]> => ipcRenderer.invoke('market:pool'),
    query: (params: MarketQueryParams): Promise<MarketQueryResult> =>
      ipcRenderer.invoke('market:query', params),
    coverage: (): Promise<MarketCoverageResult> => ipcRenderer.invoke('market:coverage'),
    syncStatus: (): Promise<MarketSyncStatus> => ipcRenderer.invoke('market:syncStatus'),
    onSyncProgress: (callback: (progress: MarketSyncProgress) => void): (() => void) => {
      const listener = (_event: unknown, progress: MarketSyncProgress): void => {
        callback(progress)
      }
      ipcRenderer.on('market:syncProgress', listener)
      return () => {
        ipcRenderer.removeListener('market:syncProgress', listener)
      }
    }
  },
  chart: {
    build: (params: MarketQueryParams): Promise<ChartInput | null> =>
      ipcRenderer.invoke('chart:build', params)
  },
  config: {
    hasTushareToken: (): Promise<boolean> => ipcRenderer.invoke('config:hasTushareToken'),
    getTushareTokenMasked: (): Promise<string | null> =>
      ipcRenderer.invoke('config:getTushareTokenMasked'),
    setTushareToken: (token: string): Promise<boolean> =>
      ipcRenderer.invoke('config:setTushareToken', token)
  },
  python: {
    ready: (): Promise<WorkerReadyMessage | null> => ipcRenderer.invoke('python:ready')
  }
}

export type WindowApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error fallback when contextIsolation is disabled
  window.electron = electronAPI
  // @ts-expect-error fallback when contextIsolation is disabled
  window.api = api
}
