import { ElectronAPI } from '@electron-toolkit/preload'

export interface AppApi {
  ping: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
