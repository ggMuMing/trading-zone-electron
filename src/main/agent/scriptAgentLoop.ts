import type { ScriptTryResult } from '../../shared/types/indicatorScript'
import type {
  ScriptAgentKind,
  ScriptAgentMessage,
  ScriptAgentProgress,
  ScriptAgentTurnResult
} from '../../shared/types/scriptAgent'
import type { StrategyScriptTryResult } from '../../shared/types/strategyScript'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const MAX_ROUNDS = 3
const MAX_SOURCE_BYTES = 32 * 1024
const MAX_USER_REQUEST_CHARS = 8000
const encoder = new TextEncoder()

export type AgentTryResult = ScriptTryResult | StrategyScriptTryResult

export interface ScriptAgentLoopInput {
  kind: ScriptAgentKind
  title: string
  source: string
  messages: ScriptAgentMessage[]
  systemPrompt: string
}

export interface ScriptAgentLoopDeps {
  complete: (messages: LlmMessage[]) => Promise<string>
  trySource: (source: string) => Promise<AgentTryResult>
  onProgress?: (progress: ScriptAgentProgress) => void
}

interface ParsedSource {
  assistant: string
  title: string
  source: string
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength
}

function clip(value: string, max: number): string {
  if (value.length <= max) {
    return value
  }
  return `${value.slice(0, max)}…`
}

function clipUtf8(value: string, maxBytes: number): { text: string; clipped: boolean } {
  if (byteLength(value) <= maxBytes) {
    return { text: value, clipped: false }
  }
  let low = 0
  let high = value.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (byteLength(value.slice(0, mid)) <= maxBytes) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return { text: value.slice(0, low), clipped: true }
}

function failed(partial: {
  assistant: string
  title: string
  rounds: number
  tryResult: AgentTryResult | null
  error: string
}): ScriptAgentTurnResult {
  return {
    ok: false,
    assistant: partial.assistant,
    title: partial.title,
    source: '',
    rounds: partial.rounds,
    tryResult: partial.tryResult,
    error: partial.error
  }
}

function readJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const candidates = [trimmed]
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    candidates.unshift(fence[1].trim())
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1))
  }
  let lastError = '模型输出不是 JSON'
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : lastError
    }
  }
  throw new Error(lastError)
}

function parseModelPayload(raw: string): { ok: true; value: ParsedSource } | { ok: false; error: string } {
  let payload: unknown
  try {
    payload = readJsonObject(raw)
  } catch {
    return { ok: false, error: '模型输出不是包含 assistant、title、source 的 JSON' }
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: '模型输出不是 JSON 对象' }
  }
  const record = payload as Record<string, unknown>
  const source = typeof record.source === 'string' ? record.source.trim() : ''
  if (!source) {
    return { ok: false, error: '模型输出缺少非空的 source' }
  }
  const assistant = typeof record.assistant === 'string' ? record.assistant.trim() : ''
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  return { ok: true, value: { assistant, title, source } }
}

function kindLabel(kind: ScriptAgentKind): string {
  return kind === 'indicator' ? '指标' : '策略'
}

function formatTurn(input: ScriptAgentLoopInput, request: string): string {
  const current = clipUtf8(input.source, MAX_SOURCE_BYTES)
  const lines = [
    `当前种类: ${kindLabel(input.kind)}`,
    `当前标题: ${input.title.trim() || '未命名'}`,
    '当前源码:',
    current.text || '(空)'
  ]
  if (current.clipped) {
    lines.push('(源码过长，以上为截断内容)')
  }
  lines.push('', '用户需求:', clip(request.trim(), MAX_USER_REQUEST_CHARS))
  return lines.join('\n')
}

function repairParsePrompt(error: string): string {
  return [
    error,
    '请只输出一个 JSON 对象，字段为 assistant、title、source。',
    '不要使用 Markdown 代码块，source 必须是完整源码。'
  ].join('\n')
}

