import { ipcMain } from 'electron'
import { getTushareToken, hasTushareToken, setTushareToken } from '../config/appConfig'
import { stocksRepository } from '../db/stocksRepository'
import { applicationService } from '../services/applicationService'
import { pythonBridge } from '../bridge/pythonBridge'

export function registerHandlers(): void {
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('stocks:list', () => {
    return stocksRepository.listAll()
  })

  ipcMain.handle('stocks:count', () => {
    return stocksRepository.count()
  })

  ipcMain.handle('stocks:sync', async () => {
    return applicationService.syncStockList()
  })

  ipcMain.handle('config:hasTushareToken', () => {
    return hasTushareToken()
  })

  ipcMain.handle('config:getTushareTokenMasked', () => {
    const token = getTushareToken()
    if (!token) {
      return null
    }
    if (token.length <= 8) {
      return '****'
    }
    return `${token.slice(0, 4)}...${token.slice(-4)}`
  })

  ipcMain.handle('config:setTushareToken', (_event, token: unknown) => {
    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('token must be a non-empty string')
    }
    setTushareToken(token)
    return true
  })

  ipcMain.handle('python:ready', () => {
    return pythonBridge.getReadyInfo()
  })
}
