import Store from 'electron-store'

const BASE_URL = 'https://api.dvpnsdk.com'

// Backend URL for payment processing
// This should be configured in production
const BACKEND_URL = 'https://exidvpn-ff45640f1324.herokuapp.com'

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
  current_load: number
  protocol: string
}

export interface Credentials {
  id: string
  server_id: string
  protocol: string
  payload: string
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

export class DvpnsdkApi {
  private store: Store

  constructor(store: Store) {
    this.store = store
  }

  private getDeviceToken(): string | undefined {
    return this.store.get('deviceToken') as string | undefined
  }

  setDeviceToken(token: string): void {
    this.store.set('deviceToken', token)
  }

  hasDeviceToken(): boolean {
    return !!this.getDeviceToken()
  }

  getPaymentUrl(): string {
    return BACKEND_URL
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = true
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    }

    if (requiresAuth) {
      const token = this.getDeviceToken()
      if (!token) {
        throw new Error('Device not registered')
      }
      headers['x-device-token'] = token
    }

    const url = `${BASE_URL}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  // NOTE: createDevice has been removed from the desktop app.
  // Device creation now happens on the backend after payment verification.
  // The device token is received via deep link from the payment page.

  async getDevice(): Promise<Device> {
    const response = await this.request<{ data: Device }>('/device')
    return response.data
  }

  async getCountries(): Promise<Country[]> {
    const response = await this.request<{ data: Country[] }>('/country?filter=V2RAY')
    return response.data
  }

  async getCities(countryId: string): Promise<City[]> {
    const response = await this.request<{ data: City[] }>(`/country/${countryId}/city?filter=V2RAY`)
    return response.data
  }

  async getCityServers(cityId: string): Promise<Server[]> {
    const response = await this.request<{ data: Server[] }>(
      `/city/${cityId}/server?filter=V2RAY&sort=CURRENT_LOAD&limit=50`
    )
    return response.data
  }

  async createServerCredentials(serverId: string): Promise<Credentials> {
    const response = await this.request<{ data: Credentials }>(`/server/${serverId}/credentials`, {
      method: 'POST'
    })
    return response.data
  }

  async getIP(): Promise<IPInfo> {
    const response = await this.request<{ data: IPInfo }>('/ip')
    return response.data
  }
}
