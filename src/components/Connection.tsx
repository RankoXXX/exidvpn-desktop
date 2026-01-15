import { useState } from 'react'
import type { Credentials as CredentialsType, Server, City, Country, VpnStatus } from '../types/api'

interface ConnectionProps {
    credentials: CredentialsType
    server: Server
    city: City
    country: Country
    onBack: () => void
    loading: boolean
    vpnStatus: VpnStatus
    onConnect: () => void
    onDisconnect: () => void
}

export function Connection({
    credentials,
    server,
    city,
    country,
    onBack,
    loading,
    vpnStatus,
    onConnect,
    onDisconnect
}: ConnectionProps) {
    const [showDetails, setShowDetails] = useState(false)

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
                <span className="loading-text">Preparing connection...</span>
            </div>
        )
    }

    const isConnecting = vpnStatus === 'connecting'
    const isConnected = vpnStatus === 'connected'
    const isDisconnecting = vpnStatus === 'disconnecting'
    const isBusy = isConnecting || isDisconnecting

    const getStatusText = () => {
        switch (vpnStatus) {
            case 'connecting': return 'Connecting...'
            case 'connected': return 'Connected'
            case 'disconnecting': return 'Disconnecting...'
            default: return 'Disconnected'
        }
    }

    const getStatusColor = () => {
        switch (vpnStatus) {
            case 'connecting': return 'var(--warning)'
            case 'connected': return 'var(--success)'
            case 'disconnecting': return 'var(--warning)'
            default: return 'var(--text-secondary)'
        }
    }

    return (
        <>
            <button className="back-button" onClick={onBack} disabled={isBusy}>
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
                <span className="breadcrumb-item active">Connection</span>
            </div>

            <div className="connection-container">
                {/* Main Connection Card */}
                <div className="connection-card main">
                    <div className="connection-status-ring" data-status={vpnStatus}>
                        <div className="connection-status-inner">
                            {isBusy ? (
                                <div className="connection-spinner" />
                            ) : isConnected ? (
                                <span className="connection-icon">🔒</span>
                            ) : (
                                <span className="connection-icon">🔓</span>
                            )}
                        </div>
                    </div>

                    <div className="connection-status-text" style={{ color: getStatusColor() }}>
                        {getStatusText()}
                    </div>

                    <div className="connection-server-info">
                        <div className="server-name">{server.name}</div>
                        <div className="server-location">{city.name}, {country.name}</div>
                    </div>

                    {isConnected ? (
                        <button
                            className="btn btn-danger btn-large"
                            onClick={onDisconnect}
                            disabled={isBusy}
                        >
                            {isDisconnecting ? (
                                <>
                                    <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    Disconnecting...
                                </>
                            ) : (
                                <>
                                    <span>⚡</span>
                                    Disconnect
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary btn-large"
                            onClick={onConnect}
                            disabled={isBusy}
                        >
                            {isConnecting ? (
                                <>
                                    <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    Connect
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Server Details (Collapsible) */}
                <div className="details-toggle" onClick={() => setShowDetails(!showDetails)}>
                    <span>Connection Details</span>
                    <span className={`toggle-arrow ${showDetails ? 'open' : ''}`}>▼</span>
                </div>

                {showDetails && (
                    <div className="connection-card details">
                        <div className="detail-row">
                            <span className="detail-label">Protocol</span>
                            <span className="detail-value">{credentials.protocol}</span>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
