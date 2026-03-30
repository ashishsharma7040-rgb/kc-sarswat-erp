import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// ── Register Service Worker — makes app installable + offline ──
const updateSW = registerSW({
  // When new version available, update immediately (no stale version)
  immediate: true,
  onNeedRefresh() {
    // Auto-update silently
    updateSW(true)
  },
  onOfflineReady() {
    console.log('KC ERP: App ready for offline use')
  },
  onRegistered(r) {
    // Check for updates every 60 seconds
    r && setInterval(() => r.update(), 60 * 1000)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
