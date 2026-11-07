import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useState } from 'react'
import { DashboardQuotesPage } from './DashboardQuotesPage'
import { HeatmapPage } from './HeatmapPage'

export type DashboardRoute = 'quotes' | 'heatmap'

const ROUTES: Array<{ id: DashboardRoute; label: string }> = [
  { id: 'quotes', label: '行情数据' },
  { id: 'heatmap', label: '热力图' }
]

export function DashboardPage(): React.JSX.Element {
  const [route, setRoute] = useState<DashboardRoute>('quotes')

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Tabs
          value={route}
          onChange={(_event, value: DashboardRoute) => setRoute(value)}
          sx={{ minHeight: 40, px: 1 }}
        >
          {ROUTES.map((item) => (
            <Tab
              key={item.id}
              value={item.id}
              label={item.label}
              sx={{ minHeight: 40, py: 0, textTransform: 'none', fontWeight: 600 }}
            />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {route === 'quotes' ? <DashboardQuotesPage /> : <HeatmapPage />}
      </Box>
    </Box>
  )
}
