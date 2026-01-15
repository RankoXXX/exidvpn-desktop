import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const handleMinimize = () => window.electron.minimize()
  const handleMaximize = () => window.electron.maximize()
  const handleClose = () => window.electron.close()

  return (
    <div className="app-container">
      <div className="titlebar">
        <span className="titlebar-title">EXID VPN</span>
        <div className="titlebar-controls">
          <button 
            className="titlebar-btn minimize" 
            onClick={handleMinimize}
            title="Minimize"
          />
          <button 
            className="titlebar-btn maximize" 
            onClick={handleMaximize}
            title="Maximize"
          />
          <button 
            className="titlebar-btn close" 
            onClick={handleClose}
            title="Close"
          />
        </div>
      </div>
      <div className="main-content">
        {children}
      </div>
    </div>
  )
}
