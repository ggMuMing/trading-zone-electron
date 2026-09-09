import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { UP_COLOR, DOWN_COLOR } from './format'

interface BreadthHistogramProps {
  labels: string[]
  values: number[]
}

export function BreadthHistogram({ labels, values }: BreadthHistogramProps): React.JSX.Element {
  const max = Math.max(1, ...values)
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0.75,
        height: '100%',
        minHeight: 120,
        px: 0.5,
        pt: 1
      }}
    >
      {labels.map((label, index) => {
        const value = values[index] ?? 0
        const ratio = value / max
        const upSide = index < 4
        const color = index === 4 ? '#9e9e9e' : upSide ? UP_COLOR : DOWN_COLOR
        return (
          <Box
            key={label}
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', mb: 0.5 }}>
              {value}
            </Typography>
            <Box sx={{ flex: 1, width: '70%', display: 'flex', alignItems: 'flex-end' }}>
              <Box
                sx={{
                  width: '100%',
                  height: `${Math.max(ratio * 100, value > 0 ? 4 : 0)}%`,
                  bgcolor: color,
                  borderRadius: '2px 2px 0 0'
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{
                mt: 0.5,
                fontSize: 10,
                color: 'text.secondary',
                textAlign: 'center',
                lineHeight: 1.2,
                whiteSpace: 'nowrap'
              }}
            >
              {label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
