import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { needsWelcome } from './db/seed'
import Welcome from './screens/Welcome'
import { applyPalette, DEFAULT_PALETTE } from './lib/palette'
import { requestPersistence } from './db/db'
import { applyRecurring } from './lib/recurring'

async function boot() {
  let welcome = false
  try {
    welcome = await needsWelcome()
  } catch (e) {
    console.error('データの確認に失敗しました', e)
  }
  // 固定費の自動記録（起動時と、アプリに戻ってきたとき）
  applyRecurring().catch((e) => console.error(e))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyRecurring().catch(() => {}) })
  requestPersistence()
  // ホーム画面アプリ版だけ：オフラインでも開けるようにする
  if (__PWA__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker', e))
  }
  const root = createRoot(document.getElementById('root')!)
  const showApp = () => root.render(<StrictMode><App /></StrictMode>)
  if (welcome) {
    applyPalette(DEFAULT_PALETTE)
    root.render(<StrictMode><Welcome onDone={showApp} /></StrictMode>)
  } else showApp()
}
boot()
