import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './components/Icon'
import { ToastHost } from './components/ui'
import { useSettings } from './lib/store'
import { applyPalette, DEFAULT_PALETTE, LEGACY } from './lib/palette'
import Home from './screens/Home'
import Habits from './screens/Habits'
import Money from './screens/Money'
import Body from './screens/Body'
import SettingsScreen from './screens/Settings'
import Tasks from './screens/Tasks'
import WishScreen from './screens/Wish'
import Reflect, { type ReflectView } from './screens/Reflect'

export type Tab = 'home' | 'habits' | 'tasks' | 'money' | 'wish' | 'body' | 'settings' | 'reflect' | 'journal'
export type HabitsView = 'daily' | 'weekly' | 'monthly' | 'calendar'
export type JournalTarget = { kind: 'daily' | 'weekly' | 'monthly'; periodKey: string }
export type Go = (tab: Tab, opts?: { habitsView?: HabitsView; journal?: JournalTarget }) => void

const NAV: { tab: Tab; icon: string; label: string }[] = [
  { tab: 'home', icon: 'home', label: 'HOME' },
  { tab: 'habits', icon: 'habits', label: 'HABITS' },
  { tab: 'tasks', icon: 'tasks', label: 'TASKS' },
  { tab: 'money', icon: 'money', label: 'MONEY' },
  { tab: 'wish', icon: 'gift', label: 'WISH' },
  { tab: 'body', icon: 'body', label: 'BODY' },
  { tab: 'reflect', icon: 'reflect', label: 'REFLECT' },
]

const readHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab
  if (h === 'journal') return 'reflect'
  return ['home', 'habits', 'tasks', 'money', 'wish', 'body', 'settings', 'reflect'].includes(h) ? h : 'home'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readHash)
  const [habitsView, setHabitsView] = useState<HabitsView>('daily')
  const tabRef = useRef<Tab>(tab)
  useEffect(() => { tabRef.current = tab }, [tab])
  const [journal, setJournal] = useState<JournalTarget | null>(null)
  const [reflectView, setReflectView] = useState<ReflectView>(location.hash === '#journal' ? 'journal' : 'goals')
  const [reflectKey, setReflectKey] = useState(0)
  const settings = useSettings()

  // 色を反映。?theme=xxx（旧テーマ名）で一時的に試せる
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('theme')
    const p = (q && LEGACY[q]) || settings.palette || (settings.theme && LEGACY[settings.theme]) || DEFAULT_PALETTE
    applyPalette(p)
  }, [settings.palette, settings.theme])

  useEffect(() => {
    const onHash = () => setTab(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go: Go = useCallback((t, opts) => {
    if (opts?.habitsView) setHabitsView(opts.habitsView)
    if (t === 'journal') {
      // ふりかえりは REFLECT タブの中で開く
      setJournal(opts?.journal ?? null)
      setReflectView('journal')
      setReflectKey((k) => k + 1)
      t = 'reflect'
    }
    tabRef.current = t
    setTab(t)
    try { history.replaceState(null, '', `#${t}`) } catch { /* iframe 等で失敗しても無視 */ }
    window.scrollTo({ top: 0 })
  }, [])

  const side = (settings.navPosition ?? 'side') === 'side'
  useEffect(() => {
    // 右下の＋ボタンと通知の位置（タブが下にあるときはその分だけ上へ）
    document.documentElement.style.setProperty('--fab-bottom', side ? 'calc(env(safe-area-inset-bottom) + 20px)' : 'calc(env(safe-area-inset-bottom) + 84px)')
  }, [side])

  const screens = (
    <div key={tab} className="animate-screen">
      {tab === 'home' && <Home go={go} />}
      {tab === 'habits' && <Habits view={habitsView} setView={setHabitsView} go={go} />}
      {tab === 'tasks' && <Tasks />}
      {tab === 'money' && <Money />}
      {tab === 'wish' && <WishScreen />}
      {tab === 'body' && <Body />}
      {tab === 'settings' && <SettingsScreen go={go} />}
      {tab === 'reflect' && <Reflect key={reflectKey} view={reflectView} onView={setReflectView} journal={journal} />}
    </div>
  )

  if (side) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md bg-ivory">
        <nav className="sticky top-0 z-40 flex h-[100dvh] w-[52px] shrink-0 flex-col border-r border-beige/80 bg-ivory/95 pt-safe pb-safe" aria-label="メインナビゲーション">
          <ul className="flex flex-1 flex-col justify-center gap-1 py-2">
            {NAV.map((n) => {
              const active = tab === n.tab
              return (
                <li key={n.tab}>
                  <button type="button" onClick={() => go(n.tab)} aria-current={active ? 'page' : undefined}
                    className={`flex w-full flex-col items-center gap-0.5 py-2 transition ${active ? 'text-sage-deep' : 'text-ink-faint'}`}>
                    <span className={`flex h-9 w-10 max-w-[44px] items-center justify-center rounded-2xl transition ${active ? 'bg-sage-light' : ''}`}>
                      <Icon name={n.icon} size={21} strokeWidth={active ? 1.9 : 1.5} />
                    </span>
                    <span className="whitespace-nowrap font-serif text-[8.5px] font-semibold tracking-[0.02em]">{n.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 pt-safe" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>{screens}</main>
        <ToastHost />
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md bg-ivory">
      <main className="pt-safe" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
        {screens}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-beige/80 bg-ivory/90 backdrop-blur-md pb-safe" aria-label="メインナビゲーション">
        <ul className="flex">
          {NAV.map((n) => {
            const active = tab === n.tab
            return (
              <li key={n.tab} className="flex-1">
                <button type="button" onClick={() => go(n.tab)} aria-current={active ? 'page' : undefined}
                  className={`flex w-full flex-col items-center gap-1 pt-2.5 pb-2 transition ${active ? 'text-sage-deep' : 'text-ink-faint'}`}>
                  <span className={`flex h-7 w-10 items-center justify-center rounded-full transition ${active ? 'bg-sage-light' : ''}`}>
                    <Icon name={n.icon} size={21} strokeWidth={active ? 1.9 : 1.5} />
                  </span>
                  <span className="whitespace-nowrap font-serif font-semibold tracking-[0.03em]" style={{ fontSize: 'min(10px, 2.65vw)' }}>{n.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <ToastHost />
    </div>
  )
}
