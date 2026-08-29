import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { LineWidth, ScriptParams } from '../../../../shared/types/chartLayout'
import type { ParamField } from '../../../../shared/types/indicatorScript'

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

function setField(value: ScriptParams, name: string, next: number | string): ScriptParams {
  return { ...value, [name]: next }
}

function fieldNumber(value: ScriptParams, name: string): number {
  const raw = value[name]
  return typeof raw === 'number' ? raw : 0
}

function fieldString(value: ScriptParams, name: string): string {
  const raw = value[name]
  return typeof raw === 'string' ? raw : ''
}

export function ManifestFieldsForm({
  fields,
  value,
  onChange
}: {
  fields: ParamField[]
  value: ScriptParams
  onChange: (next: ScriptParams) => void
}): React.JSX.Element {
  if (fields.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        没有可调参数
      </Typography>
    )
  }
  return (
    <Stack spacing={1.5}>
      {fields.map((field) => {
        if (field.widget === 'color') {
          return (
            <ColorField
              key={field.name}
              label={field.title}
              value={fieldString(value, field.name)}
              onChange={(color) => onChange(setField(value, field.name, color))}
            />
          )
        }
        if (field.widget === 'lineWidth') {
          return (
            <LineWidthField
              key={field.name}
              label={field.title}
              value={fieldNumber(value, field.name) as LineWidth}
              onChange={(lineWidth) => onChange(setField(value, field.name, lineWidth))}
            />
          )
        }
        return (
          <TextField
            key={field.name}
            size="small"
            type="number"
            label={field.title}
            value={fieldNumber(value, field.name)}
            slotProps={{
              htmlInput: {
                min: field.min,
                max: field.max,
                step: field.widget === 'int' ? 1 : 'any'
              }
            }}
            onChange={(event) => onChange(setField(value, field.name, Number(event.target.value)))}
          />
        )
      })}
    </Stack>
  )
}
