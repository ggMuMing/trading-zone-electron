import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import SettingsIcon from '@mui/icons-material/Settings'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import type { ReactNode } from 'react'

export type AppPage = 'settings' | 'market'

interface AppShellProps {
  page: AppPage
  onPageChange: (page: AppPage) => void
  navigationLocked?: boolean
  navigationLockHint?: string
  children: ReactNode
}

export function AppShell({
  page,
  onPageChange,
  navigationLocked = false,
  navigationLockHint,
  children
}: AppShellProps): React.JSX.Element {
  const lockedTitle = navigationLockHint ?? '请稍候'

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}
    >
      <Stack
        sx={{
          width: 56,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          py: 1.5,
          alignItems: 'center',
          gap: 1
        }}
      >
        <Tooltip title={navigationLocked ? lockedTitle : '配置'} placement="right">
          <span>
            <IconButton
              color={page === 'settings' ? 'primary' : 'default'}
              onClick={() => onPageChange('settings')}
              disabled={navigationLocked}
              aria-label="配置"
            >
              <SettingsIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={navigationLocked ? lockedTitle : '行情'} placement="right">
          <span>
            <IconButton
              color={page === 'market' ? 'primary' : 'default'}
              onClick={() => onPageChange('market')}
              disabled={navigationLocked}
              aria-label="行情"
            >
              <ShowChartIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
