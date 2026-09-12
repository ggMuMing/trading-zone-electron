import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  DASHBOARD_BREADTH_UNIVERSE_ALL,
  DASHBOARD_BREADTH_UNIVERSE_OPTIONS,
  type DashboardBreadthUniverseId
} from '../../../../shared/constants/dashboard'
import type {
  DashboardBasisProduct,
  DashboardBreadth,
  DashboardStatBlock
} from '../../../../shared/types/dashboard'
import { BasisGrid } from './BasisGrid'
import { BreadthHistogram } from './BreadthHistogram'
import { BreadthHistoryChart } from './BreadthHistoryChart'
import { formatSignedYi, formatYi, signedColor } from './format'
import { AlignedStatChart, STAT_CLOSE_COLOR, STAT_VALUE_COLOR } from './StatCharts'

interface StatsPanelProps {
  margin: DashboardStatBlock
  turnover: DashboardStatBlock
  breadth: DashboardBreadth
  basis: DashboardBasisProduct[]
  breadthUniverse: DashboardBreadthUniverseId
  onBreadthUniverseChange: (universe: DashboardBreadthUniverseId) => void
  breadthRefreshing?: boolean
}

export function StatsPanel({
  margin,
  turnover,
  breadth,
  basis,
  breadthUniverse,
  onBreadthUniverseChange,
  breadthRefreshing = false
}: StatsPanelProps): React.JSX.Element {
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
      <Box sx={{ flex: 2, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
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
      <Box sx={{ flex: 2, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
        <StatBlock
          title="沪深京成交额"
          unit="亿元"
          block={turnover}
          legends={[{ color: STAT_VALUE_COLOR, label: '成交额' }]}
        />
      </Box>
      <Box sx={{ flex: 2, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
        <BreadthBlock
          breadth={breadth}
          breadthUniverse={breadthUniverse}
          onBreadthUniverseChange={onBreadthUniverseChange}
          refreshing={breadthRefreshing}
        />
      </Box>
      <Box sx={{ flexShrink: 0, minHeight: 1480, display: 'flex', flexDirection: 'column', marginTop: 5 }}>
        <BasisGrid products={basis} />
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

function BreadthBlock({
  breadth,
  breadthUniverse,
  onBreadthUniverseChange,
  refreshing
}: {
  breadth: DashboardBreadth
  breadthUniverse: DashboardBreadthUniverseId
  onBreadthUniverseChange: (universe: DashboardBreadthUniverseId) => void
  refreshing: boolean
}): React.JSX.Element {
  const constituentsEmpty =
    !refreshing &&
    breadthUniverse !== DASHBOARD_BREADTH_UNIVERSE_ALL &&
    breadth.universe === breadthUniverse &&
    breadth.constituent_as_of == null

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        opacity: refreshing ? 0.6 : 1,
        transition: 'opacity 0.15s ease'
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ px: 0.5, mb: 0.5, flexShrink: 0 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          涨跌家数
        </Typography>
        <FormControl size="small" sx={{ width: 88 }}>
          <Select
            value={breadthUniverse}
            onChange={(event) =>
              onBreadthUniverseChange(event.target.value as DashboardBreadthUniverseId)
            }
            variant="outlined"
            sx={{
              fontSize: '0.75rem',
              '& .MuiSelect-select': { py: 0.25, px: 0.75, pr: '22px !important' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
              '& .MuiSvgIcon-root': { right: 2, fontSize: 16 }
            }}
          >
            {DASHBOARD_BREADTH_UNIVERSE_OPTIONS.map((option) => (
              <MenuItem key={option.id} value={option.id} dense>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {constituentsEmpty ? (
        <Alert severity="info" sx={{ mx: 0.5, mb: 1, py: 0, flexShrink: 0 }}>
          尚无成分股数据，请到配置页更新成分股
        </Alert>
      ) : null}
      <Stack direction="row" spacing={2} sx={{ px: 0.5, mb: 1, flexWrap: 'wrap', flexShrink: 0 }}>
        <Metric label="上涨" value={breadth.up_count} color="#ef5350" />
        <Metric label="涨停" value={breadth.limit_up_count} color="#ef5350" />
        <Metric label="下跌" value={breadth.down_count} color="#26a69a" />
        <Metric label="跌停" value={breadth.limit_down_count} color="#26a69a" />
      </Stack>
      <Box sx={{ flex: 1, minHeight: 160 }}>
        <BreadthHistogram labels={breadth.labels} values={breadth.histogram} />
      </Box>
      <Box sx={{ flex: 1.4, minHeight: 260, mt: 1 }}>
        <BreadthHistoryChart series={breadth.series ?? []} />
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
