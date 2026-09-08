import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import type { TabsProps } from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import { useEffect, useState, type ReactNode } from 'react'
import type { LineWidth, PlotStyleParams, ScriptParams } from '../../../../shared/types/chartLayout'
import type { IndicatorManifest, ParamField, PlotStyleField } from '../../../../shared/types/indicatorScript'
import { StylePalette } from './StylePalette'

const STYLE_COLUMNS = 'auto max-content auto'
const PARAM_COLUMNS = 'minmax(72px, auto) 1fr'
const STYLE_NAME_WIDTH = 40

type FormTab = 'params' | 'styles'

const TAB_PAD_X = 1.5

const SettingsTabsRoot = styled(Tabs)(({ theme }) => ({
  minHeight: 36,
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTabs-indicator': {
    display: 'flex',
    backgroundColor: 'transparent',
    height: 2
  },
  '& .MuiTabs-indicatorSpan': {
    flex: 1,
    backgroundColor: theme.palette.primary.main
  },
  '&[data-selected="params"] .MuiTabs-indicatorSpan': {
    marginLeft: 0,
    marginRight: theme.spacing(TAB_PAD_X)
  },
  '&[data-selected="styles"] .MuiTabs-indicatorSpan': {
    marginLeft: theme.spacing(TAB_PAD_X),
    marginRight: 0
  }
}))

function SettingsTabs(props: TabsProps): React.JSX.Element {
  return (
    <SettingsTabsRoot
      {...props}
      data-selected={props.value}
      slotProps={{
        ...props.slotProps,
        indicator: {
          children: <span className="MuiTabs-indicatorSpan" />
        }
      }}
    />
  )
}

const SettingsTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  minHeight: 36,
  minWidth: 0,
  paddingTop: theme.spacing(0.75),
  paddingBottom: theme.spacing(0.75),
  paddingLeft: theme.spacing(TAB_PAD_X),
  paddingRight: theme.spacing(TAB_PAD_X),
  fontWeight: theme.typography.fontWeightRegular,
  color: theme.palette.text.secondary,
  '&:hover': {
    color: theme.palette.primary.main,
    opacity: 1
  },
  '&.Mui-selected': {
    color: theme.palette.primary.main,
    fontWeight: theme.typography.fontWeightMedium
  },
  '&.Mui-focusVisible': {
    backgroundColor: theme.palette.action.focus
  },
  '&:first-of-type': {
    paddingLeft: 0
  },
  '&:last-of-type': {
    paddingRight: 0
  }
}))

function setInput(value: ScriptParams, name: string, next: number | boolean): ScriptParams {
  return { ...value, inputs: { ...value.inputs, [name]: next } }
}

function setStyle(value: ScriptParams, plotId: string, patch: PlotStyleParams): ScriptParams {
  return {
    ...value,
    styles: {
      ...value.styles,
      [plotId]: { ...value.styles[plotId], ...patch }
    }
  }
}

function inputNumber(value: ScriptParams, name: string): number {
  const raw = value.inputs[name]
  return typeof raw === 'number' ? raw : 0
}

function inputBool(value: ScriptParams, name: string): boolean {
  return value.inputs[name] === true
}

function styleColor(style: PlotStyleParams | undefined, key: 'color' | 'colorUp' | 'colorDown'): string {
  const raw = style?.[key]
  return typeof raw === 'string' ? raw : ''
}

function styleWidth(style: PlotStyleParams | undefined): LineWidth {
  const raw = style?.lineWidth
  return raw === 1 || raw === 2 || raw === 3 || raw === 4 ? raw : 1
}

function styleVisible(style: PlotStyleParams | undefined): boolean {
  return style?.visible !== false
}

function StyleGrid({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: STYLE_COLUMNS,
        width: 'max-content',
        maxWidth: '100%',
        columnGap: 2.5,
        rowGap: 0.75,
        alignItems: 'center'
      }}
    >
      {children}
    </Box>
  )
}

function StyleName({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <Typography
      variant="body2"
      noWrap
      title={typeof children === 'string' ? children : undefined}
      sx={{ width: STYLE_NAME_WIDTH, fontSize: 13 }}
    >
      {children}
    </Typography>
  )
}

