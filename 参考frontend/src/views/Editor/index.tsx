import { Fragment, useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  Typography,
} from '@mui/material'
import Editor, { type OnChange, type OnMount, type Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditorNs } from 'monaco-editor'
import init, {
  Workspace,
  PositionEncoding,
  type Diagnostic,
} from '@astral-sh/ruff-wasm-web'
import ruffWasmUrl from '@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm?url'
import { createCustomIndicator, createJudge0Submission, getCustomIndicatorEditorTemplate, testCustomIndicatorRun } from '../../api/api'
import type {
  CreateCustomIndicatorResponse,
  CustomIndicatorDefinition,
  Judge0SubmissionResponse,
} from '../../api/apiType'

const RUFF_MARKER_OWNER = 'ruff'
const RUFF_DEBOUNCE_MS = 300
const PYTHON_LANGUAGE_ID = 71
const JUDGE_ACCEPTED_STATUS_ID = 3

const RUFF_SETTINGS = {
  'line-length': 100,
  lint: {
    select: ['E', 'F', 'W'],
  },
}

const ERROR_CODES = new Set(['F821', 'F811', 'F823'])

let workspacePromise: Promise<Workspace> | null = null

function getWorkspace(): Promise<Workspace> {
  if (!workspacePromise) {
    workspacePromise = init({ module_or_path: ruffWasmUrl }).then(
      () => new Workspace(RUFF_SETTINGS, PositionEncoding.Utf16),
    )
  }
  return workspacePromise
}

function toMarker(monaco: Monaco, d: Diagnostic): MonacoEditorNs.IMarkerData {
  const code = d.code ?? ''
  const isError = code.startsWith('E9') || ERROR_CODES.has(code)
  return {
    severity: isError
      ? monaco.MarkerSeverity.Error
      : monaco.MarkerSeverity.Warning,
    startLineNumber: d.start_location.row,
    startColumn: d.start_location.column,
    endLineNumber: d.end_location.row,
    endColumn: d.end_location.column,
    message: code ? `${code}: ${d.message}` : d.message,
    source: 'ruff',
  }
}

function isJudge0RunAccepted(result: Judge0SubmissionResponse | null): boolean {
  return result?.status?.id === JUDGE_ACCEPTED_STATUS_ID
}

function formatJudge0RunError(result: Judge0SubmissionResponse | null, fallback: string): string {
  if (!result) return fallback
  const parts = [result.stderr, result.compile_output, result.message].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0,
  )
  if (parts.length > 0) {
    return parts.join('\n')
  }
  const desc = result.status?.description
  return desc ? `执行未通过：${desc}` : fallback
}

type CreationKind = 'indicator' | 'strategy'

type OperationLogTextEntry = { id: string; kind: 'text'; text: string }
type OperationLogCreateSuccessEntry = {
  id: string
  kind: 'createSuccess'
  definition: CustomIndicatorDefinition
  indicatorId?: string
}
type OperationLogEntry = OperationLogTextEntry | OperationLogCreateSuccessEntry

const TEST_OK_TEXT = '测试成功'

let logEntrySeq = 0
function makeLogId(): string {
  logEntrySeq += 1
  return `log-${logEntrySeq}`
}

function stripTestSuccessEntries(entries: OperationLogEntry[]): OperationLogEntry[] {
  return entries.filter(
    (e) => !(e.kind === 'text' && e.text === TEST_OK_TEXT),
  )
}

const gridLabelCellSx = {
  color: 'text.secondary',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  textAlign: 'left' as const,
}
const gridValueCellSx = {
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  textAlign: 'left' as const,
  wordBreak: 'break-word' as const,
}

/** 指标创建成功块内统一：三列等宽 */
const successBlockThreeColGridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  columnGap: '10px',
  rowGap: '6px',
  alignItems: 'center',
} as const

