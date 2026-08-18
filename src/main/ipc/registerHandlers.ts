import { ipcMain } from 'electron'
import { getTushareToken, hasTushareToken, setTushareToken } from '../config/appConfig'
import { stocksRepository } from '../db/stocksRepository'
import { applicationService } from '../services/applicationService'
import { pythonBridge } from '../bridge/pythonBridge'
import type { AdjustType, MarketQueryParams } from '../../shared/types/market'

function parseMarketQueryParams(params: unknown, channel: string): MarketQueryParams {
  if (!params || typeof params !== 'object') {
    throw new Error(`${channel} requires params object`)
  }
  const p = params as Record<string, unknown>
  if (typeof p.ts_code !== 'string' || !p.ts_code.trim()) {
    throw new Error('ts_code must be a non-empty string')
  }
  const adjust = p.adjust
  if (adjust !== undefined && adjust !== 'none' && adjust !== 'qfq' && adjust !== 'hfq') {
    throw new Error('adjust must be none | qfq | hfq')
  }
  return {
    ts_code: p.ts_code,
    adjust: adjust as AdjustType | undefined,
    start_date: typeof p.start_date === 'string' ? p.start_date : undefined,
    end_date: typeof p.end_date === 'string' ? p.end_date : undefined,
    limit:
      typeof p.limit === 'number' && Number.isInteger(p.limit) && p.limit >= 1 ? p.limit : undefined
  }
}

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

  ipcMain.handle('stocks:boardStats', () => {
    return applicationService.getBoardStats()
  })

  ipcMain.handle('market:syncPool', async () => {
    return applicationService.syncMarketPool()
  })

  ipcMain.handle('market:sync', async (event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('market:sync requires params object')
    }
    const p = params as Record<string, unknown>
    if (typeof p.start_date !== 'string' || typeof p.end_date !== 'string') {
      throw new Error('start_date and end_date are required')
    }
    return applicationService.syncMarketWindow(
      { start_date: p.start_date, end_date: p.end_date },
      (progress) => {
        event.sender.send('market:syncProgress', progress)
      }
    )
  })

  ipcMain.handle('market:syncStatus', () => {
    return applicationService.getMarketSyncStatus()
  })

  ipcMain.handle('market:clear', async () => {
    return applicationService.clearMarket()
  })

  ipcMain.handle('market:pool', () => {
    return applicationService.getMarketPool()
  })

  ipcMain.handle('market:query', async (_event, params: unknown) => {
    return applicationService.queryOhlcv(parseMarketQueryParams(params, 'market:query'))
  })

  ipcMain.handle('chart:build', async (_event, params: unknown) => {
    return applicationService.buildChartInput(parseMarketQueryParams(params, 'chart:build'))
  })

  ipcMain.handle('market:coverage', async () => {
    return applicationService.getMarketCoverage()
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
