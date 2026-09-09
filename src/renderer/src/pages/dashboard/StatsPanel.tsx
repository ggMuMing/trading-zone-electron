import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { DashboardBreadth, DashboardStatBlock } from '../../../../shared/types/dashboard'
import { BreadthHistogram } from './BreadthHistogram'
import { formatSignedYi, formatYi, signedColor } from './format'
import { AlignedStatChart, STAT_CLOSE_COLOR, STAT_VALUE_COLOR } from './StatCharts'

interface StatsPanelProps {
  margin: DashboardStatBlock
  turnover: DashboardStatBlock
  breadth: DashboardBreadth
}

export function StatsPanel({ margin, turnover, breadth }: StatsPanelProps): React.JSX.Element {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        pr: 0.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}
    >
      <Box sx={{ flex: 2, minHeight: 180, display: 'flex', flexDirection: 'column' }}>
        <StatBlock
          title="两融余额"
          unit="亿元"
          block={margin}
          legends={[
            { color: STAT_VALUE_COLOR, label: '两融余额' },
            { color: STAT_CLOSE_COLOR, label: '上证收盘' }
          ]}
          showClose
        />
      </Box>
      <Box sx={{ flex: 2, minHeight: 180, display: 'flex', flexDirection: 'column' }}>
        <StatBlock
          title="沪深京成交额"
          unit="亿元"
          block={turnover}
          legends={[{ color: STAT_VALUE_COLOR, label: '成交额' }]}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 160 }}>
        <BreadthBlock breadth={breadth} />
      </Box>
    </Box>
  )
}

function StatBlock({
  title,
  unit,
  block,
  legends,
  showClose = false
}: {
  title: string
  unit: string
  block: DashboardStatBlock
  legends: Array<{ color: string; label: string }>
  showClose?: boolean
}): React.JSX.Element {
  const changeColor = signedColor(block.change)
  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ px: 0.5, mb: 0.5, flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatYi(block.value)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {unit}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: changeColor, fontVariantNumeric: 'tabular-nums' }}
        >
          {formatSignedYi(block.change)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          较上一交易日
        </Typography>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <AlignedStatChart series={block.series} showClose={showClose} legends={legends} />
      </Box>
    </Box>
  )
}

function BreadthBlock({ breadth }: { breadth: DashboardBreadth }): React.JSX.Element {
  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, px: 0.5, mb: 0.5, flexShrink: 0 }}>
        涨跌家数
      </Typography>
      <Stack direction="row" spacing={2} sx={{ px: 0.5, mb: 1, flexWrap: 'wrap', flexShrink: 0 }}>
        <Metric label="上涨" value={breadth.up_count} color="#ef5350" />
        <Metric label="涨停" value={breadth.limit_up_count} color="#ef5350" />
        <Metric label="下跌" value={breadth.down_count} color="#26a69a" />
        <Metric label="跌停" value={breadth.limit_down_count} color="#26a69a" />
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <BreadthHistogram labels={breadth.labels} values={breadth.histogram} />
      </Box>
    </Box>
  )
}

function Metric({
  label,
  value,
  color
}: {
  label: string
  value: number
  color: string
}): React.JSX.Element {
  return (
    <Stack direction="row" spacing={0.75} alignItems="baseline">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Stack>
  )
}
