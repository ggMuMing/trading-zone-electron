import axios from "axios";
import type {
  Account,
  OpenRecordVO,
  OpenRecord,
  OpenRecordResponse,
  Stock,
  StockSymbolSearchItem,
  ParquetColumn,
  ParquetPageResponse,
  StockDailyData,
  ChartIndicatorSummary,
  ChartIndicatorMeta,
  ChartLayout,
  UpdateChartIndicatorBody,
  MoveChartPanelDownBody,
  MoveChartPanelUpBody,
  CalculateChartIndicatorBody,
  ChartIndicatorCalculateResult,
  StrategySummary,
  CalculateStrategyBuyPointsBody,
  StrategyBuyPointsResult,
  StockScreeningStrategy,
  StockScreeningFilterType,
  StockScreeningTask,
  StockScreeningResults,
  StockScreeningResultStock,
  Judge0SubmissionRequest,
  Judge0SubmissionResponse,
  CreateCustomIndicatorRequest,
  CreateCustomIndicatorResponse,
  CustomIndicatorEditorTemplateResponse,
  StockGroup,
} from './apiType';
const api = axios.create({
  baseURL: '/api', // 使用代理路径，避免 CORS 问题
})

const getAccountList = async () => {
  try {
    const response = await api.get<Account[]>('/account/all')
    return response.data as Account[]
  } catch (error) {
    console.error(error)
    return []
  }
}

const createAccount = async (account: { name: string, amount: number, description: string }) => {
  try {
    const response = await api.post('/account/add', {
      name: account.name,
      amount: account.amount,
      description: account.description,
    })
    return response.data as Account
  } catch (error) {
    console.error(error)
    return null
  }
}

const deleteAccount = async (account: { id: string }) => {
  try {
    const response = await api.delete(`/account/delete/${account.id}`)
    return response.data as Account
  } catch (error) {
    console.error(error)
    return null
  }
}

const getOpenRecordList = async (accountId: string, page: number = 1, pageSize: number = 10, symbol_name: string = ''): Promise<OpenRecordResponse> => {
  try {
    const response = await api.get<OpenRecordResponse>(`/account/${accountId}/tradings/list`, {
      params: {
        page,
        pageSize,
        symbol_name,
      },
    })
    return response.data as OpenRecordResponse
  } catch (error) {
    console.error(error)
    return {
      data: [],
      count: 0,
    } as OpenRecordResponse
  }
}

const getRecordSymbolList = async (account_id: string): Promise<Stock[]> => {
  try {
    const response = await api.get<Stock[]>(`/account/trading/symbols`, {
      params: {
        account_id,
      },
    })
    return response.data as Stock[]
  } catch (error) {
    console.error(error)
    return []
  }
}

const createOpenRecord = async (record: OpenRecordVO): Promise<OpenRecord> => {
  try {
    const response = await api.post('/account/trading/add', record)
    return response.data as OpenRecord
  } catch (error) {
    console.error(error)
    return {} as OpenRecord
  }
}

// 删除接口/trading/delete/{id}
const deleteOpenRecord = async (id: string): Promise<void> => {
  try {
    await api.delete(`/account/trading/delete/${id}`)
  } catch (error) {
    console.error(error)
  }
}

