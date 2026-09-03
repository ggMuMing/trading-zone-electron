import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { LineWidth, PlotStyleParams, ScriptParams } from '../../../../shared/types/chartLayout'
import type { IndicatorManifest, ParamField, PlotStyleField } from '../../../../shared/types/indicatorScript'

const LINE_WIDTHS: LineWidth[] = [1, 2, 3, 4]

function ColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" sx={{ minWidth: 96 }}>
        {label}
      </Typography>
      <input
        type="color"
        value={pickerValue}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: 36,
          height: 28,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer'
        }}
      />
      <TextField size="small" value={value} onChange={(event) => onChange(event.target.value)} sx={{ flex: 1 }} />
    </Stack>
  )
}

function LineWidthField({
  label,
  value,
  onChange
}: {
  label: string
  value: LineWidth
  onChange: (value: LineWidth) => void
}): React.JSX.Element {
  const selected = LINE_WIDTHS.includes(value) ? value : 1
  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={selected}
        onChange={(event) => onChange(Number(event.target.value) as LineWidth)}
      >
        {LINE_WIDTHS.map((width) => (
          <MenuItem key={width} value={width}>
            {width}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

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

function InputField({
  field,
  value,
  onChange
}: {
  field: ParamField
  value: ScriptParams
  onChange: (next: ScriptParams) => void
}): React.JSX.Element {
  if (field.widget === 'bool') {
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={inputBool(value, field.name)}
            onChange={(event) => onChange(setInput(value, field.name, event.target.checked))}
          />
        }
        label={field.title}
      />
    )
  }
  return (
    <TextField
      size="small"
      type="number"
      label={field.title}
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
  )
}

function PlotStyleSection({
  plot,
  value,
  onChange
}: {
  plot: PlotStyleField
  value: ScriptParams
  onChange: (next: ScriptParams) => void
}): React.JSX.Element {
  const style = value.styles[plot.id]
  if (plot.kind === 'histogram') {
    return (
      <Stack spacing={1}>
        <Typography variant="body2">{plot.title}</Typography>
        <ColorField
          label="涨色"
          value={styleColor(style, 'colorUp')}
          onChange={(colorUp) => onChange(setStyle(value, plot.id, { colorUp }))}
        />
        <ColorField
          label="跌色"
          value={styleColor(style, 'colorDown')}
          onChange={(colorDown) => onChange(setStyle(value, plot.id, { colorDown }))}
        />
      </Stack>
    )
  }
  return (
    <Stack spacing={1}>
      <Typography variant="body2">{plot.title}</Typography>
      <ColorField
        label="颜色"
        value={styleColor(style, 'color')}
        onChange={(color) => onChange(setStyle(value, plot.id, { color }))}
      />
      <LineWidthField
        label="线宽"
        value={styleWidth(style)}
        onChange={(lineWidth) => onChange(setStyle(value, plot.id, { lineWidth }))}
      />
    </Stack>
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
  if (manifest.fields.length === 0 && manifest.plots.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        没有可调参数
      </Typography>
    )
  }
  return (
    <Stack spacing={2}>
      {manifest.fields.length > 0 ? (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">参数</Typography>
          {manifest.fields.map((field) => (
            <InputField key={field.name} field={field} value={value} onChange={onChange} />
          ))}
        </Stack>
      ) : null}
      {manifest.plots.length > 0 ? (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">样式</Typography>
          {manifest.plots.map((plot) => (
            <PlotStyleSection key={plot.id} plot={plot} value={value} onChange={onChange} />
          ))}
        </Stack>
      ) : null}
    </Stack>
  )
}
