import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState } from 'react'
import { DASHBOARD_DEFAULT_TS_CODE } from '../../../../shared/constants/dashboard'
import type { DashboardQueryResult } from '../../../../shared/types/dashboard'
import { IndexListPanel } from './IndexListPanel'
import { MiniKline } from './MiniKline'
import { StatsPanel } from './StatsPanel'

export function DashboardPage(): React.JSX.Element {
  const [selected, setSelected] = useState(DASHBOARD_DEFAULT_TS_CODE)
  const [data, setData] = useState<DashboardQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (tsCode: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.dashboard.query({ ts_code: tsCode })
      setData(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(selected)
  }, [load, selected])

  const selectedName =
    data?.indices.find((item) => item.ts_code === selected)?.name ?? selected

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        minHeight: 0,
        p: 1.5,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 1.5
      }}
    >
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
      <Pane title={`${selectedName} 日K`}>
        <MiniKline bars={data?.bars ?? []} />
      </Pane>
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
              labels: []
            }
          }
        />
      </Pane>
      <Pane title="">
        <Empty text="" />
      </Pane>
    </Box>
  )
}

const emptyBlock = {
  trade_date: null,
  value: null,
  change: null,
  series: []
}

function Pane({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <Paper
      elevation={0}
      sx={{
        minHeight: 0,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {title ? (
        <Typography variant="subtitle2" sx={{ px: 1.5, pt: 1, fontWeight: 700 }}>
          {title}
        </Typography>
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
