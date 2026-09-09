import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { DashboardBreadth, DashboardStatBlock } from '../../../../shared/types/dashboard'
import { BreadthHistogram } from './BreadthHistogram'
import { formatSignedYi, formatYi, signedColor } from './format'
import { ChangeBarChart, DualLineChart } from './StatCharts'

interface StatsPanelProps {
  margin: DashboardStatBlock
  turnover: DashboardStatBlock
  breadth: DashboardBreadth
}

export function StatsPanel({ margin, turnover, breadth }: StatsPanelProps): React.JSX.Element {
  return (
    <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto', pr: 0.5 }}>
      <StatBlock
        title="两融余额"
        unit="亿元"
        block={margin}
        hint="蓝线两融余额，橙线上证收盘"
        showClose
      />
      <StatBlock title="沪深京成交额" unit="亿元" block={turnover} />
      <BreadthBlock breadth={breadth} />
    </Box>
  )
}

function StatBlock({
  title,
  unit,
  block,
  hint,
  showClose = false
}: {
  title: string
  unit: string
  block: DashboardStatBlock
  hint?: string
  showClose?: boolean
}): React.JSX.Element {
  const changeColor = signedColor(block.change)
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ px: 0.5, mb: 0.5 }}>
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
      {hint ? (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
      <Box sx={{ height: 140, mb: 0.5 }}>
        <DualLineChart series={block.series} showClose={showClose} />
      </Box>
      <Box sx={{ height: 100 }}>
        <ChangeBarChart series={block.series} />
      </Box>
    </Box>
  )
}

function BreadthBlock({ breadth }: { breadth: DashboardBreadth }): React.JSX.Element {
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, px: 0.5, mb: 0.5 }}>
        涨跌家数
      </Typography>
      <Stack direction="row" spacing={2} sx={{ px: 0.5, mb: 1, flexWrap: 'wrap' }}>
        <Metric label="上涨" value={breadth.up_count} color="#ef5350" />
        <Metric label="涨停" value={breadth.limit_up_count} color="#ef5350" />
        <Metric label="下跌" value={breadth.down_count} color="#26a69a" />
        <Metric label="跌停" value={breadth.limit_down_count} color="#26a69a" />
      </Stack>
      <Box sx={{ height: 180 }}>
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
