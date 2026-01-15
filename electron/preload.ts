import { contextBridge, ipcRenderer } from 'electron'

export type VpnStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting'

export interface ElectronAPI {
  // Window controls
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>

  // API methods
  checkDevice: () => Promise<boolean>
  getPaymentUrl: () => Promise<string>
  getDevice: () => Promise<{ id: string; platform: string }>
  onDeviceActivated: (callback: (data: { token: string }) => void) => () => void
  getCountries: () => Promise<Country[]>
  getCities: (countryId: string) => Promise<City[]>
  getCityServers: (cityId: string) => Promise<Server[]>
  createServerCredentials: (serverId: string) => Promise<Credentials>
  getIP: () => Promise<{ ip: string; country: string }>

  // VPN methods
  vpnConnect: (credentials: { protocol: string; payload: string; uid: string }) => Promise<boolean>
  vpnDisconnect: () => Promise<boolean>
  vpnGetStatus: () => Promise<VpnStatus>
  onVpnStatusChange: (callback: (status: VpnStatus) => void) => () => void

  // Shell
  openExternal: (url: string) => Promise<void>
}

export interface Country {
  id: string
  name: string
  code: string
  servers_available: number
}

export interface City {
  id: string
  name: string
  country_id: string
  servers_available: number
}

export interface Server {
  id: string
  name: string
  city_id: string
  country_id: string
  load: number
  protocol: string
}

export interface Credentials {
  id: string
  server_id: string
  protocol: string
  payload: string
  uid: string
  expires_at: string
}

const electronAPI: ElectronAPI = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // API methods
  checkDevice: () => ipcRenderer.invoke('api:checkDevice'),
  getPaymentUrl: () => ipcRenderer.invoke('api:getPaymentUrl'),
  getDevice: () => ipcRenderer.invoke('api:getDevice'),
  onDeviceActivated: (callback: (data: { token: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { token: string }) => callback(data)
    ipcRenderer.on('device:activated', handler)
    return () => ipcRenderer.removeListener('device:activated', handler)
  },
  getCountries: () => ipcRenderer.invoke('api:getCountries'),
  getCities: (countryId: string) => ipcRenderer.invoke('api:getCities', countryId),
  getCityServers: (cityId: string) => ipcRenderer.invoke('api:getCityServers', cityId),
  createServerCredentials: (serverId: string) => ipcRenderer.invoke('api:createServerCredentials', serverId),
  getIP: () => ipcRenderer.invoke('api:getIP'),

  // VPN methods
  vpnConnect: (credentials: { protocol: string; payload: string; uid: string }) =>
    ipcRenderer.invoke('vpn:connect', credentials),
  vpnDisconnect: () => ipcRenderer.invoke('vpn:disconnect'),
  vpnGetStatus: () => ipcRenderer.invoke('vpn:getStatus'),
  onVpnStatusChange: (callback: (status: VpnStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: VpnStatus) => callback(status)
    ipcRenderer.on('vpn:statusChange', handler)
    return () => ipcRenderer.removeListener('vpn:statusChange', handler)
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
}

contextBridge.exposeInMainWorld('electron', electronAPI)

