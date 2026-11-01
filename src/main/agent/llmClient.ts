import { getScriptAgentBaseUrl, getScriptAgentModel } from '../config/appConfig'
import { getScriptAgentApiKey } from '../config/scriptAgentSecret'
import { chatCompletionsUrl } from './chatUrl'
import type { LlmMessage } from './scriptAgentLoop'

const LLM_TIMEOUT_MS = 60_000

export class LlmRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmRequestError'
  }
}

export type { LlmMessage }

function clip(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) {
    return trimmed
  }
  return `${trimmed.slice(0, max)}…`
}

function isTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false
  }
  return err.name === 'TimeoutError' || err.name === 'AbortError' || /timeout/i.test(err.message)
}

function readContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return ''
  }
  const record = payload as { choices?: unknown; error?: { message?: unknown } }
  if (typeof record.error?.message === 'string' && record.error.message.trim()) {
    throw new LlmRequestError(clip(record.error.message, 300))
  }
  if (!Array.isArray(record.choices) || record.choices.length < 1) {
    return ''
  }
  const choice = record.choices[0]
  if (!choice || typeof choice !== 'object') {
    return ''
  }
  const content = (choice as { message?: { content?: unknown } }).message?.content
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part
      }
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text
      }
      return ''
    })
    .join('')
}

async function postChat(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
  })
}

export async function completeChat(messages: LlmMessage[]): Promise<string> {
  const baseUrl = getScriptAgentBaseUrl()
  const model = getScriptAgentModel()
  const apiKey = getScriptAgentApiKey()
  if (!baseUrl || !model || !apiKey) {
    throw new LlmRequestError('请先到配置页填写脚本助手的 Base URL、模型名和 API Key')
  }

  const url = chatCompletionsUrl(baseUrl)
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.2
  }

  try {
    let response = await postChat(url, apiKey, {
      ...body,
      response_format: { type: 'json_object' }
    })
    if (!response.ok && response.status === 400) {
      const text = await response.text()
      if (/response_format/i.test(text)) {
        response = await postChat(url, apiKey, body)
      } else {
        throw new LlmRequestError(`模型服务返回 ${response.status}：${clip(text, 300)}`)
      }
    }
    if (!response.ok) {
      const text = await response.text()
      throw new LlmRequestError(`模型服务返回 ${response.status}：${clip(text, 300)}`)
    }
    const raw = await response.text()
    let payload: unknown
    try {
      payload = JSON.parse(raw) as unknown
    } catch {
      throw new LlmRequestError('模型服务返回的不是 JSON')
    }
    const content = readContent(payload).trim()
    if (!content) {
      throw new LlmRequestError('模型没有返回内容')
    }
    return content
  } catch (err: unknown) {
    if (err instanceof LlmRequestError) {
      throw err
    }
    if (isTimeout(err)) {
      throw new LlmRequestError('模型请求超时')
    }
    throw new LlmRequestError('无法连接模型服务')
  }
}
