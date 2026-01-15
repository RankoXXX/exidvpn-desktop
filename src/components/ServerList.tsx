import type { Server, City, Country } from '../types/api'

interface ServerListProps {
  servers: Server[]
  city: City
  country: Country
  onSelect: (server: Server) => void
  onBack: () => void
  loading: boolean
}

function getLoadClass(load: number): string {
  // load is 0-1, convert to percentage for comparison
  const loadPercent = load * 100
  if (loadPercent < 40) return 'low'
  if (loadPercent < 70) return 'medium'
  return 'high'
}

export function ServerList({ servers, city, country, onSelect, onBack, loading }: ServerListProps) {
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading servers...</span>
      </div>
    )
  }

  return (
    <>
      <button className="back-button" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Cities
      </button>

      <div className="breadcrumb">
        <span className="breadcrumb-item">{country.name}</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-item">{city.name}</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-item active">Servers</span>
      </div>

      {servers.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🖥️</span>
          <span className="empty-text">No servers available</span>
        </div>
      ) : (
        <div className="list-container">
          <div className="list-header">Select Server</div>
          {servers.map(server => (
            <div
              key={server.id}
              className="list-item"
              onClick={() => onSelect(server)}
            >
              <div className="list-item-content">
                <div className="list-item-icon">🖥️</div>
                <div className="list-item-text">
                  <span className="list-item-title">{server.name}</span>
                  <span className="list-item-subtitle">{server.protocol}</span>
                </div>
              </div>
              <div className="server-load">
                <div className="load-bar">
                  <div
                    className={`load-fill ${getLoadClass(server.load)}`}
                    style={{ width: `${Math.round(server.load * 100)}%` }}
                  />
                </div>
                <span className="load-text">{Math.round(server.load * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