function CreateSuccessLogBlock({
  definition,
  indicatorId,
}: {
  definition: CustomIndicatorDefinition
  indicatorId?: string
}) {
  const bi = definition.basic_information
  return (
    <Box
      sx={{
        width: '100%',
        textAlign: 'left',
        padding: '10px',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'action.hover',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'stretch',
      }}
    >
      <Typography variant="subtitle2" color="success.main" sx={{ textAlign: 'left' }}>指标创建成功</Typography>

      {indicatorId ? (
        <Box sx={successBlockThreeColGridSx}>
          <Box sx={gridLabelCellSx}>指标 ID</Box>
          <Box sx={gridValueCellSx}>{indicatorId}</Box>
          <Box sx={{ minWidth: 0 }} aria-hidden />
        </Box>
      ) : null}

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', marginBottom: '6px', textAlign: 'left' }}>
          基础信息
        </Typography>
        <Box sx={successBlockThreeColGridSx}>
          <Box sx={gridLabelCellSx}>名称</Box>
          <Box sx={gridValueCellSx}>{bi.name}</Box>
          <Box sx={{ minWidth: 0 }} aria-hidden />
          <Box sx={gridLabelCellSx}>简称</Box>
          <Box sx={gridValueCellSx}>{bi.short}</Box>
          <Box sx={{ minWidth: 0 }} aria-hidden />
          <Box sx={gridLabelCellSx}>描述</Box>
          <Box sx={gridValueCellSx}>{bi.description || '—'}</Box>
          <Box sx={{ minWidth: 0 }} aria-hidden />
          <Box sx={gridLabelCellSx}>图表区域</Box>
          <Box sx={gridValueCellSx}>{bi.chart_type}</Box>
          <Box sx={{ minWidth: 0 }} aria-hidden />
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', marginBottom: '6px', textAlign: 'left' }}>
          参数（{definition.parameters.length}）
        </Typography>
        <Box sx={successBlockThreeColGridSx}>
          <Box sx={{ ...gridLabelCellSx, fontWeight: 600 }}>名称</Box>
          <Box sx={{ ...gridLabelCellSx, fontWeight: 600 }}>默认值</Box>
          <Box sx={{ ...gridLabelCellSx, fontWeight: 600 }}>范围</Box>
          {definition.parameters.map((p) => (
            <Fragment key={p.name}>
              <Box sx={gridValueCellSx}>{p.name}</Box>
              <Box sx={gridValueCellSx}>{String(p.value)}</Box>
              <Box sx={gridValueCellSx}>
                {p.minimum ?? '—'} ~ {p.maximum ?? '—'}
              </Box>
            </Fragment>
          ))}
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', marginBottom: '6px', textAlign: 'left' }}>
          序列（{definition.series.length}）
        </Typography>
        <Box sx={successBlockThreeColGridSx}>
          <Box sx={{ ...gridLabelCellSx, fontWeight: 600 }}>名称</Box>
          <Box sx={{ ...gridLabelCellSx, fontWeight: 600 }}>类型</Box>
          <Box sx={{ ...gridLabelCellSx, fontWeight: 600 }}>颜色</Box>
          {definition.series.map((s) => (
            <Fragment key={s.name}>
              <Box sx={{ ...gridValueCellSx, fontWeight: 600 }}>{s.name}</Box>
              <Box sx={gridValueCellSx}>{s.type}</Box>
              <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0, justifyContent: 'flex-start' }}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '2px',
                    flexShrink: 0,
                    backgroundColor: s.color,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                  title={s.color}
                />
                <Box sx={{ ...gridValueCellSx, color: 'text.secondary', fontSize: '0.75rem' }}>{s.color}</Box>
              </Stack>
            </Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

export default function EditorView() {
  const editorRef = useRef<MonacoEditorNs.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const timerRef = useRef<number | null>(null)
  const [creationKind, setCreationKind] = useState<CreationKind>('indicator')
  const [templateLoading, setTemplateLoading] = useState(true)
  const [sourceCode, setSourceCode] = useState('')
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [operationLog, setOperationLog] = useState<OperationLogEntry[]>([])
  const [testPassed, setTestPassed] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const appendLogText = (lines: string | string[]) => {
    const texts = Array.isArray(lines) ? lines : [lines]
    setOperationLog((prev) => [
      ...prev,
      ...texts.map((text) => ({ id: makeLogId(), kind: 'text' as const, text })),
    ])
  }

  useEffect(() => {
    void getWorkspace()
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (creationKind !== 'indicator') {
      setTemplateLoading(false)
      return
    }
    let cancelled = false
    setTemplateLoading(true)
    ;(async () => {
      const code = await getCustomIndicatorEditorTemplate()
      if (cancelled) return
      if (code) {
        setSourceCode(code)
        setTestPassed(false)
      } else {
        setSourceCode('# 未能加载指标模板，请确认后端 /api/editor/custom-indicators/template 可用\n')
        setTestPassed(false)
        setOperationLog((prev) => [...prev, { id: makeLogId(), kind: 'text', text: '加载自定义指标模板失败。' }])
      }
      setTemplateLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [creationKind])

  const runRuff = async (value: string) => {
    const monaco = monacoRef.current
    const editor = editorRef.current
    if (!monaco || !editor) return
    const model = editor.getModel()
    if (!model) return
    try {
      const ws = await getWorkspace()
      const diagnostics = ws.check(value) as Diagnostic[]
      const markers = diagnostics.map((d) => toMarker(monaco, d))
      monaco.editor.setModelMarkers(model, RUFF_MARKER_OWNER, markers)
      setDiagnostics(diagnostics)
    } catch (err) {
      console.error('Ruff check failed:', err)
    }
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    void runRuff(editor.getValue())
  }

  const handleChange: OnChange = (value) => {
    if (value === undefined) return
    setSourceCode(value)
    setTestPassed(false)
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      void runRuff(value)
    }, RUFF_DEBOUNCE_MS)
  }

  const handleCreationKindChange = (event: SelectChangeEvent<CreationKind>) => {
    setCreationKind(event.target.value as CreationKind)
  }

  const handleRun = async () => {
    setOperationLog((prev) => stripTestSuccessEntries(prev))
    setIsRunning(true)
    const data =
      creationKind === 'indicator'
        ? await testCustomIndicatorRun({ source_code: sourceCode })
        : await createJudge0Submission({
          source_code: sourceCode,
          language_id: PYTHON_LANGUAGE_ID,
        })
    if (data && isJudge0RunAccepted(data)) {
      appendLogText(TEST_OK_TEXT)
      setTestPassed(true)
    } else if (data) {
      appendLogText(formatJudge0RunError(data, '代码测试未通过。'))
      setTestPassed(false)
    } else {
      appendLogText('代码测试失败，请检查后端或 Judge0 服务。')
      setTestPassed(false)
    }
    setIsRunning(false)
  }

  const formatCreateFailure = (data: CreateCustomIndicatorResponse): string => {
    if (data.error) return data.error
    const j = data.judge0 as Record<string, unknown> | undefined
    if (j) {
      const stderr = typeof j.stderr === 'string' ? j.stderr : ''
      const compile = typeof j.compile_output === 'string' ? j.compile_output : ''
      const merged = [stderr, compile].filter((x) => x.trim()).join('\n')
      if (merged) return merged
    }
    return '指标创建失败。'
  }

  const handleCreateCustomIndicator = async () => {
    if (!testPassed) return
    setIsCreating(true)
    const data = await createCustomIndicator({
      source_code: sourceCode,
    })
    if (data?.ok && data.definition) {
      const definition = data.definition
      const indicatorId = data.indicator_id
      setOperationLog((prev) => {
        const withoutOldCreate = prev.filter((e) => e.kind !== 'createSuccess')
        return [
          ...withoutOldCreate,
          {
            id: makeLogId(),
            kind: 'createSuccess' as const,
            definition,
            indicatorId,
          },
        ]
      })
    } else if (data) {
      appendLogText(formatCreateFailure(data))
    } else {
      appendLogText('指标创建失败，请检查后端或 Judge0 服务。')
    }
    setIsCreating(false)
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '16px',
      color: 'var(--c-texPri)',
      gap: '12px',
    }}>
      <Box sx={{ display: 'flex', gap: '12px', flexGrow: 1, minHeight: 0 }}>
        <Paper elevation={1} sx={{ flex: 1, overflow: 'hidden', background: 'var(--c-bacSec)', position: 'relative' }}>
          {templateLoading ? (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}>
              <CircularProgress />
            </Box>
          ) : (
            <Editor
              language='python'
              height="100%"
              theme='vs-dark'
              value={sourceCode}
              onMount={handleMount}
              onChange={handleChange}
            />
          )}
        </Paper>

        <Stack sx={{ width: '360px', minWidth: '280px', gap: '12px', alignItems: 'stretch' }}>
          <FormControl size="small" fullWidth>
            <InputLabel id="editor-creation-kind-label">创建内容</InputLabel>
            <Select<CreationKind>
              labelId="editor-creation-kind-label"
              label="创建内容"
              value={creationKind}
              onChange={handleCreationKindChange}
            >
              <MenuItem value="indicator">指标</MenuItem>
              <MenuItem value="strategy" disabled>策略（暂不支持）</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" gap="8px">
            <Button
              variant="contained"
              onClick={handleRun}
              disabled={isRunning || templateLoading}
              startIcon={isRunning ? <CircularProgress color="inherit" size={16} /> : null}
            >
              测试代码
            </Button>
            <Button
              variant="outlined"
              onClick={handleCreateCustomIndicator}
              disabled={
                !testPassed
                || isCreating
                || creationKind !== 'indicator'
                || templateLoading
              }
              startIcon={isCreating ? <CircularProgress color="inherit" size={16} /> : null}
            >
              创建指标
            </Button>
          </Stack>

          <Paper elevation={1} sx={{
            padding: '12px',
            background: 'var(--c-bacSec)',
            textAlign: 'left',
            width: '100%',
            boxSizing: 'border-box',
          }}
          >
            <Typography variant="subtitle2" sx={{ marginBottom: '8px', textAlign: 'left' }}>Ruff 检查</Typography>
            {diagnostics.length === 0 ? (
              <Typography variant="body2" color="success.main" sx={{ textAlign: 'left' }}>未发现问题</Typography>
            ) : (
              <Stack gap="6px" sx={{ alignItems: 'flex-start', width: '100%' }}>
                {diagnostics.map((item, index) => (
                  <Typography
                    key={`${item.code}-${index}`}
                    variant="body2"
                    color="warning.main"
                    sx={{ textAlign: 'left', width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {item.start_location.row}:{item.start_location.column} {item.code ? `${item.code}: ` : ''}{item.message}
                  </Typography>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper elevation={1} sx={{
            padding: '12px',
            flexGrow: 1,
            overflow: 'auto',
            background: 'var(--c-bacSec)',
            textAlign: 'left',
            width: '100%',
            boxSizing: 'border-box',
          }}
          >
            <Typography variant="subtitle2" sx={{ marginBottom: '8px', textAlign: 'left' }}>操作日志</Typography>
            {operationLog.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>暂无记录</Typography>
            ) : (
              <Stack gap="10px" sx={{ alignItems: 'flex-start', width: '100%' }}>
                {operationLog.map((entry) => {
                  if (entry.kind === 'createSuccess') {
                    return (
                      <CreateSuccessLogBlock
                        key={entry.id}
                        definition={entry.definition}
                        indicatorId={entry.indicatorId}
                      />
                    )
                  }
                  const isErrorLike = entry.text.includes('失败')
                    || entry.text.includes('未通过')
                    || entry.text.includes('错误')
                  return (
                    <Typography
                      key={entry.id}
                      variant="body2"
                      sx={{
                        textAlign: 'left',
                        width: '100%',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      color={
                        entry.text === TEST_OK_TEXT
                          ? 'success.main'
                          : isErrorLike
                            ? 'error.main'
                            : 'inherit'
                      }
                    >
                      {entry.text}
                    </Typography>
                  )
                })}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Box>
    </Box>
  )
}
