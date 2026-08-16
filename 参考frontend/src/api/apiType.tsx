interface Account {
  id: string,
  name: string,
  amount: number,
  description: string,
}

interface OpenRecordVO {
  account_id: string, // 账户ID
  symbol_name: string, // 标的名称/代码
  entry_time: string, // 进场时间
  entry_reason: string, // 明确进场理由
  buy_price: number, // 买入价
  target_price: number, // 目标价
  stop_loss_price: number, // 止损位
  take_profit_price: number, // 止盈位
  profit_loss_ratio: number, // 盈亏比
  plan_quantity: number, // 计划买入数量
  total_amount: number, // 总金额
}

interface OpenRecord extends OpenRecordVO {
  id: string, // 记录ID
}

interface OpenRecordResponse {
  data: OpenRecord[],
  count: number,
}

interface Stock {
  symbol: string,
  name: string,
}

interface StockGroup {
  group_id: string,
  name: string,
  sort_order: number,
  is_system: boolean,
  created_at: string,
  updated_at: string,
}

/** 标的搜索（symbol-search 接口）单条结果 */
interface StockSymbolSearchItem {
  symbol: string,
  name: string,
  type: string,
  industry: string | null,
}

interface ParquetColumn {
  name: string,
  type: string,
}

interface ParquetPageResponse {
  count: number,
  data: Record<string, unknown>[],
}

interface ParquetStockItem {
  symbol: string,
  name: string,
}

interface ParquetSourceItem {
  id: string,
  name: string,
}

interface ParquetRow {
  date: string,
  symbol: string,
  open: number,
  close: number,
  high: number,
  low: number,
  volume: number,
  amount: number,
  amplitude: number,
  change: number,
  change_amount: number,
  turnover_rate: number,
}

interface StockDailyData {
  ts_code: string,
  open: number,
  close: number,
  high: number,
  low: number,
  pre_close: number,
  change: number,
  pct_chg: number,
  vol: number,
  amount: number,
  trade_date: string
}

interface ChartIndicatorParamSpec {
  key: string,
  label: string,
  type: string,
  default: unknown,
  description?: string,
  minimum?: number | null,
  maximum?: number | null,
  options?: unknown[],
}

interface ChartIndicatorSeriesSpec {
  key: string,
  label: string,
  plot_type: string,
  color?: string | null,
  overlay?: boolean,
  panel_index?: number,
}

interface ChartIndicatorSummary {
  id: string,
  name: string,
  description?: string,
  category?: string,
}

interface ChartIndicatorMeta extends ChartIndicatorSummary {
  required_columns: string[],
  params: ChartIndicatorParamSpec[],
  series: ChartIndicatorSeriesSpec[],
}

interface ChartLayoutIndicatorInstance {
  instance_id: string,
  indicator_id: string,
  name: string,
  category?: string,
  panel_index: number,
  params: Record<string, unknown>,
  series: ChartIndicatorSeriesSpec[],
}

interface ChartLayoutPanel {
  index: number,
  type: 'main' | 'sub' | string,
  locked: boolean,
  base: {
    candles: boolean,
    volume: boolean,
  },
  indicators: ChartLayoutIndicatorInstance[],
}

interface ChartLayout {
  version: number,
  panels: ChartLayoutPanel[],
}

interface UpdateChartIndicatorBody {
  params?: Record<string, unknown>,
  series?: ChartIndicatorSeriesSpec[],
  colors?: Record<string, string>,
  name?: string,
}

interface MoveChartPanelUpBody {
  panel_index: number,
}

interface MoveChartPanelDownBody {
  panel_index: number,
}

interface CalculateChartIndicatorBody {
  indicator_type: string,
  stock_code: string,
  adjust?: 'qfq' | 'hfq' | 'standard',
  params?: Record<string, unknown>,
}

interface ChartIndicatorCalculateResult {
  indicator_type: string,
  stock_code: string,
  data: Record<string, string | number | null>[],
}

interface StrategySummary {
  id: string,
  name: string,
  description?: string,
  category?: string,
}

interface StrategySignal {
  trade_date: string,
  strategy_id: string,
  label: string,
  color: string,
}

