import type { PipelineStepId } from '../constants/pipeline'

/** 步骤两问推出的三态，外加两个运行态。 */
export type PipelineStepStatus = 'not_started' | 'stale' | 'fresh' | 'running' | 'failed'

/** 只折叠必做步骤；4.1 等可选步不参与。 */
export type PipelineGlobalStatus = 'init' | 'stale' | 'fresh' | 'running'

export interface PipelineStepState {
  id: PipelineStepId
  required: boolean
  status: PipelineStepStatus
  initialized: boolean
  fresh: boolean
  coverage_start: string | null
  coverage_end: string | null
  detail: string | null
  error: string | null
}

export interface PipelineStatusResult {
  global: PipelineGlobalStatus
  last_closed_trade_date: string | null
  steps: PipelineStepState[]
  /** 打开页刷新交易日历失败时的降级提示；状态仍按本地日历给出。 */
  calendar_error: string | null
}

export interface PipelineRunStepOutcome {
  step_id: PipelineStepId
  ran: boolean
  message: string
  error: string | null
}

export interface PipelineRunResult {
  steps: PipelineRunStepOutcome[]
  ran_count: number
  skipped_count: number
  errors: Array<{ step_id: string; message: string }>
}
