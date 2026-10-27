import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Add from '@mui/icons-material/Add'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import PlaylistAdd from '@mui/icons-material/PlaylistAdd'
import ShowChart from '@mui/icons-material/ShowChart'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import Timeline from '@mui/icons-material/Timeline'
import { useEffect, useState, type ReactNode } from 'react'
import { scriptDisplayKey } from '../../../../shared/chart/indicatorScript'
import type { ChartLayout } from '../../../../shared/types/chartLayout'
import type { IndicatorScript } from '../../../../shared/types/indicatorScript'
import type { StrategyInfo } from '../../../../shared/types/pythonProtocol'
import type { StrategyScript } from '../../../../shared/types/strategyScript'
import { strategyScriptStorageId } from '../../../../shared/types/strategyScript'
import { CHART_ICON_SX, ChartIconButton } from './ChartIconButton'

export interface IndicatorDialogProps {
  open: boolean
  exampleSource: string
  strategyExampleSource: string
  layout: ChartLayout | null
  scripts: IndicatorScript[]
  strategyScripts: StrategyScript[]
  strategyCatalogVersion?: number
  selectedStrategyId?: string | null
  disabled?: boolean
  strategyDisabled?: boolean
  onClose: () => void
  onAdd: (ref: string) => void
  onCreateEditor: () => void
  onCreateStrategy: () => void
  onEditEditor: (script: IndicatorScript) => void
  onEditStrategy: (script: StrategyScript) => void
  onRemoveScript: (id: string) => void
  onRemoveStrategy: (id: string) => void
  onSelectStrategy: (strategy: StrategyInfo) => void
}

type CatalogTab = 'indicator' | 'strategy'

const DIALOG_WIDTH = 600
const DIALOG_HEIGHT = 480
const NAV_WIDTH = 120

function EmptyCatalog({
  icon,
  message
}: {
  icon: ReactNode
  message: string
}): React.JSX.Element {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        color: 'text.secondary'
      }}
    >
      {icon}
      <Typography variant="body2">{message}</Typography>
    </Box>
  )
}

