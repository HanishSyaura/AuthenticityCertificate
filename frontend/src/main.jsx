import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'react-quill/dist/quill.snow.css'
import 'katex/dist/katex.min.css'
import ErrorBoundary from './components/ErrorBoundary.jsx'

(function installChunkLoadRecovery() {
  if (typeof window === 'undefined') return
  const STORAGE_KEY = '__ac_chunk_reload_count'
  const MAX_RETRIES = 1
  function isChunkError(e) {
    const msg = String(e?.message || e?.reason?.message || e?.error?.message || '')
    if (/Loading chunk .* failed/i.test(msg)) return true
    if (/ChunkLoadError/i.test(msg)) return true
    if (/Failed to fetch dynamically imported module/i.test(msg)) return true
    const stack = String(e?.reason?.stack || e?.error?.stack || e?.stack || '')
    if (/import\(|__vite__|dynamically imported/.test(stack)) return true
    return false
  }
  function shouldReload() {
    try {
      const count = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
      if (count >= MAX_RETRIES) {
        sessionStorage.removeItem(STORAGE_KEY)
        return false
      }
      sessionStorage.setItem(STORAGE_KEY, String(count + 1))
      return true
    } catch {
      return false
    }
  }
  function handleError(e) {
    if (!isChunkError(e)) return
    if (!shouldReload()) return
    try {
      const loc = new URL(window.location.href)
      loc.searchParams.set('__v', String(Date.now()))
      window.location.replace(loc.toString())
    } catch {
      window.location.reload(true)
    }
  }
  window.addEventListener('error', handleError, true)
  window.addEventListener('unhandledrejection', handleError, true)
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
