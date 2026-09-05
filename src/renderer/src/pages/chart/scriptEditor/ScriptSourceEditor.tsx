import './monacoSetup'
import Editor, { type OnMount } from '@monaco-editor/react'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import type { editor as MonacoEditor } from 'monaco-editor'
import type * as Monaco from 'monaco-editor'
import { useEffect, useRef } from 'react'

const MARKER_OWNER = 'script-try'

export interface ScriptEditorDiagnostic {
  line: number | null
  column: number | null
  message: string
}

export function ScriptSourceEditor({
  value,
  onChange,
  diagnostic,
  readOnly = false,
  sx
}: {
  value: string
  onChange: (value: string) => void
  diagnostic: ScriptEditorDiagnostic | null
  readOnly?: boolean
  sx?: SxProps<Theme>
}): React.JSX.Element {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    const monacoApi = monacoRef.current
    if (!editor || !monacoApi) {
      return
    }
    applyMarkers(editor, monacoApi, diagnostic)
  }, [diagnostic])

  const handleMount: OnMount = (editor, monacoApi) => {
    editorRef.current = editor
    monacoRef.current = monacoApi
    applyMarkers(editor, monacoApi, diagnostic)
  }

  return (
    <Box
      sx={[
        {
          height: 360,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden'
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
    >
      <Editor
        height="100%"
        language="python"
        theme="vs"
        value={value}
        onChange={(next) => onChange(next ?? '')}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          readOnly,
          wordWrap: 'on'
        }}
      />
    </Box>
  )
}

function applyMarkers(
  editor: MonacoEditor.IStandaloneCodeEditor,
  monacoApi: typeof Monaco,
  diagnostic: ScriptEditorDiagnostic | null
): void {
  const model = editor.getModel()
  if (!model) {
    return
  }
  if (!diagnostic || diagnostic.line == null || diagnostic.line < 1) {
    monacoApi.editor.setModelMarkers(model, MARKER_OWNER, [])
    return
  }
  const lineCount = model.getLineCount()
  const line = Math.min(diagnostic.line, lineCount)
  const maxColumn = model.getLineMaxColumn(line)
  const column =
    diagnostic.column != null && diagnostic.column > 0 ? Math.min(diagnostic.column, maxColumn) : 1
  monacoApi.editor.setModelMarkers(model, MARKER_OWNER, [
    {
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: maxColumn,
      message: diagnostic.message,
      severity: monacoApi.MarkerSeverity.Error
    }
  ])
}
