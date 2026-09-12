import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState } from 'react'
import {
  DASHBOARD_BREADTH_UNIVERSE_ALL,
  DASHBOARD_DEFAULT_TS_CODE,
  type DashboardBreadthUniverseId
} from '../../../../shared/constants/dashboard'
import type { DashboardBar, DashboardQueryResult } from '../../../../shared/types/dashboard'
import { DashboardSplit } from './DashboardSplit'
import { yyyymmddToChartTime } from './format'
import { IndexListPanel } from './IndexListPanel'
import { MiniKline } from './MiniKline'
import { StatsPanel } from './StatsPanel'

const DEFAULT_LEFT_RATIO = 0.5
const DEFAULT_TOP_RATIO = 0.5

export function DashboardPage(): React.JSX.Element {
  const [selected, setSelected] = useState(DASHBOARD_DEFAULT_TS_CODE)
  const [breadthUniverse, setBreadthUniverse] = useState<DashboardBreadthUniverseId>(
    DASHBOARD_BREADTH_UNIVERSE_ALL
  )
  const [data, setData] = useState<DashboardQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [breadthRefreshing, setBreadthRefreshing] = useState(false)
  const [leftRatio, setLeftRatio] = useState(DEFAULT_LEFT_RATIO)
  const [topRatio, setTopRatio] = useState(DEFAULT_TOP_RATIO)

  const load = useCallback(
    async (
      tsCode: string,
      universe: DashboardBreadthUniverseId,
      options?: { breadthOnly?: boolean }
    ) => {
      if (options?.breadthOnly) {
        setBreadthRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        const result = await window.api.dashboard.query({
          ts_code: tsCode,
          breadth_universe: universe
        })
        setData(result)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (options?.breadthOnly) {
          setBreadthRefreshing(false)
        } else {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    void load(selected, breadthUniverse)
  }, [load, selected])

  const handleBreadthUniverseChange = useCallback(
    (universe: DashboardBreadthUniverseId) => {
      setBreadthUniverse(universe)
      void load(selected, universe, { breadthOnly: true })
    },
    [load, selected]
  )

  const selectedName =
    data?.indices.find((item) => item.ts_code === selected)?.name ?? selected
  const asOfDate = formatCutoffDate(data?.bars ?? [], data?.as_of, data?.indices.find((item) => item.ts_code === selected)?.trade_date)

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        minHeight: 0,
        p: 1.5,
        display: 'flex'
      }}
    >
      <DashboardSplit
        leftRatio={leftRatio}
        topRatio={topRatio}
        onLeftRatioChange={setLeftRatio}
        onTopRatioChange={setTopRatio}
        top={
          <Pane title={`${selectedName} 日K`} extra={asOfDate}>
            <MiniKline bars={data?.bars ?? []} />
          </Pane>
        }
        bottom={
          <Pane title="指数">
            {error ? <Alert severity="error">{error}</Alert> : null}
            {!error && !loading && (data?.indices.length ?? 0) === 0 ? (
              <Empty text="尚未同步看板数据，请到配置页更新数据" />
            ) : (
              <IndexListPanel
                indices={data?.indices ?? []}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </Pane>
        }
        right={
          <Pane title="统计">
            <StatsPanel
              margin={data?.margin ?? emptyBlock}
              turnover={data?.turnover ?? emptyBlock}
              breadth={
                data?.breadth ?? {
                  trade_date: null,
                  up_count: 0,
                  limit_up_count: 0,
                  down_count: 0,
                  limit_down_count: 0,
                  flat_count: 0,
                  histogram: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                  labels: [],
                  series: [],
                  universe: breadthUniverse,
                  constituent_as_of: null
                }
              }
              basis={data?.basis ?? []}
              breadthUniverse={breadthUniverse}
              onBreadthUniverseChange={handleBreadthUniverseChange}
              breadthRefreshing={breadthRefreshing}
            />
          </Pane>
        }
      />
    </Box>
  )
}

const emptyBlock = {
  trade_date: null,
  value: null,
  change: null,
  series: []
}

function formatCutoffDate(
  bars: DashboardBar[],
  asOf: string | null | undefined,
  selectedTradeDate: string | null | undefined
): string | null {
  const lastBar = [...bars].reverse().find((bar) => Boolean(bar.trade_date))
  const raw = lastBar?.trade_date ?? asOf ?? selectedTradeDate ?? null
  if (!raw) {
    return null
  }
  return yyyymmddToChartTime(raw)
}

function Pane({
  title,
  extra,
  children
}: {
  title: string
  extra?: string | null
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {title ? (
        <Box
          sx={{
            px: 1.5,
            pt: 1,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {extra ? (
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              截至 {extra}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0, p: 1 }}>{children}</Box>
    </Paper>
  )
}

function Empty({ text }: { text: string }): React.JSX.Element {
  if (!text) {
    return <Box sx={{ height: '100%' }} />
  }
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.secondary'
      }}
    >
      <Typography variant="body2">{text}</Typography>
    </Box>
  )
}
