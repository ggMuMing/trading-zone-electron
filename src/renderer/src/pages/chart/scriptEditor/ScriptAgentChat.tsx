import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloseIcon from '@mui/icons-material/Close'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import type { MarketQueryParams } from '../../../../../shared/types/market'
import {
  scriptAgentSetupError,
  type ScriptAgentKind,
  type ScriptAgentMessage,
  type ScriptAgentPublicConfig,
  type ScriptAgentTurnResult
} from '../../../../../shared/types/scriptAgent'

interface AgentCandidate {
  title: string
  source: string
}

function agentReady(config: ScriptAgentPublicConfig | null): boolean {
  return config != null && scriptAgentSetupError(config) == null
}

function passedText(result: ScriptAgentTurnResult): string {
  const trial = result.tryResult
  const stats =
    trial && 'buy_count' in trial && typeof trial.buy_count === 'number'
      ? `试跑通过，买入 ${trial.buy_count}，卖出 ${trial.sell_count ?? 0}，K 线 ${trial.bar_count ?? 0}，共 ${result.rounds} 轮`
      : `试跑通过，共 ${result.rounds} 轮`
  return result.assistant ? `${result.assistant}\n${stats}` : stats
}

const TEXT_FILE_WRAP_MAX = 8000

function readTextFile(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '')
    } catch {
      return new TextDecoder('gbk').decode(buffer)
    }
  })
}

function interpretRequest(fileName: string, content: string): string | null {
  const head = [
    '请解读下面的文本：说明它在描述什么规则，并生成对应的当前种类脚本。',
    '',
    `文件：${fileName}`,
    '',
    ''
  ].join('\n')
  if (head.length + content.length > TEXT_FILE_WRAP_MAX) {
    return null
  }
  return head + content
}

function failedText(result: ScriptAgentTurnResult): string {
  const detail = result.error || '生成失败'
  const line =
    result.tryResult && !result.tryResult.ok && typeof result.tryResult.line === 'number'
      ? `\n行 ${result.tryResult.line}`
      : ''
  if (result.assistant && result.assistant !== detail) {
    return `${result.assistant}\n${detail}${line}`
  }
  return `${detail}${line}`
}