function repairTryPrompt(result: AgentTryResult): string {
  const lines = ['试跑未通过。请修正完整源码，并仍只输出一个 JSON 对象。']
  if (result.error) {
    lines.push(`错误: ${result.error}`)
  }
  if (typeof result.line === 'number') {
    lines.push(`行: ${result.line}`)
  }
  if (typeof result.column === 'number') {
    lines.push(`列: ${result.column}`)
  }
  if (result.traceback) {
    lines.push(`详情:\n${clip(result.traceback, 1200)}`)
  }
  lines.push('字段为 assistant、title、source。不要使用 Markdown 代码块。')
  return lines.join('\n')
}

function isTerminalTryError(error: string | undefined): boolean {
  if (!error) {
    return false
  }
  return error.includes('没有K线') || error.includes('script produced no output')
}

function rememberText(messages: LlmMessage[], assistant: string, followUp: string): void {
  messages.push({ role: 'assistant', content: assistant })
  messages.push({ role: 'user', content: followUp })
}

function rememberParsed(messages: LlmMessage[], value: ParsedSource, followUp: string): void {
  rememberText(
    messages,
    JSON.stringify({
      assistant: value.assistant,
      title: value.title,
      source: value.source
    }),
    followUp
  )
}

export async function runScriptAgentLoop(
  input: ScriptAgentLoopInput,
  deps: ScriptAgentLoopDeps
): Promise<ScriptAgentTurnResult> {
  const latest = input.messages[input.messages.length - 1]
  if (!latest || latest.role !== 'user' || !latest.content.trim()) {
    return failed({
      assistant: '',
      title: input.title,
      rounds: 0,
      tryResult: null,
      error: '请输入要生成的脚本需求'
    })
  }

  const llmMessages: LlmMessage[] = [
    { role: 'system', content: input.systemPrompt },
    ...input.messages.slice(0, -1).slice(-6).map((message) => ({
      role: message.role,
      content: clip(message.content, 4000)
    })),
    { role: 'user', content: formatTurn(input, latest.content) }
  ]

  let lastAssistant = ''
  let lastTitle = input.title
  let lastTry: AgentTryResult | null = null
  let lastError = ''

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    deps.onProgress?.({ phase: round === 1 ? 'generate' : 'repair', round })
    let raw = ''
    try {
      raw = await deps.complete(llmMessages)
    } catch (err: unknown) {
      return failed({
        assistant: lastAssistant,
        title: lastTitle,
        rounds: round,
        tryResult: lastTry,
        error: err instanceof Error ? err.message : String(err)
      })
    }

    const parsed = parseModelPayload(raw)
    if (!parsed.ok) {
      lastError = parsed.error
      rememberText(llmMessages, clip(raw, 4000), repairParsePrompt(parsed.error))
      continue
    }

    lastAssistant = parsed.value.assistant
    lastTitle = parsed.value.title || input.title
    if (byteLength(parsed.value.source) > MAX_SOURCE_BYTES) {
      lastError = '生成的源码超过 32KB'
      rememberText(
        llmMessages,
        clip(parsed.value.assistant, 500),
        '源码超过 32KB。请缩短后仍只输出 JSON。'
      )
      continue
    }

    let tryResult: AgentTryResult
    try {
      tryResult = await deps.trySource(parsed.value.source)
    } catch (err: unknown) {
      return failed({
        assistant: lastAssistant,
        title: lastTitle,
        rounds: round,
        tryResult: lastTry,
        error: err instanceof Error ? err.message : String(err)
      })
    }
    lastTry = tryResult
    if (tryResult.ok) {
      return {
        ok: true,
        assistant: lastAssistant,
        title: lastTitle,
        source: parsed.value.source,
        rounds: round,
        tryResult
      }
    }

    lastError = tryResult.error || '脚本失败'
    if (isTerminalTryError(tryResult.error)) {
      return failed({
        assistant: lastAssistant,
        title: lastTitle,
        rounds: round,
        tryResult,
        error: lastError
      })
    }
    rememberParsed(llmMessages, parsed.value, repairTryPrompt(tryResult))
  }

  return failed({
    assistant: lastAssistant,
    title: lastTitle,
    rounds: MAX_ROUNDS,
    tryResult: lastTry,
    error: lastError || '试跑未通过'
  })
}
