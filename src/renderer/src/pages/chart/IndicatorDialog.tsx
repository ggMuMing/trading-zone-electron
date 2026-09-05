import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  formatIndicatorCaption,
  scriptDisplayKey
} from '../../../../shared/chart/indicatorScript'
import type { ChartLayout, ChartLayoutItem } from '../../../../shared/types/chartLayout'
import type { IndicatorScript, ParamField } from '../../../../shared/types/indicatorScript'

export interface IndicatorDialogProps {
  open: boolean
  exampleSource: string
  layout: ChartLayout | null
  scripts: IndicatorScript[]
  disabled?: boolean
  onClose: () => void
  onAdd: (ref: string) => void
  onRemove: (id: string) => void
  onOpenSettings: (item: ChartLayoutItem) => void
  onCreateEditor: () => void
  onEditEditor: (script: IndicatorScript) => void
  onRemoveScript: (id: string) => void
}

function paramsSummary(item: ChartLayoutItem, fields: ParamField[]): string {
  const numeric = fields.filter((field) => field.widget === 'int' || field.widget === 'float')
  if (numeric.length === 0) {
    return '用户脚本'
  }
  return numeric
    .map((field) => `${field.title} ${String(item.params.inputs[field.name] ?? '')}`)
    .join(' · ')
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString()
}

export function IndicatorDialog({
  open,
  exampleSource,
  layout,
  scripts,
  disabled = false,
  onClose,
  onAdd,
  onRemove,
  onOpenSettings,
  onCreateEditor,
  onEditEditor,
  onRemoveScript
}: IndicatorDialogProps): React.JSX.Element {
  const titleOf = (item: ChartLayoutItem): string => {
    const script = scripts.find((entry) => entry.id === item.ref)
    if (!script) {
      return '用户脚本'
    }
    return formatIndicatorCaption(scriptDisplayKey(script), script.title)
  }
  const referencedScripts = new Set((layout?.items ?? []).map((item) => item.ref))

  const fieldsOf = (item: ChartLayoutItem): ParamField[] => {
    return scripts.find((script) => script.id === item.ref)?.manifest.fields ?? []
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>指标</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <div>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="subtitle2">用户脚本</Typography>
              <Button size="small" disabled={disabled || !exampleSource} onClick={onCreateEditor}>
                新建
              </Button>
            </Stack>
            {scripts.length > 0 ? (
              <List dense disablePadding>
                {scripts.map((script) => (
                  <ListItem
                    key={script.id}
                    disablePadding
                    secondaryAction={
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" disabled={disabled} onClick={() => onAdd(script.id)}>
                          添加
                        </Button>
                        <Button size="small" disabled={disabled} onClick={() => onEditEditor(script)}>
                          编辑
                        </Button>
                        <Button
                          size="small"
                          color="inherit"
                          disabled={disabled || referencedScripts.has(script.id)}
                          onClick={() => onRemoveScript(script.id)}
                        >
                          删除
                        </Button>
                      </Stack>
                    }
                    sx={{ pr: 26 }}
                  >
                    <ListItemText
                      primary={formatIndicatorCaption(scriptDisplayKey(script), script.title)}
                      secondary={formatUpdatedAt(script.updatedAt)}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                还没有用户脚本
              </Typography>
            )}
          </div>
          <div>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              当前布局
            </Typography>
            {layout && layout.items.length > 0 ? (
              <List dense disablePadding>
                {layout.items.map((item) => (
                  <ListItem
                    key={item.id}
                    disablePadding
                    secondaryAction={
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" disabled={disabled} onClick={() => onOpenSettings(item)}>
                          设置
                        </Button>
                        <Button
                          size="small"
                          color="inherit"
                          disabled={disabled}
                          onClick={() => onRemove(item.id)}
                        >
                          删除
                        </Button>
                      </Stack>
                    }
                    sx={{ pr: 18 }}
                  >
                    <ListItemText primary={titleOf(item)} secondary={paramsSummary(item, fieldsOf(item))} />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                未添加指标，仅显示 K 线与成交量
              </Typography>
            )}
          </div>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
}