export function ScriptAgentChat({
  draft,
  tryQuery,
  disabled = false,
  onApply
}: {
  draft: {
    id: string | null
    kind: ScriptAgentKind
    title: string
    source: string
  }
  tryQuery: MarketQueryParams | null
  disabled?: boolean
  onApply: (patch: { title: string; source: string }) => void
}): React.JSX.Element {
  const sessionRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [config, setConfig] = useState<ScriptAgentPublicConfig | null>(null)
  const [messages, setMessages] = useState<ScriptAgentMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [candidate, setCandidate] = useState<AgentCandidate | null>(null)
  const [open, setOpen] = useState(false)
  const ready = agentReady(config)
  const unavailableHint = config
    ? (scriptAgentSetupError(config) ?? '')
    : '正在读取脚本助手配置…'

  useEffect(() => {
    sessionRef.current += 1
    setMessages([])
    setCandidate(null)
    setInput('')
    setBusy(false)
    setStatusText(null)
    setOpen(false)
    let cancelled = false
    void window.api.config
      .getScriptAgent()
      .then((next) => {
        if (!cancelled) {
          setConfig(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfig({ baseUrl: '', model: '', hasApiKey: false })
        }
      })
    return () => {
      cancelled = true
    }
  }, [draft.id, draft.kind])

  useEffect(() => {
    const node = listRef.current
    if (!node) {
      return
    }
    node.scrollTop = node.scrollHeight
  }, [messages, candidate, statusText])

  const noteLocal = (content: string): void => {
    setMessages((current) => [...current, { role: 'assistant', content }])
  }

  const submit = async (text: string): Promise<void> => {
    const body = text.trim()
    if (!body || busy || disabled || !ready) {
      return
    }
    const token = sessionRef.current
    const nextMessages: ScriptAgentMessage[] = [...messages, { role: 'user', content: body }]
    setMessages(nextMessages)
    setInput('')
    setCandidate(null)
    setBusy(true)
    setStatusText('正在生成')
    const stop = window.api.scriptAgent.onProgress((progress) => {
      if (sessionRef.current !== token) {
        return
      }
      setStatusText(
        progress.phase === 'repair' ? `正在按试跑结果修改（第 ${progress.round} 轮）` : '正在生成'
      )
    })
    try {
      const latest = await window.api.config.getScriptAgent()
      if (sessionRef.current !== token) {
        return
      }
      setConfig(latest)
      if (!agentReady(latest)) {
        noteLocal('请先到配置页填写脚本助手的 Base URL、模型名和 API Key')
        return
      }
      const result = await window.api.scriptAgent.turn({
        kind: draft.kind,
        title: draft.title,
        source: draft.source,
        messages: nextMessages,
        ...(tryQuery ? { query: tryQuery } : {})
      })
      if (sessionRef.current !== token) {
        return
      }
      if (result.ok && result.source) {
        setMessages((current) => [...current, { role: 'assistant', content: passedText(result) }])
        setCandidate({ title: result.title, source: result.source })
        return
      }
      setCandidate(null)
      setMessages((current) => [...current, { role: 'assistant', content: failedText(result) }])
    } catch (err: unknown) {
      if (sessionRef.current !== token) {
        return
      }
      setCandidate(null)
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: err instanceof Error ? err.message : String(err) }
      ])
    } finally {
      stop()
      if (sessionRef.current === token) {
        setBusy(false)
        setStatusText(null)
      }
    }
  }

  const handleSend = (): void => {
    void submit(input)
  }

  const handleUpload = async (file: File | undefined): Promise<void> => {
    if (fileRef.current) {
      fileRef.current.value = ''
    }
    if (!file || busy || disabled || !ready) {
      return
    }
    if (!file.name.toLowerCase().endsWith('.txt')) {
      noteLocal('请上传 txt 文本文件。')
      return
    }
    let content = ''
    try {
      content = (await readTextFile(file)).trim()
    } catch {
      noteLocal('无法读取该 txt 文件。')
      return
    }
    if (!content) {
      noteLocal('txt 文件是空的。')
      return
    }
    const message = interpretRequest(file.name, content)
    if (!message) {
      noteLocal('txt 过长，连同解读说明不能超过 8000 字。')
      return
    }
    await submit(message)
  }

  const handleApply = (): void => {
    if (!candidate) {
      return
    }
    onApply({ title: candidate.title, source: candidate.source })
    setCandidate(null)
    setMessages((current) => [
      ...current,
      { role: 'assistant', content: '已写入编辑器草稿，尚未发布。' }
    ])
  }

  return (
    <>
      <Collapse in={open} timeout={180}>
        <Box
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            height: 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            bgcolor: 'background.paper'
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, pt: 0.5 }}>
            <Typography variant="caption" sx={{ pl: 0.5 }}>
              脚本助手
            </Typography>
            <IconButton aria-label="收起脚本助手" size="small" onClick={() => setOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box ref={listRef} sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.5, py: 0.5 }}>
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {ready
              ? '描述想要的指标或策略，或上传 txt 让助手解读。试跑通过后，再应用到当前草稿。'
              : config
                ? scriptAgentSetupError({
                    baseUrl: config.baseUrl,
                    model: config.model,
                    hasApiKey: config.hasApiKey
                  })
                : '正在读取脚本助手配置…'}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {messages.map((message, index) => (
              <Box key={`${message.role}-${index}`}>
                <Typography variant="caption" color="text.secondary">
                  {message.role === 'user' ? '你' : '助手'}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
        {candidate ? (
          <Box sx={{ mt: 1 }}>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1,
                maxHeight: 72,
                overflow: 'auto',
                fontSize: 11,
                fontFamily: 'monospace',
                bgcolor: 'action.hover',
                borderRadius: 1
              }}
            >
              {candidate.source}
            </Box>
            <Button
              size="small"
              variant="contained"
              sx={{ mt: 1 }}
              disabled={disabled}
              onClick={handleApply}
            >
              应用到编辑器
            </Button>
          </Box>
        ) : null}
      </Box>
      {statusText ? (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }} aria-live="polite">
          {statusText}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ p: 1, pt: 0.5 }} alignItems="flex-end">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          hidden
          onChange={(event) => {
            void handleUpload(event.target.files?.[0])
          }}
        />
        <Tooltip title="上传 txt 并解读">
          <span>
            <IconButton
              size="small"
              aria-label="上传 txt 并解读"
              disabled={disabled || busy || !ready}
              onClick={() => fileRef.current?.click()}
            >
              <UploadFileIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={3}
          placeholder={ready ? '例如：副图 RSI，周期可调' : '请先到配置页填写脚本助手'}
          value={input}
          disabled={disabled || busy || !ready}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />
        <Button
          size="small"
          variant="outlined"
          disabled={disabled || busy || !ready || !input.trim()}
          onClick={() => void handleSend()}
        >
          发送
        </Button>
      </Stack>
        </Box>
      </Collapse>
      {open ? null : (
        <Tooltip title={unavailableHint} placement="top" disableHoverListener={ready}>
          <Box
            component="span"
            sx={{ position: 'absolute', right: 12, bottom: 12, zIndex: 3, display: 'inline-flex' }}
          >
            <IconButton
              size="small"
              aria-label="脚本助手"
              disabled={!ready}
              onClick={() => setOpen(true)}
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                boxShadow: 2
              }}
            >
              <AutoAwesomeIcon fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
      )}
    </>
  )
}
