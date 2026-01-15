import { useState } from 'react'
import type { Credentials as CredentialsType, Server, City, Country } from '../types/api'

interface CredentialsProps {
  credentials: CredentialsType
  server: Server
  city: City
  country: Country
  onBack: () => void
  loading: boolean
}

export function Credentials({ credentials, server, city, country, onBack, loading }: CredentialsProps) {
  const [copied, setCopied] = useState(false)

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Creating credentials...</span>
      </div>
    )
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(credentials.payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const expiresAt = new Date(credentials.expires_at)
  const formattedExpiry = expiresAt.toLocaleString()

  return (
    <>
      <button className="back-button" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Servers
      </button>
      
      <div className="breadcrumb">
        <span className="breadcrumb-item">{country.name}</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-item">{city.name}</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-item">{server.name}</span>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-item active">Credentials</span>
      </div>

      <div className="credentials-container">
        <div className="credentials-card">
          <div className="credentials-header">
            <div className="credentials-icon">🔐</div>
            <div>
              <div className="credentials-title">V2Ray Credentials</div>
              <div className="credentials-subtitle">Ready to connect</div>
            </div>
          </div>

          <div className="credentials-field">
            <div className="credentials-label">Server</div>
            <div className="credentials-value">{server.name}</div>
          </div>

          <div className="credentials-field">
            <div className="credentials-label">Protocol</div>
            <div className="credentials-value">{credentials.protocol}</div>
          </div>

          <div className="credentials-field">
            <div className="credentials-label">Connection URI</div>
            <div className="credentials-value">{credentials.payload}</div>
          </div>

          <div className="credentials-field">
            <div className="credentials-label">Expires At</div>
            <div className="credentials-value">{formattedExpiry}</div>
          </div>

          <div className="credentials-actions">
            <button className="btn btn-primary" onClick={handleCopy}>
              <span>📋</span>
              Copy URI
            </button>
          </div>
        </div>

        <div className="credentials-card">
          <div className="credentials-header">
            <div className="credentials-icon">ℹ️</div>
            <div>
              <div className="credentials-title">How to Connect</div>
              <div className="credentials-subtitle">Quick guide</div>
            </div>
          </div>
          
          <div className="credentials-value" style={{ maxHeight: 'none' }}>
            1. Copy the Connection URI above<br/>
            2. Open your V2Ray client (v2rayN, Qv2ray, etc.)<br/>
            3. Import the URI from clipboard<br/>
            4. Connect and enjoy secure browsing!
          </div>
        </div>
      </div>

      {copied && (
        <div className="copy-notification">
          ✓ Copied to clipboard!
        </div>
      )}
    </>
  )
}
