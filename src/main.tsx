import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { seedIfEmpty } from './db/seed'
import { requestPersistence } from './db/db'
import { applyRecurring } from './lib/recurring'

async function boot() {
  try {
    await seedIfEmpty()
  } catch (e) {
    console.error('初期データの作成に失敗しました', e)
  }
  // 固定費の自動記録（起動時と、アプリに戻ってきたとき）
  applyRecurring().catch((e) => console.error(e))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyRecurring().catch(() => {}) })
  requestPersistence()
  // ホーム画面アプリ版だけ：オフラインでも開けるようにする
  if (__PWA__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker', e))
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
boot()
