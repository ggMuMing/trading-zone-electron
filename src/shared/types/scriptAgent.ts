import type { ScriptTryResult } from './indicatorScript'
import type { MarketQueryParams } from './market'
import type { StrategyScriptTryResult } from './strategyScript'

export type ScriptAgentKind = 'indicator' | 'strategy'

export interface ScriptAgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ScriptAgentTurnRequest {
  kind: ScriptAgentKind
  title: string
  source: string
  messages: ScriptAgentMessage[]
  query?: MarketQueryParams
}

export interface ScriptAgentProgress {
  phase: 'generate' | 'repair'
  round: number
}

export interface ScriptAgentTurnResult {
  ok: boolean
  assistant: string
  title: string
  source: string
  rounds: number
  tryResult: ScriptTryResult | StrategyScriptTryResult | null
  error?: string
}

/** Public view. The API key stays in the main process. */
export interface ScriptAgentPublicConfig {
  baseUrl: string
  model: string
  hasApiKey: boolean
}

export interface ScriptAgentConfigInput {
  baseUrl: string
  model: string
  apiKey?: string
}

export function scriptAgentSetupError(config: {
  baseUrl: string
  model: string
  hasApiKey: boolean
}): string | null {
  if (!config.baseUrl.trim() || !config.model.trim() || !config.hasApiKey) {
    return '请先到配置页填写脚本助手的 Base URL、模型名和 API Key'
  }
  return null
}
