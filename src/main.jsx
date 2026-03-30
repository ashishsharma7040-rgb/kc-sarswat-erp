import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Register Service Worker safely — wrapped in try/catch
// so if it fails it NEVER blocks the app from loading
try {
  const { registerSW } = await import('virtual:pwa-register')
  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() { updateSW(true) },
    onOfflineReady() { console.log('KC ERP: offline ready') },
    onRegistered(r) { r && setInterval(() => r.update(), 60000) },
    onRegisterError(e) { console.warn('SW register failed (non-fatal):', e) }
  })
} catch (e) {
  console.warn('PWA SW skipped:', e)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