const getStockAll = async (): Promise<Stock[]> => {
  try {
    const response = await api.get<{ status: string, data: Stock[] }>('/stock/all')
    return response.data?.data || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const getStockListByFilter = async (condition: string): Promise<Stock[]> => {
  try {
    const response = await api.get<{ status: string, data: Stock[] }>('/stock/filter', {
      params: { condition },
    })
    return response.data?.data || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const searchStockSymbols = async (
  query: string,
  assetType: 'all' | 'stocks' = 'all',
  limit: number = 50,
): Promise<StockSymbolSearchItem[]> => {
  try {
    const response = await api.get<{ status: string, data: StockSymbolSearchItem[] }>('/stock/symbol-search', {
      params: { query, type: assetType, limit },
    })
    return response.data?.data || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const getStockDailyData = async (symbol: string, adjust: 'qfq' | 'hfq' | 'standard' = 'standard'): Promise<StockDailyData[]> => {
  try {
    const response = await api.get<{ status: string, data: StockDailyData[] }>('/stock/price/daily', {
      params: { symbol, adjust },       
    })

    const data = response.data?.data || []
    // 转换trade_date from YYYYMMDD to YYYY-MM-DD
    const formattedData = data.map(item => ({
      ...item,
      trade_date: item.trade_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
    }))
    return formattedData
  } catch (error) {
    console.error(error)
    return []
  }
}

const getParquetColumns = async (
  stock_code: string,
  adjust: 'qfq' | 'hfq' = 'qfq',
): Promise<ParquetColumn[]> => {
  try {
    const response = await api.get<{ status: string, data: { columns: ParquetColumn[] } }>('/stock/parquet/columns', {
      params: { stock_code, adjust },
    })
    return response.data?.data?.columns || []
  } catch (error) {
    console.error(error)
    throw error
  }
}

const getParquetPage = async (
  stock_code: string,
  adjust: 'qfq' | 'hfq' = 'qfq',
  page: number,
  pageSize: number
): Promise<ParquetPageResponse> => {
  try {
    const response = await api.get<{ status: string, data: ParquetPageResponse }>('/stock/parquet/data', {
      params: {
        stock_code,
        adjust,
        page,
        pageSize,
      },
    })
    return response.data?.data || { count: 0, data: [] }
  } catch (error) {
    console.error(error)
    throw error
  }
}

const getChartIndicators = async (): Promise<ChartIndicatorSummary[]> => {
  try {
    const response = await api.get<{ status: string, data: { indicators: ChartIndicatorSummary[] } }>('/chart/indicators')
    return response.data?.data?.indicators || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const getChartIndicatorMeta = async (indicator_type: string): Promise<ChartIndicatorMeta | null> => {
  try {
    const response = await api.get<{ status: string, data: ChartIndicatorMeta }>('/chart/indicator/meta', {
      params: { indicator_type },
    })
    return response.data?.data || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const getChartLayout = async (): Promise<ChartLayout | null> => {
  try {
    const response = await api.get<{ status: string, data: { layout: ChartLayout } }>('/chart/layout')
    return response.data?.data?.layout || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const addChartLayoutIndicator = async (indicator_id: string): Promise<ChartLayout | null> => {
  try {
    const response = await api.post<{ status: string, data: { layout: ChartLayout } }>('/chart/layout/add', {
      indicator_id,
    })
    return response.data?.data?.layout || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const updateChartLayout = async (layout: ChartLayout): Promise<ChartLayout | null> => {
  try {
    const response = await api.put<{ status: string, data: { layout: ChartLayout } }>('/chart/layout/update', {
      layout,
    })
    return response.data?.data?.layout || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const deleteChartLayoutIndicator = async (instance_id: string): Promise<ChartLayout | null> => {
  try {
    const response = await api.delete<{ status: string, data: { layout: ChartLayout } }>(`/chart/layout/indicator/${instance_id}`)
    return response.data?.data?.layout || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const updateChartLayoutIndicator = async (
  instance_id: string,
  body: UpdateChartIndicatorBody,
): Promise<ChartLayout | null> => {
  try {
    const response = await api.patch<{ status: string, data: { layout: ChartLayout } }>(
      `/chart/layout/indicator/${instance_id}`,
      body,
    )
    return response.data?.data?.layout || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const moveChartPanelUp = async (panel_index: number): Promise<ChartLayout | null> => {
  try {
    const body: MoveChartPanelUpBody = { panel_index }
    const response = await api.post<{ status: string, data: { layout: ChartLayout } }>(
      '/chart/layout/panel/move-up',
      body,
    )
    return response.data?.data?.layout || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const moveChartPanelDown = async (panel_index: number): Promise<ChartLayout | null> => {
  try {
    const body: MoveChartPanelDownBody = { panel_index }
    const response = await api.post<{ status: string, data: { layout: ChartLayout } }>(
      '/chart/layout/panel/move-down',
      body,
    )
    return response.data?.data?.layout || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const calculateChartIndicator = async (
  body: CalculateChartIndicatorBody,
): Promise<ChartIndicatorCalculateResult | null> => {
  try {
    const response = await api.post<{ status: string, data: ChartIndicatorCalculateResult }>(
      '/chart/indicator/calculate',
      body,
    )
    return response.data?.data || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const getStrategyList = async (): Promise<StrategySummary[]> => {
  try {
    const response = await api.get<{ status: string, data: { strategies: StrategySummary[] } }>('/strategy/list')
    return response.data?.data?.strategies || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const getSelectedStrategies = async (): Promise<string[]> => {
  try {
    const response = await api.get<{ status: string, data: { selected: string[] } }>('/strategy/selected')
    return response.data?.data?.selected || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const setSelectedStrategies = async (selected: string[]): Promise<string[]> => {
  try {
    const response = await api.post<{ status: string, data: { selected: string[] } }>('/strategy/selected', {
      selected,
    })
    return response.data?.data?.selected || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const getStrategyBuyPoints = async (
  body: CalculateStrategyBuyPointsBody,
): Promise<StrategyBuyPointsResult | null> => {
  try {
    const response = await api.post<{ status: string, data: StrategyBuyPointsResult }>(
      '/strategy/buy-points',
      body,
    )
    return response.data?.data || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const getStockScreeningStrategies = async (): Promise<StockScreeningStrategy[]> => {
  try {
    const response = await api.get<{ status: string, data: { strategies: StockScreeningStrategy[] } }>(
      '/stock-screening/strategies',
    )
    return response.data?.data?.strategies || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const createStockScreeningStrategy = async (
  name: string,
  strategyIds: string[],
): Promise<StockScreeningStrategy | null> => {
  try {
    const response = await api.post<{ status: string, data: { strategy: StockScreeningStrategy } }>(
      '/stock-screening/strategies',
      { name, strategy_ids: strategyIds },
    )
    return response.data?.data?.strategy || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const deleteStockScreeningStrategy = async (name: string): Promise<boolean> => {
  try {
    await api.delete(`/stock-screening/strategies/${encodeURIComponent(name)}`)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

const runStockScreening = async (
  strategyName: string,
  tradeDate: string,
): Promise<StockScreeningTask | null> => {
  try {
    const response = await api.post<{ status: string, data: { task: StockScreeningTask } }>(
      '/stock-screening/run',
      { strategy_name: strategyName, trade_date: tradeDate },
    )
    return response.data?.data?.task || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const getStockScreeningTask = async (taskId: string): Promise<StockScreeningTask | null> => {
  try {
    const response = await api.get<{ status: string, data: { task: StockScreeningTask } }>(
      `/stock-screening/tasks/${encodeURIComponent(taskId)}`,
    )
    return response.data?.data?.task || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const getStockScreeningResults = async (
  strategyName: string,
  tradeDate: string,
  filterType: StockScreeningFilterType = 'all',
): Promise<StockScreeningResults> => {
  try {
    const response = await api.get<{ status: string, data: StockScreeningResults }>(
      '/stock-screening/results',
      { params: { strategy_name: strategyName, trade_date: tradeDate, filter_type: filterType } },
    )
    return response.data?.data || {
      strategy_name: strategyName,
      trade_date: tradeDate,
      filter_type: filterType,
      stocks: [],
    }
  } catch (error) {
    console.error(error)
    return {
      strategy_name: strategyName,
      trade_date: tradeDate,
      filter_type: filterType,
      stocks: [],
    }
  }
}

const updateStockScreeningResultFlag = async (
  strategyName: string,
  tradeDate: string,
  symbol: string,
  flag: 1 | 2,
): Promise<StockScreeningResultStock | null> => {
  try {
    const response = await api.patch<{ status: string, data: { symbol: string, flag: 1 | 2 } }>(
      '/stock-screening/results/flag',
      { strategy_name: strategyName, trade_date: tradeDate, symbol, flag },
    )
    const data = response.data?.data
    return data ? { symbol: data.symbol, name: '', flag: data.flag } : null
  } catch (error) {
    console.error(error)
    return null
  }
}

const createJudge0Submission = async (
  body: Judge0SubmissionRequest,
): Promise<Judge0SubmissionResponse | null> => {
  try {
    const response = await api.post<{ status: string, data: Judge0SubmissionResponse }>(
      '/editor/submissions',
      body,
      {
        params: {
          wait: true,
          base64_encoded: false,
        },
      },
    )
    return response.data?.data || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const createCustomIndicator = async (
  body: CreateCustomIndicatorRequest,
): Promise<CreateCustomIndicatorResponse | null> => {
  try {
    const response = await api.post<{ status: string, data: CreateCustomIndicatorResponse }>(
      '/editor/custom-indicators/create',
      body,
    )
    return response.data?.data || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const testCustomIndicatorRun = async (
  body: CreateCustomIndicatorRequest,
): Promise<Judge0SubmissionResponse | null> => {
  try {
    const response = await api.post<{ status: string, data: Judge0SubmissionResponse }>(
      '/editor/custom-indicators/test-run',
      body,
    )
    return response.data?.data || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const getCustomIndicatorEditorTemplate = async (): Promise<string | null> => {
  try {
    const response = await api.get<{ status: string, data: CustomIndicatorEditorTemplateResponse }>(
      '/editor/custom-indicators/template',
    )
    const code = response.data?.data?.source_code
    return typeof code === 'string' ? code : null
  } catch (error) {
    console.error(error)
    return null
  }
}

const getCustomIndicators = async (): Promise<ChartIndicatorSummary[]> => {
  try {
    const response = await api.get<{ status: string, data: { indicators: ChartIndicatorSummary[] } }>(
      '/chart/custom-indicators',
    )
    return response.data?.data?.indicators || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const getStockGroups = async (): Promise<StockGroup[]> => {
  try {
    const response = await api.get<{ status: string, data: { groups: StockGroup[] } }>('/stock-group/list')
    return response.data?.data?.groups || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const getStockGroupMembership = async (symbol: string): Promise<string[]> => {
  try {
    const response = await api.get<{ status: string, data: { group_ids: string[] } }>('/stock-group/membership', {
      params: { symbol },
    })
    return response.data?.data?.group_ids || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const createStockGroup = async (name: string): Promise<StockGroup | null> => {
  try {
    const response = await api.post<{ status: string, data: { group: StockGroup } }>('/stock-group', { name })
    return response.data?.data?.group || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const updateStockGroup = async (groupId: string, name: string): Promise<StockGroup | null> => {
  try {
    const response = await api.put<{ status: string, data: { group: StockGroup } }>(`/stock-group/${groupId}`, { name })
    return response.data?.data?.group || null
  } catch (error) {
    console.error(error)
    return null
  }
}

const deleteStockGroup = async (groupId: string): Promise<boolean> => {
  try {
    await api.delete(`/stock-group/${groupId}`)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

const getStockGroupStocks = async (
  groupId: string,
  query: string = '',
  limit: number = 200,
  focusSymbol?: string,
): Promise<Stock[]> => {
  try {
    const response = await api.get<{ status: string, data: { stocks: Stock[] } }>(`/stock-group/${groupId}/stocks`, {
      params: {
        query,
        limit,
        ...(focusSymbol ? { focus_symbol: focusSymbol } : {}),
      },
    })
    return response.data?.data?.stocks || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const addStocksToStockGroup = async (groupId: string, stocks: Stock[]): Promise<Stock[]> => {
  try {
    const response = await api.post<{ status: string, data: { stocks: Stock[] } }>(`/stock-group/${groupId}/stocks`, {
      stocks,
    })
    return response.data?.data?.stocks || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const removeStockFromStockGroup = async (groupId: string, symbol: string): Promise<boolean> => {
  try {
    await api.delete(`/stock-group/${groupId}/stocks/${encodeURIComponent(symbol)}`)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

const reorderStockGroupStocks = async (groupId: string, symbols: string[]): Promise<Stock[]> => {
  try {
    const response = await api.put<{ status: string, data: { stocks: Stock[] } }>(
      `/stock-group/${groupId}/stocks/reorder`,
      { symbols },
    )
    return response.data?.data?.stocks || []
  } catch (error) {
    console.error(error)
    return []
  }
}

const deleteCustomIndicator = async (indicator_id: string): Promise<ChartLayout | null> => {
  try {
    const response = await api.delete<{ status: string, data: { layout: ChartLayout } }>(
      `/chart/custom-indicators/${indicator_id}`,
    )
    return response.data?.data?.layout || null
  } catch (error) {
    console.error(error)
    return null
  }
}

export {
  getAccountList,
  createAccount,
  deleteAccount,
  getOpenRecordList,
  createOpenRecord,
  deleteOpenRecord,
  getStockAll,
  getRecordSymbolList,
  getParquetColumns,
  getParquetPage,
  getStockListByFilter,
  searchStockSymbols,
  getStockDailyData,
  getChartIndicators,
  getChartIndicatorMeta,
  getChartLayout,
  addChartLayoutIndicator,
  updateChartLayout,
  deleteChartLayoutIndicator,
  updateChartLayoutIndicator,
  moveChartPanelUp,
  moveChartPanelDown,
  calculateChartIndicator,
  getStrategyList,
  getSelectedStrategies,
  setSelectedStrategies,
  getStrategyBuyPoints,
  getStockScreeningStrategies,
  createStockScreeningStrategy,
  deleteStockScreeningStrategy,
  runStockScreening,
  getStockScreeningTask,
  getStockScreeningResults,
  updateStockScreeningResultFlag,
  createJudge0Submission,
  createCustomIndicator,
  testCustomIndicatorRun,
  getCustomIndicatorEditorTemplate,
  getCustomIndicators,
  deleteCustomIndicator,
  getStockGroups,
  getStockGroupMembership,
  createStockGroup,
  updateStockGroup,
  deleteStockGroup,
  getStockGroupStocks,
  addStocksToStockGroup,
  removeStockFromStockGroup,
  reorderStockGroupStocks,
}