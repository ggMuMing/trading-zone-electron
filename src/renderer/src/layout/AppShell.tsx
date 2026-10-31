import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import DashboardIcon from '@mui/icons-material/SpaceDashboard'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import SettingsIcon from '@mui/icons-material/Settings'
import TableChartIcon from '@mui/icons-material/TableChart'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import type { ReactNode } from 'react'

export type AppPage = 'dashboard' | 'settings' | 'market' | 'chart' | 'screen' | 'paper' | 'journal'

interface AppShellProps {
  page: AppPage
  onPageChange: (page: AppPage) => void
  onOpenGroupManager: () => void
  navigationLocked?: boolean
  navigationLockHint?: string
  children: ReactNode
}

export function AppShell({
  page,
  onPageChange,
  onOpenGroupManager,
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
          width: 46,
          height: '100%',
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          py: 1.5,
          alignItems: 'center',
          gap: 1
        }}
      >
        <Tooltip title={navigationLocked ? lockedTitle : '仪表盘'} placement="right">
          <span>
            <IconButton
              color={page === 'dashboard' ? 'primary' : 'default'}
              onClick={() => onPageChange('dashboard')}
              disabled={navigationLocked}
              aria-label="仪表盘"
            >
              <DashboardIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={navigationLocked ? lockedTitle : '图表'} placement="right">
          <span>
            <IconButton
              color={page === 'chart' ? 'primary' : 'default'}
              onClick={() => onPageChange('chart')}
              disabled={navigationLocked}
              aria-label="图表"
            >
              <CandlestickChartIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={navigationLocked ? lockedTitle : '选股'} placement="right">
          <span>
            <IconButton
              color={page === 'screen' ? 'primary' : 'default'}
              onClick={() => onPageChange('screen')}
              disabled={navigationLocked}
              aria-label="选股"
            >
              <FilterAltIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={navigationLocked ? lockedTitle : '模拟盘'} placement="right">
          <span>
            <IconButton
              color={page === 'paper' ? 'primary' : 'default'}
              onClick={() => onPageChange('paper')}
              disabled={navigationLocked}
              aria-label="模拟盘"
            >
              <AccountBalanceWalletIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={navigationLocked ? lockedTitle : '交易管理'} placement="right">
          <span>
            <IconButton
              color={page === 'journal' ? 'primary' : 'default'}
              onClick={() => onPageChange('journal')}
              disabled={navigationLocked}
              aria-label="交易管理"
            >
              <ReceiptLongIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={navigationLocked ? lockedTitle : '数据'} placement="right">
          <span>
            <IconButton
              color={page === 'market' ? 'primary' : 'default'}
              onClick={() => onPageChange('market')}
              disabled={navigationLocked}
              aria-label="数据"
            >
              <TableChartIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Box sx={{ flex: 1, minHeight: 0 }} />
        <Tooltip title={navigationLocked ? lockedTitle : '分类管理'} placement="right">
          <span>
            <IconButton
              onClick={onOpenGroupManager}
              disabled={navigationLocked}
              aria-label="分类管理"
            >
              <AccountTreeIcon />
            </IconButton>
          </span>
        </Tooltip>
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
