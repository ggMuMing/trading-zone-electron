import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { useEffect, useState } from 'react'
import {
  formatIndicatorCaption,
  normalizeParams,
  scriptDisplayKey
} from '../../../../shared/chart/indicatorScript'
import type { ChartLayoutItem, LayoutItemParams } from '../../../../shared/types/chartLayout'
import type { IndicatorScript } from '../../../../shared/types/indicatorScript'
import { ManifestFieldsForm } from './ManifestFieldsForm'

export interface IndicatorSettingsDialogProps {
  item: ChartLayoutItem | null
  scripts: IndicatorScript[]
  disabled?: boolean
  onClose: () => void
  onSave: (id: string, params: LayoutItemParams) => void
}

export function IndicatorSettingsDialog({
  item,
  scripts,
  disabled = false,
  onClose,
  onSave
}: IndicatorSettingsDialogProps): React.JSX.Element {
  const manifest = item ? (scripts.find((script) => script.id === item.ref)?.manifest ?? null) : null
  const [draft, setDraft] = useState<LayoutItemParams | null>(null)

  useEffect(() => {
    if (!item || !manifest) {
      setDraft(null)
      return
    }
    setDraft(normalizeParams(manifest, item.params))
  }, [item, manifest])

  const title = (() => {
    if (!item) {
      return ''
    }
    const script = scripts.find((entry) => entry.id === item.ref)
    if (!script) {
      return '用户脚本'
    }
    return formatIndicatorCaption(scriptDisplayKey(script), script.title)
  })()

  return (
    <Dialog open={Boolean(item && draft && manifest)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>设置 {title}</DialogTitle>
      <DialogContent dividers>
        {item && draft && manifest ? (
          <ManifestFieldsForm manifest={manifest} value={draft} onChange={setDraft} />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={disabled || !item || !draft}
          onClick={() => {
            if (item && draft) {
              onSave(item.id, draft)
            }
          }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}
