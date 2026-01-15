import type { Country } from '../types/api'

// Country code to flag emoji mapping
function getCountryFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

interface CountryListProps {
  countries: Country[]
  onSelect: (country: Country) => void
  loading: boolean
}

export function CountryList({ countries, onSelect, loading }: CountryListProps) {
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading countries...</span>
      </div>
    )
  }

  if (countries.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🌍</span>
        <span className="empty-text">No countries available</span>
      </div>
    )
  }

  return (
    <div className="list-container">
      <div className="list-header">Select Country</div>
      {countries.map(country => (
        <div 
          key={country.id} 
          className="list-item"
          onClick={() => onSelect(country)}
        >
          <div className="list-item-content">
            <div className="list-item-icon">
              {getCountryFlag(country.code)}
            </div>
            <div className="list-item-text">
              <span className="list-item-title">{country.name}</span>
              <span className="list-item-subtitle">
                {country.servers_available} server{country.servers_available !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <span className="list-item-arrow">→</span>
        </div>
      ))}
    </div>
  )
}
