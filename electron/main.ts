import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import Store from 'electron-store'
import { DvpnsdkApi } from './api/dvpnsdk'
import VPNManager from './vpn/vpnmanager.js'

const store = new Store()
const api = new DvpnsdkApi(store)
let vpnManager: VPNManager | null = null

let mainWindow: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// Custom URL scheme for deep links
const PROTOCOL_SCHEME = 'exidvpn'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../public/icon.ico')
  })

  mainWindow.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Handle deep link URLs (exidvpn://activate?token=xxx)
function handleDeepLink(url: string) {
  console.log('Received deep link:', url)

  try {
    const urlObj = new URL(url)

    if (urlObj.protocol === `${PROTOCOL_SCHEME}:`) {
      // Handle activation with token
      if (urlObj.hostname === 'activate' || urlObj.pathname === '//activate') {
        const token = urlObj.searchParams.get('token')
        if (token) {
          console.log('Received device token from payment')
          api.setDeviceToken(token)

          // Notify the renderer process
          if (mainWindow) {
            mainWindow.webContents.send('device:activated', { token })
            // Focus the window
            mainWindow.show()
            mainWindow.focus()
          }
        }
      }
    }
  } catch (error) {
    console.error('Error handling deep link:', error)
  }
}

// Register as default protocol client for deep links
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)
}

// Handle protocol on Windows/Linux
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine) => {
    // Handle deep link from second instance
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`))
    if (url) {
      handleDeepLink(url)
    }

    // Focus the main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  // Initialize VPN Manager after app is ready
  vpnManager = new VPNManager()

  // Set up VPN status callback
  vpnManager.setStatusCallback((status: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('vpn:statusChange', status)
    }
  })

  createWindow()

  // Handle deep link on startup (Windows/Linux)
  const url = process.argv.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`))
  if (url) {
    handleDeepLink(url)
  }
})

// Handle protocol on macOS
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Cleanup VPN on quit
app.on('before-quit', async () => {
  try {
    if (vpnManager) {
      await vpnManager.disconnect()
      await vpnManager.cleanup()
    }
  } catch (err) {
    console.error('Error during VPN cleanup:', err)
  }
})

// Window controls
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

// API handlers
ipcMain.handle('api:checkDevice', async () => {
  return api.hasDeviceToken()
})

// NOTE: createDevice has been removed - it now happens on the backend
// after payment verification. Token is received via deep link.

ipcMain.handle('api:getPaymentUrl', async () => {
  return api.getPaymentUrl()
})

ipcMain.handle('api:getDevice', async () => {
  return api.getDevice()
})

ipcMain.handle('api:getCountries', async () => {
  return api.getCountries()
})

ipcMain.handle('api:getCities', async (_, countryId: string) => {
  return api.getCities(countryId)
})

ipcMain.handle('api:getCityServers', async (_, cityId: string) => {
  return api.getCityServers(cityId)
})

ipcMain.handle('api:createServerCredentials', async (_, serverId: string) => {
  return api.createServerCredentials(serverId)
})

ipcMain.handle('api:getIP', async () => {
  return api.getIP()
})

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  await shell.openExternal(url)
})

// VPN handlers
ipcMain.handle('vpn:connect', async (_, credentials: { protocol: string; payload: string; uid: string }) => {
  try {
    if (!vpnManager) throw new Error('VPN Manager not initialized')
    return await vpnManager.connect(credentials)
  } catch (error) {
    console.error('VPN connect error:', error)
    throw error
  }
})

ipcMain.handle('vpn:disconnect', async () => {
  try {
    if (!vpnManager) throw new Error('VPN Manager not initialized')
    return await vpnManager.disconnect()
  } catch (error) {
    console.error('VPN disconnect error:', error)
    throw error
  }
})

ipcMain.handle('vpn:getStatus', () => {
  if (!vpnManager) return 'disconnected'
  return vpnManager.getStatus()
})
