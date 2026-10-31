import { useEffect, useState } from 'react'
import { AppShell, type AppPage } from './layout/AppShell'
import { ChartPage } from './pages/ChartPage'
import { GroupManagerDialog } from './pages/groups/GroupManagerDialog'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { MarketPage } from './pages/MarketPage'
import { JournalPage } from './pages/journal/JournalPage'
import { PaperTradingPage } from './pages/paper/PaperTradingPage'
import { ScreenerPage } from './pages/screen/ScreenerPage'
import { SettingsPage } from './pages/SettingsPage'
import type { MarketSyncProgress } from '../../shared/types/market'

function App(): React.JSX.Element {
  const [page, setPage] = useState<AppPage>('dashboard')
  const [groupManagerOpen, setGroupManagerOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [progress, setProgress] = useState<MarketSyncProgress | null>(null)

  useEffect(() => {
    void window.api.market.syncStatus().then((status) => {
      setSyncing(status.syncing)
      if (status.progress) {
        setProgress(status.progress)
      }
    })
    return window.api.market.onSyncProgress((next) => {
      setProgress(next)
      setSyncing(next.stage !== 'done')
    })
  }, [])

  const interactionLocked = syncing || clearing
  const lockHint = clearing ? '正在清除数据' : syncing ? '数据更新中' : undefined

  const handlePageChange = (next: AppPage): void => {
    if (interactionLocked) {
      return
    }
    setPage(next)
  }

  return (
    <>
    <AppShell
      page={page}
      onPageChange={handlePageChange}
      onOpenGroupManager={() => setGroupManagerOpen(true)}
      navigationLocked={interactionLocked}
      navigationLockHint={lockHint}
    >
      {page === 'dashboard' ? (
        <DashboardPage />
      ) : page === 'settings' ? (
        <SettingsPage
          syncing={syncing}
          clearing={clearing}
          progress={progress}
          onSyncingChange={setSyncing}
          onClearingChange={setClearing}
        />
      ) : page === 'market' ? (
        <MarketPage />
      ) : page === 'paper' ? (
        <PaperTradingPage />
      ) : page === 'screen' ? (
        <ScreenerPage />
      ) : page === 'journal' ? (
        <JournalPage />
      ) : (
        <ChartPage />
      )}
    </AppShell>
    <GroupManagerDialog open={groupManagerOpen} onClose={() => setGroupManagerOpen(false)} />
    </>
  )
}

export default App
