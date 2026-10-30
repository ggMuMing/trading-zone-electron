import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { useEffect, useState } from 'react'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function monthCells(year: number, month: number): Array<string | null> {
  const firstWeekday = new Date(year, month, 1).getDay()
  const leading = (firstWeekday + 6) % 7
  const count = new Date(year, month + 1, 0).getDate()
  const cells: Array<string | null> = []
  for (let index = 0; index < leading; index += 1) {
    cells.push(null)
  }
  for (let day = 1; day <= count; day += 1) {
    cells.push(`${year}-${pad(month + 1)}-${pad(day)}`)
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return cells
}

function parseIso(iso: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  if (!Number.isInteger(year) || month < 0 || month > 11) {
    return null
  }
  return { year, month }
}

interface MonthCalendarProps {
  value: string | null
  maxIso: string | null
  disabled?: boolean
  onChange: (isoDate: string) => void
}

export function MonthCalendar({
  value,
  maxIso,
  disabled = false,
  onChange
}: MonthCalendarProps): React.JSX.Element {
  const anchor = value ?? maxIso
  const parsed = anchor ? parseIso(anchor) : null
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return parsed ?? { year: now.getFullYear(), month: now.getMonth() }
  })
  const anchorKey = parsed ? `${parsed.year}-${parsed.month}` : ''

  useEffect(() => {
    if (!anchorKey) {
      return
    }
    const [yearText, monthText] = anchorKey.split('-')
    setCursor({ year: Number(yearText), month: Number(monthText) })
  }, [anchorKey])

  const cells = monthCells(cursor.year, cursor.month)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          size="small"
          aria-label="上个月"
          disabled={disabled}
          onClick={() => {
            const next = new Date(cursor.year, cursor.month - 1, 1)
            setCursor({ year: next.getFullYear(), month: next.getMonth() })
          }}
        >
          <ChevronLeft fontSize="small" />
        </IconButton>
        <Typography variant="body2">
          {cursor.year}年{cursor.month + 1}月
        </Typography>
        <IconButton
          size="small"
          aria-label="下个月"
          disabled={disabled}
          onClick={() => {
            const next = new Date(cursor.year, cursor.month + 1, 1)
            setCursor({ year: next.getFullYear(), month: next.getMonth() })
          }}
        >
          <ChevronRight fontSize="small" />
        </IconButton>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          mt: 0.5
        }}
      >
        {WEEKDAYS.map((label) => (
          <Typography
            key={label}
            variant="caption"
            color="text.secondary"
            sx={{ textAlign: 'center', lineHeight: '28px' }}
          >
            {label}
          </Typography>
        ))}
        {cells.map((iso, index) => {
          if (!iso) {
            return <Box key={`empty-${index}`} sx={{ height: 32 }} />
          }
          const pastCutoff = maxIso != null && iso > maxIso
          const selected = iso === value
          const blocked = disabled || pastCutoff
          return (
            <Box
              key={iso}
              component="button"
              type="button"
              disabled={blocked}
              aria-label={iso}
              aria-pressed={selected}
              onClick={() => onChange(iso)}
              sx={{
                height: 32,
                border: 0,
                borderRadius: 1,
                p: 0,
                font: 'inherit',
                fontSize: 13,
                cursor: blocked ? 'default' : 'pointer',
                color: blocked ? 'text.disabled' : selected ? 'primary.contrastText' : 'text.primary',
                bgcolor: selected ? 'primary.main' : 'transparent',
                '&:hover': {
                  bgcolor: blocked || selected ? undefined : 'action.hover'
                }
              }}
            >
              {Number(iso.slice(8, 10))}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