export function IndicatorDialog({
  open,
  exampleSource,
  strategyExampleSource,
  layout,
  scripts,
  strategyScripts,
  strategyCatalogVersion = 0,
  selectedStrategyId = null,
  disabled = false,
  strategyDisabled = false,
  onClose,
  onAdd,
  onCreateEditor,
  onCreateStrategy,
  onEditEditor,
  onEditStrategy,
  onRemoveScript,
  onRemoveStrategy,
  onSelectStrategy
}: IndicatorDialogProps): React.JSX.Element {
  const [tab, setTab] = useState<CatalogTab>('indicator')
  const [strategies, setStrategies] = useState<StrategyInfo[]>([])
  const [strategyError, setStrategyError] = useState<string | null>(null)
  const [strategyLoading, setStrategyLoading] = useState(false)
  const referencedScripts = new Set((layout?.items ?? []).map((item) => item.ref))

  useEffect(() => {
    if (!open || tab !== 'strategy') {
      return
    }
    let cancelled = false
    setStrategyLoading(true)
    setStrategyError(null)
    void window.api.strategy
      .list()
      .then((result) => {
        if (!cancelled) {
          setStrategies(result.strategies)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStrategyError(err instanceof Error ? err.message : String(err))
          setStrategies([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStrategyLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, tab, strategyCatalogVersion])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: DIALOG_WIDTH,
            height: DIALOG_HEIGHT,
            maxWidth: DIALOG_WIDTH,
            display: 'flex',
            flexDirection: 'column'
          }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 1.25, pr: 1 }}>
        <Typography component="span" sx={{ fontWeight: 700 }}>
          指标与策略
        </Typography>
        <ChartIconButton
          ariaLabel={tab === 'strategy' ? '新建策略' : '新建脚本'}
          title={tab === 'strategy' ? '新建策略' : '新建脚本'}
          roomy
          disabled={
            disabled ||
            (tab === 'strategy' ? strategyDisabled || !strategyExampleSource : !exampleSource)
          }
          onClick={tab === 'strategy' ? onCreateStrategy : onCreateEditor}
        >
          <Add sx={CHART_ICON_SX} />
        </ChartIconButton>
        <Box sx={{ flex: 1 }} />
        <ChartIconButton ariaLabel="关闭" title="关闭" roomy onClick={onClose}>
          <Close sx={CHART_ICON_SX} />
        </ChartIconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ p: 0, display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <Box
          sx={{
            width: NAV_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            py: 0.5
          }}
        >
          <List dense disablePadding>
            <ListItemButton selected={tab === 'indicator'} onClick={() => setTab('indicator')}>
              <ListItemText primary="指标" />
            </ListItemButton>
            <ListItemButton
              selected={tab === 'strategy'}
              disabled={strategyDisabled}
              onClick={() => setTab('strategy')}
            >
              <ListItemText primary="策略" />
            </ListItemButton>
          </List>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {tab === 'strategy' ? (
            strategyLoading ? (
              <EmptyCatalog
                icon={<Timeline sx={{ fontSize: 48, color: 'text.disabled' }} />}
                message="策略列表加载中..."
              />
            ) : strategyError ? (
              <EmptyCatalog
                icon={<Timeline sx={{ fontSize: 48, color: 'text.disabled' }} />}
                message={strategyError}
              />
            ) : strategies.length === 0 ? (
              <EmptyCatalog
                icon={<Timeline sx={{ fontSize: 48, color: 'text.disabled' }} />}
                message="还没有内置策略"
              />
            ) : (
              <List dense disablePadding>
                {strategies.map((strategy) => {
                  const selected = strategy.id === selectedStrategyId
                  const storageId = strategyScriptStorageId(strategy.id)
                  const script = storageId
                    ? strategyScripts.find((item) => item.id === storageId)
                    : undefined
                  return (
                    <ListItem
                      key={strategy.id}
                      disablePadding
                      secondaryAction={
                        <Stack direction="row" spacing={0.25}>
                          {script ? (
                            <>
                              <ChartIconButton
                                ariaLabel="编辑策略"
                                title="编辑策略"
                                roomy
                                disabled={disabled}
                                onClick={() => onEditStrategy(script)}
                              >
                                <EditOutlined sx={CHART_ICON_SX} />
                              </ChartIconButton>
                              <ChartIconButton
                                ariaLabel="删除策略"
                                title="删除策略"
                                roomy
                                disabled={disabled}
                                onClick={() => onRemoveStrategy(script.id)}
                              >
                                <DeleteOutline sx={CHART_ICON_SX} />
                              </ChartIconButton>
                            </>
                          ) : null}
                          <ChartIconButton
                            ariaLabel={selected ? '已选中策略' : selectedStrategyId ? '切换策略' : '添加策略'}
                            title={selected ? '已选中' : selectedStrategyId ? '切换' : '添加'}
                            roomy
                            disabled={disabled || strategyDisabled || selected}
                            onClick={() => {
                              onSelectStrategy(strategy)
                              onClose()
                            }}
                          >
                            {selected ? (
                              <Check sx={CHART_ICON_SX} />
                            ) : selectedStrategyId ? (
                              <SwapHoriz sx={CHART_ICON_SX} />
                            ) : (
                              <Add sx={CHART_ICON_SX} />
                            )}
                          </ChartIconButton>
                        </Stack>
                      }
                      sx={{
                        pr: script ? 14 : 6,
                        bgcolor: selected ? 'action.selected' : undefined,
                        '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' }
                      }}
                    >
                      <ListItemText primary={strategy.name} secondary={strategy.id} sx={{ px: 1.5, py: 0.5 }} />
                    </ListItem>
                  )
                })}
              </List>
            )
          ) : scripts.length === 0 ? (
            <EmptyCatalog
              icon={<ShowChart sx={{ fontSize: 48, color: 'text.disabled' }} />}
              message="还没有用户脚本"
            />
          ) : (
            <List dense disablePadding>
              {scripts.map((script) => (
                <ListItem
                  key={script.id}
                  disablePadding
                  secondaryAction={
                    <Stack direction="row" spacing={0.25}>
                      <ChartIconButton
                        ariaLabel="添加到图表"
                        title="添加到图表"
                        roomy
                        disabled={disabled}
                        onClick={() => onAdd(script.id)}
                      >
                        <PlaylistAdd sx={CHART_ICON_SX} />
                      </ChartIconButton>
                      <ChartIconButton
                        ariaLabel="编辑脚本"
                        title="编辑脚本"
                        roomy
                        disabled={disabled}
                        onClick={() => onEditEditor(script)}
                      >
                        <EditOutlined sx={CHART_ICON_SX} />
                      </ChartIconButton>
                      <ChartIconButton
                        ariaLabel="删除脚本"
                        title="删除脚本"
                        roomy
                        disabled={disabled || referencedScripts.has(script.id)}
                        onClick={() => onRemoveScript(script.id)}
                      >
                        <DeleteOutline sx={CHART_ICON_SX} />
                      </ChartIconButton>
                    </Stack>
                  }
                  sx={{
                    pr: 12,
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ListItemText
                    primary={script.title.trim() || '未命名'}
                    secondary={scriptDisplayKey(script) || '—'}
                    sx={{ px: 1.5, py: 0.5 }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