interface CalculateStrategyBuyPointsBody {
  stock_code: string,
  adjust?: 'qfq' | 'hfq' | 'standard',
  strategy_ids?: string[],
}

interface StrategyBuyPointsResult {
  stock_code: string,
  adjust: string,
  strategy_ids: string[],
  signals: StrategySignal[],
}

interface StockScreeningStrategy {
  name: string,
  strategy_ids: string[],
  created_at: string,
  updated_at: string,
}

interface StockScreeningResultStock extends Stock {
  flag: 1 | 2,
}

type StockScreeningFilterType = 'all' | 'focus' | 'normal'

interface RunStockScreeningResult {
  strategy_name: string,
  trade_date: string,
  strategy_ids: string[],
  scanned_count: number,
  matched_count: number,
  skipped_count: number,
  skipped: { symbol: string, reason: string }[],
  worker_count?: number,
  timings?: Record<string, number>,
}

interface StockScreeningTaskProgress {
  scanned_count: number,
  total_count: number,
  matched_count: number,
  skipped_count: number,
  timings?: Record<string, number>,
}

interface StockScreeningTask {
  task_id: string,
  status: 'running' | 'success' | 'failed',
  strategy_name: string,
  trade_date: string,
  progress: StockScreeningTaskProgress,
  result: RunStockScreeningResult | null,
  error: string,
  created_at: string,
  updated_at: string,
}

interface StockScreeningResults {
  strategy_name: string,
  trade_date: string,
  filter_type: StockScreeningFilterType,
  stocks: StockScreeningResultStock[],
}

interface Judge0SubmissionRequest {
  source_code: string,
  language_id: number,
  stdin?: string,
  [key: string]: unknown,
}

interface Judge0SubmissionResponse {
  token?: string,
  stdout?: string | null,
  stderr?: string | null,
  compile_output?: string | null,
  message?: string | null,
  time?: string | null,
  memory?: number | null,
  status?: {
    id?: number,
    description?: string,
  },
  [key: string]: unknown,
}

interface CreateCustomIndicatorRequest {
  source_code: string,
}

interface CustomIndicatorDefinition {
  basic_information: {
    name: string,
    short: string,
    description: string,
    chart_type: string,
  },
  parameters: {
    name: string,
    value: unknown,
    minimum: number | null,
    maximum: number | null,
  }[],
  series: {
    name: string,
    type: string,
    color: string,
  }[],
}

interface CreateCustomIndicatorResponse {
  ok: boolean,
  definition?: CustomIndicatorDefinition,
  error?: string,
  judge0?: Record<string, unknown>,
  indicator_id?: string,
  persisted?: boolean,
}

interface CustomIndicatorEditorTemplateResponse {
  source_code: string,
}

interface ParquetAllRowsResponse {
  rows: ParquetRow[],
}


export type {
  Account,
  OpenRecordVO,
  OpenRecord,
  OpenRecordResponse,
  Stock,
  StockGroup,
  StockSymbolSearchItem,
  ParquetColumn,
  ParquetPageResponse,
  ParquetStockItem,
  ParquetSourceItem,
  ParquetRow,
  ParquetAllRowsResponse,
  StockDailyData,
  ChartIndicatorParamSpec,
  ChartIndicatorSeriesSpec,
  ChartIndicatorSummary,
  ChartIndicatorMeta,
  ChartLayoutIndicatorInstance,
  ChartLayoutPanel,
  ChartLayout,
  UpdateChartIndicatorBody,
  MoveChartPanelUpBody,
  MoveChartPanelDownBody,
  CalculateChartIndicatorBody,
  ChartIndicatorCalculateResult,
  StrategySummary,
  StrategySignal,
  CalculateStrategyBuyPointsBody,
  StrategyBuyPointsResult,
  StockScreeningStrategy,
  StockScreeningResultStock,
  StockScreeningFilterType,
  RunStockScreeningResult,
  StockScreeningTaskProgress,
  StockScreeningTask,
  StockScreeningResults,
  Judge0SubmissionRequest,
  Judge0SubmissionResponse,
  CreateCustomIndicatorRequest,
  CustomIndicatorDefinition,
  CreateCustomIndicatorResponse,
  CustomIndicatorEditorTemplateResponse,
}