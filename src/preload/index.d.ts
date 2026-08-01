import { ElectronAPI } from '@electron-toolkit/preload'
import type { Stock } from '../shared/types/stock'
import type { WorkerReadyMessage } from '../shared/types/pythonProtocol'

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
