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

export interface Device {
  id: string
  platform: string
  token?: string
}

export interface IPInfo {
  ip: string
  country: string
}

export type VpnStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting'

export type Screen = 'welcome' | 'countries' | 'cities' | 'servers' | 'connection'

export interface AppState {
  screen: Screen
  loading: boolean
  error: string | null
  deviceRegistered: boolean
  countries: Country[]
  cities: City[]
  servers: Server[]
  selectedCountry: Country | null
  selectedCity: City | null
  selectedServer: Server | null
  credentials: Credentials | null
  vpnStatus: VpnStatus
}
