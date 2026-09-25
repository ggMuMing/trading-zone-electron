import { ipcMain } from 'electron'
import { getTushareToken, hasTushareToken, setTushareToken } from '../config/appConfig'
import { stocksRepository } from '../db/stocksRepository'
import { applicationService } from '../services/applicationService'
import { pythonBridge } from '../bridge/pythonBridge'
import type { AdjustType, MarketQueryParams } from '../../shared/types/market'
import type { LayoutItemParams, ScriptParams } from '../../shared/types/chartLayout'
import type { ScriptTryParams } from '../../shared/types/indicatorScript'
import type { StrategyRunParams } from '../../shared/types/pythonProtocol'
import { pipelineStepMeta, type PipelineStepId } from '../../shared/constants/pipeline'

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

function parseStrategyParamValues(value: unknown): Record<string, number | string> | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('params must be an object')
  }
  const out: Record<string, number | string> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) {
        throw new Error(`params.${key} must be a finite number`)
      }
      out[key] = item
    } else if (typeof item === 'string') {
      out[key] = item
    } else {
      throw new Error(`params.${key} must be a number or string`)
    }
  }
  return out
}

function parseStrategyRunParams(params: unknown): StrategyRunParams {
  if (!params || typeof params !== 'object') {
    throw new Error('strategy:run requires params object')
  }
  const p = params as Record<string, unknown>
  if (typeof p.strategy_id !== 'string' || !p.strategy_id.trim()) {
    throw new Error('strategy_id must be a non-empty string')
  }
  if (typeof p.ts_code !== 'string' || !p.ts_code.trim()) {
    throw new Error('ts_code must be a non-empty string')
  }
  if (typeof p.start_date !== 'string' || !p.start_date.trim()) {
    throw new Error('start_date must be a non-empty string')
  }
  if (typeof p.end_date !== 'string' || !p.end_date.trim()) {
    throw new Error('end_date must be a non-empty string')
  }
  const adjust = p.adjust
  if (adjust !== undefined && adjust !== 'none' && adjust !== 'qfq' && adjust !== 'hfq') {
    throw new Error('adjust must be none | qfq | hfq')
  }
  const strategyParams = parseStrategyParamValues(p.params)
  return {
    strategy_id: p.strategy_id.trim(),
    ts_code: p.ts_code.trim(),
    start_date: p.start_date.trim(),
    end_date: p.end_date.trim(),
    adjust: adjust as AdjustType | undefined,
    ...(strategyParams !== undefined ? { params: strategyParams } : {})
  }
}

export function registerHandlers(): void {
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('stocks:list', () => {
    return stocksRepository.listAll()
  })

  ipcMain.handle('stocks:listDelisted', () => {
    return stocksRepository.listDelisted()
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

  ipcMain.handle('market:refreshCalendar', async () => {
    return applicationService.refreshCalendar()
  })

  ipcMain.handle('market:pipelineStatus', async () => {
    return applicationService.getPipelineStatus()
  })

  ipcMain.handle('market:runPipeline', async (event) => {
    return applicationService.runPipeline((progress) => {
      event.sender.send('market:syncProgress', progress)
    })
  })

  ipcMain.handle('market:runStep', async (event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('market:runStep requires params object')
    }
    const stepId = (params as Record<string, unknown>).step_id
    if (typeof stepId !== 'string' || !pipelineStepMeta(stepId)) {
      throw new Error('step_id must be a known pipeline step')
    }
    return applicationService.runPipelineStep(stepId as PipelineStepId, (progress) => {
      event.sender.send('market:syncProgress', progress)
    })
  })

  ipcMain.handle('market:syncStatus', () => {
    return applicationService.getMarketSyncStatus()
  })

  ipcMain.handle('market:clear', async () => {
    return applicationService.clearMarket()
  })

  ipcMain.handle('market:syncIndexWeights', async () => {
    return applicationService.syncIndexWeights()
  })

  ipcMain.handle('industry:sync', async () => {
    return applicationService.syncSwIndustry()
  })

  ipcMain.handle('industry:tree', () => {
    return applicationService.listSwIndustryTree()
  })

  ipcMain.handle('industry:members', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('industry:members requires params object')
    }
    const indexCode = (params as Record<string, unknown>).index_code
    if (typeof indexCode !== 'string' || !indexCode.trim()) {
      throw new Error('index_code must be a non-empty string')
    }
    return applicationService.listSwIndustryMembers(indexCode.trim())
  })

  ipcMain.handle('industry:breadcrumb', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('industry:breadcrumb requires params object')
    }
    const tsCode = (params as Record<string, unknown>).ts_code
    if (typeof tsCode !== 'string' || !tsCode.trim()) {
      throw new Error('ts_code must be a non-empty string')
    }
    return applicationService.getSwIndustryBreadcrumb(tsCode.trim())
  })

  ipcMain.handle('market:indexConstituents', async (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('market:indexConstituents requires params object')
    }
    const indexCode = (params as Record<string, unknown>).index_code
    if (typeof indexCode !== 'string' || !indexCode.trim()) {
      throw new Error('index_code must be a non-empty string')
    }
    return applicationService.listIndexConstituents(indexCode.trim())
  })

  ipcMain.handle('market:pool', () => {
    return applicationService.getMarketPool()
  })

  ipcMain.handle('market:query', async (_event, params: unknown) => {
    return applicationService.queryOhlcv(parseMarketQueryParams(params, 'market:query'))
  })

  ipcMain.handle('dashboard:query', async (_event, params: unknown) => {
    if (params !== undefined && params !== null && typeof params !== 'object') {
      throw new Error('dashboard:query requires params object')
    }
    const p = (params ?? {}) as Record<string, unknown>
    return applicationService.queryDashboard({
      ts_code: typeof p.ts_code === 'string' ? p.ts_code : undefined,
      start_date: typeof p.start_date === 'string' ? p.start_date : undefined,
      end_date: typeof p.end_date === 'string' ? p.end_date : undefined,
      breadth_universe:
        p.breadth_universe === 'all' ||
        p.breadth_universe === '000300.SH' ||
        p.breadth_universe === '932000.CSI'
          ? p.breadth_universe
          : undefined
    })
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

  ipcMain.handle('chartLayout:reorder', (_event, params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('chartLayout:reorder requires params object')
    }
    const p = params as Record<string, unknown>
    if (typeof p.id !== 'string' || !p.id.trim()) {
      throw new Error('id must be a non-empty string')
    }
    if (p.direction !== 'up' && p.direction !== 'down') {
      throw new Error('direction must be up or down')
    }
    return applicationService.reorderChartIndicator(p.id.trim(), p.direction)
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

  ipcMain.handle('strategy:list', () => {
    return applicationService.listStrategies()
  })

  ipcMain.handle('strategy:run', (_event, params: unknown) => {
    return applicationService.runStrategy(parseStrategyRunParams(params))
  })
}
