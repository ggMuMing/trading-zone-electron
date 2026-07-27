import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * Renderer-facing API whitelist.
 * Sprint 1 later steps will add stocks:list / stocks:sync here.
 */
const api = {
  ping: (): void => {
    electronAPI.ipcRenderer.send('ping')
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
