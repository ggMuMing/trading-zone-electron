import { ipcMain } from 'electron'
import { getTushareToken, hasTushareToken, setTushareToken } from '../config/appConfig'
import { stocksRepository } from '../db/stocksRepository'
import { applicationService } from '../services/applicationService'
import { pythonBridge } from '../bridge/pythonBridge'
import type { AdjustType, MarketQueryParams } from '../../shared/types/market'
import type { LayoutItemParams, ScriptParams } from '../../shared/types/chartLayout'
import type { ScriptTryParams } from '../../shared/types/indicatorScript'

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

  ipcMain.handle('chartLayout:get', () => {
    return applicationService.getChartLayout()
  })

  ipcMain.handle('chartLayout:add', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('chartLayout:add requires params object')
    }
    const p = params as Record<string, unknown>
    const kind = p.kind
    const ref = p.ref
    if (kind !== 'script') {
      throw new Error('kind must be script')
    }
    if (typeof ref !== 'string' || !ref.trim()) {
      throw new Error('ref must be a non-empty string')
    }
    return applicationService.addChartIndicator(kind, ref.trim())
  })

  ipcMain.handle('chartLayout:remove', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('chartLayout:remove requires params object')
    }
    const id = (params as Record<string, unknown>).id
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('id must be a non-empty string')
    }
    return applicationService.removeChartIndicator(id)
  })

  ipcMain.handle('chartLayout:update', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('chartLayout:update requires params object')
    }
    const p = params as Record<string, unknown>
    if (typeof p.id !== 'string' || !p.id.trim()) {
      throw new Error('id must be a non-empty string')
    }
    if (!p.params || typeof p.params !== 'object' || Array.isArray(p.params)) {
      throw new Error('params must be an object')
    }
    return applicationService.updateChartIndicator(p.id, p.params as LayoutItemParams)
  })

  ipcMain.handle('indicatorScript:list', () => {
    return applicationService.listIndicatorScripts()
  })

  ipcMain.handle('indicatorScript:exampleSource', () => {
    return applicationService.exampleIndicatorSource()
  })

  ipcMain.handle('indicatorScript:try', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('indicatorScript:try requires params object')
    }
    const p = params as Record<string, unknown>
    if (typeof p.source !== 'string') {
      throw new Error('source must be a string')
    }
    const payload: ScriptTryParams = { source: p.source }
    if (p.params !== undefined) {
      if (!p.params || typeof p.params !== 'object' || Array.isArray(p.params)) {
        throw new Error('params must be an object')
      }
      payload.params = p.params as ScriptParams
    }
    if (p.query !== undefined) {
      payload.query = parseMarketQueryParams(p.query, 'indicatorScript:try')
    }
    return applicationService.tryIndicatorScript(payload)
  })

  ipcMain.handle('indicatorScript:create', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('indicatorScript:create requires params object')
    }
    const p = params as Record<string, unknown>
    if (typeof p.title !== 'string') {
      throw new Error('title must be a string')
    }
    if (typeof p.source !== 'string') {
      throw new Error('source must be a string')
    }
    return applicationService.createIndicatorScript(p.title, p.source)
  })

  ipcMain.handle('indicatorScript:update', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('indicatorScript:update requires params object')
    }
    const p = params as Record<string, unknown>
    if (typeof p.id !== 'string' || !p.id.trim()) {
      throw new Error('id must be a non-empty string')
    }
    if (p.title === undefined && p.source === undefined) {
      throw new Error('title or source is required')
    }
    const patch: { title?: string; source?: string } = {}
    if (p.title !== undefined) {
      if (typeof p.title !== 'string') {
        throw new Error('title must be a string')
      }
      patch.title = p.title
    }
    if (p.source !== undefined) {
      if (typeof p.source !== 'string') {
        throw new Error('source must be a string')
      }
      patch.source = p.source
    }
    return applicationService.updateIndicatorScript(p.id, patch)
  })

  ipcMain.handle('indicatorScript:remove', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('indicatorScript:remove requires params object')
    }
    const id = (params as Record<string, unknown>).id
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('id must be a non-empty string')
    }
    return applicationService.removeIndicatorScript(id)
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
