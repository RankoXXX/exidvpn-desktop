import type { Country, City, Server, Credentials, Device, IPInfo, VpnStatus } from './api'

export interface ElectronAPI {
  // Window controls
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>

  // API methods
  checkDevice: () => Promise<boolean>
  getPaymentUrl: () => Promise<string>
  getDevice: () => Promise<Device>
  onDeviceActivated: (callback: (data: { token: string }) => void) => () => void
  getCountries: () => Promise<Country[]>
  getCities: (countryId: string) => Promise<City[]>
  getCityServers: (cityId: string) => Promise<Server[]>
  createServerCredentials: (serverId: string) => Promise<Credentials>
  getIP: () => Promise<IPInfo>

  // VPN methods
  vpnConnect: (credentials: { protocol: string; payload: string; uid: string }) => Promise<boolean>
  vpnDisconnect: () => Promise<boolean>
  vpnGetStatus: () => Promise<VpnStatus>
  onVpnStatusChange: (callback: (status: VpnStatus) => void) => () => void

  // Shell
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

