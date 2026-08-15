import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { runSprint1Acceptance } from './acceptance/runSprint1'
import { pythonBridge } from './bridge/pythonBridge'
import { initAppConfig } from './config/appConfig'
import { closeDb, initDb } from './db/sqlite'
import { registerHandlers } from './ipc/registerHandlers'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.tradingzone.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const userData = app.getPath('userData')
  initAppConfig(userData)
  initDb(userData)
  pythonBridge.configure({ userDataPath: userData })
  registerHandlers()

  try {
    await pythonBridge.start()
  } catch (err) {
    console.error('[main] failed to start python worker:', err)
  }

  if (process.env.SPRINT1_ACCEPTANCE === '1') {
    try {
      await runSprint1Acceptance()
    } catch (err) {
      console.error('[acceptance] failed:', err)
      app.exit(1)
    }
    return
  }

  if (process.env.SPRINT2_ACCEPTANCE === '1') {
    try {
      const { runSprint2Acceptance } = await import('./acceptance/runSprint2')
      await runSprint2Acceptance()
    } catch (err) {
      console.error('[acceptance] failed:', err)
      app.exit(1)
    }
    return
  }

  if (process.env.SPRINT3_ACCEPTANCE === '1') {
    try {
      const { runSprint3Acceptance } = await import('./acceptance/runSprint3')
      await runSprint3Acceptance()
    } catch (err) {
      console.error('[acceptance] failed:', err)
      app.exit(1)
    }
    return
  }

  if (process.env.SPRINT4_ACCEPTANCE === '1') {
    try {
      const { runSprint4Acceptance } = await import('./acceptance/runSprint4')
      await runSprint4Acceptance()
    } catch (err) {
      console.error('[acceptance] failed:', err)
      app.exit(1)
    }
    return
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void pythonBridge.stop()
  closeDb()
})
