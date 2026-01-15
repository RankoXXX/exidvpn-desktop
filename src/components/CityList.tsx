import type { City, Country } from '../types/api'

interface CityListProps {
  cities: City[]
  country: Country
  onSelect: (city: City) => void
  onBack: () => void
  loading: boolean
}

export function CityList({ cities, country, onSelect, onBack, loading }: CityListProps) {
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading cities...</span>
      </div>
    )
  }

  return (
    <>
      <button className="back-button" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Countries
      </button>
      
      <div className="breadcrumb">
        <span className="breadcrumb-item">{country.name}</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-item active">Cities</span>
      </div>

      {cities.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🏙️</span>
          <span className="empty-text">No cities available</span>
        </div>
      ) : (
        <div className="list-container">
          <div className="list-header">Select City</div>
          {cities.map(city => (
            <div 
              key={city.id} 
              className="list-item"
              onClick={() => onSelect(city)}
            >
              <div className="list-item-content">
                <div className="list-item-icon">🏙️</div>
                <div className="list-item-text">
                  <span className="list-item-title">{city.name}</span>
                  <span className="list-item-subtitle">
                    {city.servers_available} server{city.servers_available !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <span className="list-item-arrow">→</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
