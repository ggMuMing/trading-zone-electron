export type ScreenSide = 'buy' | 'sell'

export interface StrategyScreenParams {
  strategy_id: string
  ts_codes: string[]
  signal_date: string
  adjust?: 'none' | 'qfq' | 'hfq'
}

export interface StrategyScreenHit {
  ts_code: string
  side: ScreenSide
}

export interface StrategyScreenResult {
  signal_date: string
  hits: StrategyScreenHit[]
}
