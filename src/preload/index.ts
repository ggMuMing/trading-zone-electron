import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Stock } from '../shared/types/stock'
import type { WorkerReadyMessage } from '../shared/types/pythonProtocol'

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
    sync: (): Promise<SyncStockListResult> => ipcRenderer.invoke('stocks:sync')
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
