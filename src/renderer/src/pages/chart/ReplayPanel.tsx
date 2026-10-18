import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { todayYyyymmdd, yyyymmddToIso } from '../../../../shared/constants/market'

type StartTimeMode = 'random' | 'fixed'

const choiceLabelSx = {
  m: 0,
  '& .MuiFormControlLabel-label': { fontSize: 14 }
} as const

export interface ReplayStartRequest {
  mode: StartTimeMode
  isoDate: string
}

export interface ReplayConfigFormProps {
  canStart: boolean
  active: boolean
  onStart: (request: ReplayStartRequest) => void
}

export function ReplayConfigForm({
  canStart,
  active,
  onStart
}: ReplayConfigFormProps): React.JSX.Element {
  const [startTimeMode, setStartTimeMode] = useState<StartTimeMode>('random')
  const [fixedDate, setFixedDate] = useState(() => yyyymmddToIso(todayYyyymmdd()))
  const locked = active
  const startDisabled = locked || !canStart || (startTimeMode === 'fixed' && fixedDate.length === 0)

  return (
    <Stack spacing={1.25}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
          选择开始时间
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControlLabel
            sx={choiceLabelSx}
            disabled={locked}
            control={
              <Checkbox
                size="small"
                checked={startTimeMode === 'random'}
                onChange={() => setStartTimeMode('random')}
              />
            }
            label="随机时间"
          />
          <FormControlLabel
            sx={choiceLabelSx}
            disabled={locked}
            control={
              <Checkbox
                size="small"
                checked={startTimeMode === 'fixed'}
                onChange={() => setStartTimeMode('fixed')}
              />
            }
            label="固定时间"
          />
        </Stack>
        {startTimeMode === 'fixed' ? (
          <TextField
            size="small"
            fullWidth
            type="date"
            disabled={locked}
            value={fixedDate}
            onChange={(event) => setFixedDate(event.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { 'aria-label': '固定开始时间' }
            }}
            sx={{ mt: 0.75 }}
          />
        ) : null}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          variant="contained"
          disabled={startDisabled}
          onClick={() => onStart({ mode: startTimeMode, isoDate: fixedDate })}
        >
          开始
        </Button>
      </Box>
    </Stack>
  )
}
