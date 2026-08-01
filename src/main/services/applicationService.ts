import { PYTHON_METHODS, type StockListResult } from '../../shared/types/pythonProtocol'
import { pythonBridge } from '../bridge/pythonBridge'
import { getTushareToken } from '../config/appConfig'
import { stocksRepository } from '../db/stocksRepository'

export interface SyncStockListResult {
  count: number
  fetched: number
}

export const applicationService = {
  async syncStockList(): Promise<SyncStockListResult> {
    const token = getTushareToken()
    if (!token) {
      throw new Error(
        'Tushare token 未配置。请设置环境变量 TUSHARE_TOKEN，或通过配置写入 userData。'
      )
    }

    const result = await pythonBridge.call<StockListResult>(PYTHON_METHODS.syncStockList, {
      token
    })

    const count = stocksRepository.upsertMany(result.stocks)
    return {
      count,
      fetched: result.count
    }
  }
}