function InputRow({
  field,
  value,
  onChange
}: {
  field: ParamField
  value: ScriptParams
  onChange: (next: ScriptParams) => void
}): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: PARAM_COLUMNS,
        columnGap: 1.5,
        alignItems: 'center'
      }}
    >
      <Typography variant="body2">{field.title}</Typography>
      {field.widget === 'bool' ? (
        <Checkbox
          size="small"
          checked={inputBool(value, field.name)}
          onChange={(event) => onChange(setInput(value, field.name, event.target.checked))}
          sx={{ justifySelf: 'start', p: 0.5 }}
        />
      ) : (
        <TextField
          size="small"
          type="number"
          value={inputNumber(value, field.name)}
          slotProps={{
            htmlInput: {
              min: field.min,
              max: field.max,
              step: field.widget === 'int' ? 1 : 'any'
            }
          }}
          onChange={(event) => onChange(setInput(value, field.name, Number(event.target.value)))}
        />
      )}
    </Box>
  )
}

function LineStyleRow({
  plot,
  value,
  onChange
}: {
  plot: PlotStyleField
  value: ScriptParams
  onChange: (next: ScriptParams) => void
}): React.JSX.Element {
  const style = value.styles[plot.id]
  return (
    <>
      <Checkbox
        size="small"
        checked={styleVisible(style)}
        onChange={(event) => onChange(setStyle(value, plot.id, { visible: event.target.checked }))}
        sx={{ p: 0.25 }}
      />
      <StyleName>{plot.title}</StyleName>
      <StylePalette
        color={styleColor(style, 'color')}
        lineWidth={styleWidth(style)}
        showWidth
        onChange={(next) => onChange(setStyle(value, plot.id, next))}
      />
    </>
  )
}

function HistogramStyleRows({
  plot,
  value,
  onChange
}: {
  plot: PlotStyleField
  value: ScriptParams
  onChange: (next: ScriptParams) => void
}): React.JSX.Element {
  const style = value.styles[plot.id]
  return (
    <>
      <Checkbox
        size="small"
        checked={styleVisible(style)}
        onChange={(event) => onChange(setStyle(value, plot.id, { visible: event.target.checked }))}
        sx={{ p: 0.25 }}
      />
      <StyleName>{plot.title}</StyleName>
      <span />
      <span />
      <StyleName>涨色</StyleName>
      <StylePalette
        color={styleColor(style, 'colorUp')}
        onChange={(next) => onChange(setStyle(value, plot.id, { colorUp: next.color }))}
      />
      <span />
      <StyleName>跌色</StyleName>
      <StylePalette
        color={styleColor(style, 'colorDown')}
        onChange={(next) => onChange(setStyle(value, plot.id, { colorDown: next.color }))}
      />
    </>
  )
}

export function ManifestFieldsForm({
  manifest,
  value,
  onChange
}: {
  manifest: IndicatorManifest
  value: ScriptParams
  onChange: (next: ScriptParams) => void
}): React.JSX.Element {
  const hasParams = manifest.fields.length > 0
  const hasStyles = manifest.plots.length > 0
  const [tab, setTab] = useState<FormTab>(hasParams ? 'params' : 'styles')

  useEffect(() => {
    setTab(hasParams ? 'params' : 'styles')
  }, [hasParams, hasStyles, manifest.key])

  if (!hasParams && !hasStyles) {
    return (
      <Typography variant="body2" color="text.secondary">
        没有可调参数
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <SettingsTabs
        value={tab}
        onChange={(_, next: FormTab) => setTab(next)}
        aria-label="指标设置分类"
      >
        <SettingsTab disableRipple value="params" label="参数" disabled={!hasParams} />
        <SettingsTab disableRipple value="styles" label="样式" disabled={!hasStyles} />
      </SettingsTabs>
      {tab === 'params' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {manifest.fields.map((field) => (
            <InputRow key={field.name} field={field} value={value} onChange={onChange} />
          ))}
        </Box>
      ) : (
        <StyleGrid>
          {manifest.plots.map((plot) =>
            plot.kind === 'histogram' ? (
              <HistogramStyleRows key={plot.id} plot={plot} value={value} onChange={onChange} />
            ) : (
              <LineStyleRow key={plot.id} plot={plot} value={value} onChange={onChange} />
            )
          )}
        </StyleGrid>
      )}
    </Box>
  )
}
