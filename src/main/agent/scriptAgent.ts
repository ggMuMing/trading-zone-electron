import { applicationService } from '../services/applicationService'
import type { MarketQueryParams } from '../../shared/types/market'
import {
  scriptAgentSetupError,
  type ScriptAgentKind,
  type ScriptAgentProgress,
  type ScriptAgentTurnRequest,
  type ScriptAgentTurnResult
} from '../../shared/types/scriptAgent'
import { getScriptAgentApiKey } from '../config/scriptAgentSecret'
import { getScriptAgentBaseUrl, getScriptAgentModel } from '../config/appConfig'
import { buildDialectPrompt } from './dialect'
import { completeChat } from './llmClient'
import { runScriptAgentLoop, type AgentTryResult } from './scriptAgentLoop'

function missingConfigMessage(): string | null {
  return scriptAgentSetupError({
    baseUrl: getScriptAgentBaseUrl(),
    model: getScriptAgentModel(),
    hasApiKey: Boolean(getScriptAgentApiKey())
  })
}

async function tryGenerated(
  kind: ScriptAgentKind,
  source: string,
  query: MarketQueryParams | undefined
): Promise<AgentTryResult> {
  if (kind === 'indicator') {
    return applicationService.tryIndicatorScript(query ? { source, query } : { source })
  }
  return applicationService.tryStrategyScript(query ? { source, query } : { source })
}

export async function runScriptAgentTurn(
  request: ScriptAgentTurnRequest,
  onProgress?: (progress: ScriptAgentProgress) => void
): Promise<ScriptAgentTurnResult> {
  const missing = missingConfigMessage()
  if (missing) {
    return {
      ok: false,
      assistant: '',
      title: request.title,
      source: '',
      rounds: 0,
      tryResult: null,
      error: missing
    }
  }

  let systemPrompt = ''
  try {
    systemPrompt = buildDialectPrompt(request.kind)
  } catch (err: unknown) {
    return {
      ok: false,
      assistant: '',
      title: request.title,
      source: '',
      rounds: 0,
      tryResult: null,
      error: err instanceof Error ? err.message : String(err)
    }
  }

  return runScriptAgentLoop(
    {
      kind: request.kind,
      title: request.title,
      source: request.source,
      messages: request.messages,
      systemPrompt
    },
    {
      complete: completeChat,
      trySource: (source) => tryGenerated(request.kind, source, request.query),
      onProgress
    }
  )
}
