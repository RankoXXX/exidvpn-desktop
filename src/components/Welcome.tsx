interface WelcomeProps {
  onGetStarted: () => void
  loading: boolean
}

export function Welcome({ onGetStarted, loading }: WelcomeProps) {
  return (
    <div className="welcome-container">
      <div className="welcome-icon">🛡️</div>
      <h1 className="welcome-title">Welcome to Exid VPN</h1>
      <p className="welcome-text">
        Secure, fast, and private connection to servers worldwide.
        Activate your subscription to get started.
      </p>
      <p className="welcome-price">
        <strong>1 USDC</strong> - One-time activation
      </p>
      <button
        className="btn btn-primary"
        onClick={onGetStarted}
        disabled={loading}
        style={{ width: '200px' }}
      >
        {loading ? (
          <>
            <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Opening...
          </>
        ) : (
          <>
            <span>💳</span>
            Activate Now
          </>
        )}
      </button>
    </div>
  )
}
