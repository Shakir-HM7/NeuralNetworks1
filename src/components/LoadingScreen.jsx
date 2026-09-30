import React from 'react'

export default function LoadingScreen() {
  return (
    <div className="startup-loading-screen">
      <div className="startup-loading-content">
        <h1 className="startup-loading-title">NEURALDRIVE F1</h1>
        <div className="startup-loading-subtitle">
          SYSTEM INITIALIZING...
        </div>
        <div className="startup-loading-bar-container">
          <div className="startup-loading-bar-fill"></div>
        </div>
      </div>
    </div>
  )
}
