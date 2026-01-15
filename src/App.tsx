import { useState, useEffect, useCallback } from 'react'
import { Layout } from './components/Layout'
import { Welcome } from './components/Welcome'
import { CountryList } from './components/CountryList'
import { CityList } from './components/CityList'
import { ServerList } from './components/ServerList'
import { Connection } from './components/Connection'
import { useApi } from './hooks/useApi'
import type {
  Screen,
  Country,
  City,
  Server,
  Credentials as CredentialsType,
  VpnStatus
} from './types/api'

function App() {
  const api = useApi()

  const [screen, setScreen] = useState<Screen>('welcome')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [servers, setServers] = useState<Server[]>([])

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [credentials, setCredentials] = useState<CredentialsType | null>(null)

  const [vpnStatus, setVpnStatus] = useState<VpnStatus>('disconnected')

  // Check if device is registered on startup
  useEffect(() => {
    async function checkDevice() {
      try {
        const hasDevice = await api.checkDevice()
        if (hasDevice) {
          setScreen('countries')
          loadCountries()
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Error checking device:', err)
        setLoading(false)
      }
    }
    checkDevice()
  }, [])

  // Listen for VPN status changes from main process
  useEffect(() => {
    const unsubscribe = window.electron.onVpnStatusChange((status: VpnStatus) => {
      setVpnStatus(status)
    })

    // Get initial status
    window.electron.vpnGetStatus().then(setVpnStatus)

    return () => unsubscribe()
  }, [])

  const loadCountries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCountries()
      setCountries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load countries')
    } finally {
      setLoading(false)
    }
  }, [api])

  // Listen for device activation from deep link (after payment)
  useEffect(() => {
    const unsubscribe = window.electron.onDeviceActivated(async () => {
      // Device was activated via deep link after payment
      console.log('Device activated via deep link')
      setLoading(true)
      setError(null)
      try {
        // Now we have a device token, proceed to countries
        setScreen('countries')
        await loadCountries()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load countries')
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [loadCountries])

  const handleGetStarted = async () => {
    setLoading(true)
    setError(null)
    try {
      // Open payment page in browser
      // After payment, the backend will create the device and redirect back
      // via deep link with the device token
      await api.openPaymentPage()
      setLoading(false)
      // Note: The screen transition will happen in onDeviceActivated callback
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open payment page')
      setLoading(false)
    }
  }

  const handleSelectCountry = async (country: Country) => {
    setSelectedCountry(country)
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCities(country.id)
      setCities(data)
      setScreen('cities')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cities')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCity = async (city: City) => {
    setSelectedCity(city)
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCityServers(city.id)
      setServers(data)
      setScreen('servers')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load servers')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectServer = async (server: Server) => {
    setSelectedServer(server)
    setLoading(true)
    setError(null)
    try {
      const data = await api.createServerCredentials(server.id)
      setCredentials(data)
      setScreen('connection')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!credentials) return

    setError(null)
    try {
      await window.electron.vpnConnect({
        protocol: credentials.protocol,
        payload: credentials.payload,
        uid: credentials.uid
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  const handleDisconnect = async () => {
    setError(null)
    try {
      await window.electron.vpnDisconnect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  const handleBackToCountries = () => {
    setScreen('countries')
    setSelectedCountry(null)
    setCities([])
  }

  const handleBackToCities = () => {
    setScreen('cities')
    setSelectedCity(null)
    setServers([])
  }

  const handleBackToServers = () => {
    if (vpnStatus === 'connecting' || vpnStatus === 'disconnecting') {
      return // Don't allow going back while connection is in progress
    }
    setScreen('servers')
    setSelectedServer(null)
    setCredentials(null)
  }

  const renderScreen = () => {
    if (error) {
      return (
        <div className="error-container">
          <span className="error-icon">⚠️</span>
          <h2 className="error-title">Something went wrong</h2>
          <p className="error-message">{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setError(null)
              if (screen === 'welcome') {
                handleGetStarted()
              } else if (screen === 'countries') {
                loadCountries()
              } else if (screen === 'cities' && selectedCountry) {
                handleSelectCountry(selectedCountry)
              } else if (screen === 'servers' && selectedCity) {
                handleSelectCity(selectedCity)
              } else if (screen === 'connection' && selectedServer) {
                handleSelectServer(selectedServer)
              }
            }}
            style={{ width: '160px' }}
          >
            Try Again
          </button>
        </div>
      )
    }

    switch (screen) {
      case 'welcome':
        return <Welcome onGetStarted={handleGetStarted} loading={loading} />

      case 'countries':
        return (
          <CountryList
            countries={countries}
            onSelect={handleSelectCountry}
            loading={loading}
          />
        )

      case 'cities':
        return selectedCountry ? (
          <CityList
            cities={cities}
            country={selectedCountry}
            onSelect={handleSelectCity}
            onBack={handleBackToCountries}
            loading={loading}
          />
        ) : null

      case 'servers':
        return selectedCountry && selectedCity ? (
          <ServerList
            servers={servers}
            city={selectedCity}
            country={selectedCountry}
            onSelect={handleSelectServer}
            onBack={handleBackToCities}
            loading={loading}
          />
        ) : null

      case 'connection':
        return selectedCountry && selectedCity && selectedServer && credentials ? (
          <Connection
            credentials={credentials}
            server={selectedServer}
            city={selectedCity}
            country={selectedCountry}
            onBack={handleBackToServers}
            loading={loading}
            vpnStatus={vpnStatus}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        ) : null

      default:
        return null
    }
  }

  return (
    <Layout>
      <div className="header">
        <h1 className="logo">Exid VPN</h1>
        <p className="subtitle">Secure • Fast • Private</p>
      </div>
      {renderScreen()}
    </Layout>
  )
}

export default App

