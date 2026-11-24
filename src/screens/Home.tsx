import { useLiveQuery } from 'dexie-react-hooks'
import type { Go } from '../App'
import { db } from '../db/db'
import { Burst, Card, IconButton, ProgressBar, Ring, SectionTitle, Stat, Empty } from '../components/ui'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_REMINDERS } from '../lib/ics'
import { Icon } from '../components/Icon'
import { HabitRow } from '../components/HabitRow'
import { addDays, dailyMessage, fromKey, greeting, monthKey, MONTH_EN, todayKey, WD_EN, weekDays, weekStart } from '../lib/date'
import { dailyRate, isDue, periodRate, rangeRate, routineItems, routineStart, scopeOf, soonItems, streak } from '../lib/habits'
import { categoryBudget, moneySummary, useCategories, toggleRestDay, useHabits, useLogMap, useMonthTx, useRestDays, useSettings } from '../lib/store'
import { kg, pct, yen } from '../lib/format'
import { TaskRow, useTasks } from './Tasks'
import { RoutineList } from '../components/RoutineList'
import { cheerMessage } from '../lib/cheer'

export default function Home({ go }: { go: Go }) {
  const today = todayKey()
  const d = fromKey(today)
  const settings = useSettings()
  const habits = useHabits()
  const rest = useRestDays()
  const ws = weekStart(today)
  const map = useLogMap(addDays(today, -400), today)
  const tx = useMonthTx(monthKey(today))
  const money = moneySummary(tx, 0)
  const cats = useCategories()
  const budget = categoryBudget(tx, cats)
  const weekTx = tx.filter((t) => t.date >= ws && t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const latestWeight = useLiveQuery(() => db.weights.orderBy('date').last(), [])
  const weekWorkouts = useLiveQuery(() => db.workouts.where('date').between(ws, addDays(ws, 6), true, true).count(), [ws], 0)

  const isRest = rest.has(today)
  const routines = routineItems(habits, map, today)
  const soon = soonItems(habits, map, today)
  const soonIds = new Set(soon.map((x) => x.habit.id))
  const upcoming = habits.filter((h) => scopeOf(h) !== 'daily' && isDue(h, today) && (routineStart(h, today) ?? '') > today && !soonIds.has(h.id))
  const upWeek = upcoming.filter((h) => h.frequency === 'weekly').length
  const upMonth = upcoming.length - upWeek
  const allTasks = useTasks()
  const todayTasks = allTasks
    .filter((t) => (!t.done && t.dueDate && t.dueDate <= today) || (t.done && t.dueDate === today))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt)
  const somedayCount = allTasks.filter((t) => !t.done && (!t.dueDate || t.dueDate > today)).length
  const todays = habits.filter((h) => scopeOf(h) === 'daily' && isDue(h, today))
  const r = dailyRate(habits, map, today)
  const weekDaysSoFar = weekDays(today).filter((k) => k <= today)
  const wDaily = rangeRate(habits, map, weekDaysSoFar, rest)
  const wWeekly = periodRate(habits, map, 'weekly', today)
  const weekRate = wDaily.total + wWeekly.total ? (wDaily.done + wWeekly.done) / (wDaily.total + wWeekly.total) : 0
  // 全部できた瞬間にお祝い
  const [burst, setBurst] = useState(0)
  const prevDone = useRef<number | null>(null)
  useEffect(() => {
    if (prevDone.current != null && r.total > 0 && r.done >= r.total && prevDone.current < r.total) setBurst(Date.now())
    prevDone.current = r.done
  }, [r.done, r.total])
  const remaining = isRest ? 0 : Math.max(0, r.total - r.done)
  const openTasks = todayTasks.filter((t) => !t.done).length
  // ホーム画面アプリのアイコンに「のこり」を表示（対応している端末だけ）
  useEffect(() => {
    if (!__PWA__) return
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    const n = remaining + openTasks
    ;(n ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {})
  }, [remaining, openTasks])
  const rem = { ...DEFAULT_REMINDERS, ...(settings.reminders ?? {}) }
  const now = new Date()
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const nudge = rem.daily && nowHM >= rem.dailyTime && remaining > 0
  const diff = latestWeight && settings.targetWeight != null ? latestWeight.weight - settings.targetWeight : null

  return (
    <div className="space-y-4 px-4 pb-4">
      <header className="flex items-start justify-between px-1 pt-4">
        <div>
          <p className="label-en text-[12px] text-ink-faint">{WD_EN[d.getDay()]} · {MONTH_EN[d.getMonth()]} {d.getDate()}</p>
          <h1 className="mt-1 font-serif text-[32px] font-semibold leading-tight text-ink">{greeting()}{settings.nickname ? `, ${settings.nickname}` : ''}!</h1>
          <p className="mt-1 text-[13px] text-ink-soft">{dailyMessage(today)}</p>
        </div>
        <IconButton name="settings" label="設定" onClick={() => go('settings')} className="-mr-1 mt-1" />
      </header>

      {nudge && (
        <div className="flex items-center gap-3 rounded-3xl bg-sage-light/70 px-4 py-3 animate-fade" role="status">
          <Icon name="moon" size={20} className="shrink-0 text-sage-deep" />
          <p className="text-[13px] leading-snug text-ink">そろそろ今日のチェックの時間です。<br /><span className="text-ink-soft">のこり{remaining}つ。できるところまでで大丈夫。</span></p>
        </div>
      )}

      {settings.monthlyGoal && (
        <Card className="!py-3.5 bg-cream/70">
          <p className="label-en text-[11px] text-ink-faint">This month's goal</p>
          <p className="mt-0.5 text-[14px] text-ink">{settings.monthlyGoal}</p>
        </Card>
      )}


      <Card>
        <SectionTitle en="Daily Progress" ja="今日の達成" right={<button type="button" aria-label="カレンダー" onClick={() => go('habits', { habitsView: 'calendar' })} className="-my-1 flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink-soft"><Icon name="calendar" size={16} /></button>} />
        {isRest ? (
          <div className="flex items-center gap-4">
            <Ring value={1}><Icon name="moon" className="text-sage-dark" /></Ring>
            <div>
              <p className="text-[15px] text-ink">今日は休息日</p>
              <p className="text-[12px] text-ink-soft">ゆっくり休むのも大切な習慣です。</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className={`relative rounded-full ${burst ? 'animate-glow' : ''}`} key={burst}>
              <Ring value={r.rate} size={84}>
                <span className="text-[20px] font-semibold tabular-nums text-ink">{pct(r.rate)}</span>
              </Ring>
              <Burst show={burst} />
            </div>
            <div className="flex-1">
              <p className="text-[28px] font-semibold tabular-nums text-ink">{r.done}<span className="text-[15px] font-normal text-ink-soft"> / {r.total}</span></p>
              <p className="text-[12px] text-ink-soft">{cheerMessage(r.done, r.total, today)}</p>
              <ProgressBar value={r.rate} className="mt-2" />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle en="Today's Checklist" ja="今日の習慣" />
        {todays.length === 0 ? <Empty>今日の習慣はまだありません</Empty> : (
          <ul className="-my-1 divide-y divide-cream">
            {todays.map((h) => <HabitRow key={h.id} habit={h} dateKey={today} map={map} streakDays={streak(h, map, today, rest)} />)}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => toggleRestDay(today)} className="rounded-2xl bg-cream/70 py-2.5 text-[13px] text-ink-soft">
            {isRest ? '休息日を解除' : '今日は休息日にする'}
          </button>
          <button type="button" onClick={() => go('habits', { habitsView: 'weekly' })} className="flex items-center justify-center gap-1 rounded-2xl bg-cream/70 py-2.5 text-[13px] text-ink-soft">
            週次・月次へ <Icon name="chevR" size={15} />
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle en="Weekly & Monthly" ja="今週・今月のチェック" />
        {routines.length === 0 && soon.length === 0 ? (
          <p className="py-2 text-center text-[13px] text-ink-faint">今日やる週次・月次の習慣はありません</p>
        ) : (
          <RoutineList habits={habits} map={map} today={today} onEdit={() => go('habits', { habitsView: 'weekly' })} />
        )}
        {upcoming.length > 0 && (
          <button type="button" onClick={() => go('habits', { habitsView: upWeek ? 'weekly' : 'monthly' })} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-cream/70 px-4 py-2.5 text-[12px] text-ink-soft">
            <span>これから：{[upWeek && `今週 ${upWeek}件`, upMonth && `今月 ${upMonth}件`].filter(Boolean).join('・')}</span>
            <Icon name="chevR" size={15} />
          </button>
        )}
      </Card>

      <Card>
        <SectionTitle en="Today's Tasks" ja="今日のやること" right={<button type="button" onClick={() => go('tasks')} className="flex items-center text-[12px] text-ink-faint">すべて<Icon name="chevR" size={14} /></button>} />
        {todayTasks.length === 0 ? (
          <button type="button" onClick={() => go('tasks')} className="w-full py-3 text-center text-[13px] text-ink-faint">
            今日のタスクはありません{somedayCount ? `（これから ${somedayCount}件）` : ''}。タップして追加
          </button>
        ) : (
          <ul className="-my-1 divide-y divide-cream">
            {todayTasks.slice(0, 8).map((t) => <TaskRow key={t.id} task={t} onEdit={() => go('tasks')} />)}
          </ul>
        )}
        {todayTasks.length > 8 && <p className="mt-2 text-center text-[11px] text-ink-faint">ほか {todayTasks.length - 8}件</p>}
      </Card>

      <JournalCard go={go} today={today} />

      <Card onClick={() => go('money')}>
        <SectionTitle en="Money" ja={`${d.getMonth() + 1}月の家計`} right={<Icon name="chevR" size={18} className="text-ink-faint" />} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="収入" value={yen(money.income)} />
          <Stat label="支出" value={yen(money.expense)} />
          <Stat label="今月の貯金" value={yen(money.saving)} />
          {budget.total > 0 && <Stat label="予算の残り" value={yen(budget.left)} />}
        </div>
        {budget.total > 0 && (<>
          <ProgressBar value={budget.rate} tone={budget.rate > 0.85 ? 'clay' : 'sage'} className="mt-4" />
          <p className="mt-1.5 text-[11px] text-ink-faint">カテゴリ別予算 {yen(budget.total)} のうち {pct(budget.rate)} を使用</p>
        </>)}
      </Card>

      <Card onClick={() => go('body')}>
        <SectionTitle en="Body" ja="からだ" right={<Icon name="chevR" size={18} className="text-ink-faint" />} />
        <div className="grid grid-cols-3 gap-3">
          <Stat label="最新の体重" value={kg(latestWeight?.weight)} unit="kg" />
          <Stat label="目標まで" value={diff == null ? '—' : diff <= 0 ? '達成' : diff.toFixed(1)} unit={diff != null && diff > 0 ? 'kg' : undefined} />
          <Stat label="今週の運動" value={weekWorkouts} unit={`/ ${settings.weeklyWorkoutGoal}回`} />
        </div>
      </Card>

      <Card>
        <SectionTitle en="Weekly Summary" ja="今週のまとめ" />
        <div className="grid grid-cols-3 gap-3">
          <Stat label="習慣の達成率" value={pct(weekRate)} />
          <Stat label="運動" value={weekWorkouts} unit="回" />
          <Stat label="今週の支出" value={yen(weekTx)} />
        </div>
        <button type="button" onClick={() => go('journal', { journal: { kind: 'weekly', periodKey: ws } })} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-cream/70 px-4 py-3 text-[13px] text-ink">
          <span>今週をふりかえる</span>
          <Icon name="arrowR" size={16} className="text-ink-soft" />
        </button>
      </Card>
    </div>
  )
}

function JournalCard({ go, today }: { go: Go; today: string }) {
  const ws = weekStart(today)
  const mk = monthKey(today)
  const written = useLiveQuery(async () => {
    const rows = await db.journals.where('[kind+periodKey]').anyOf([['daily', today], ['weekly', ws], ['monthly', mk]]).toArray()
    return new Set(rows.map((j) => `${j.kind}|${j.periodKey}`))
  }, [today, ws, mk], new Set<string>())
  const d = fromKey(today)
  const lastDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() < 3
  const items = [
    { kind: 'daily' as const, key: today, label: '今日', hint: '' },
    { kind: 'weekly' as const, key: ws, label: '今週', hint: d.getDay() === 0 ? 'ふりかえりの日' : '' },
    { kind: 'monthly' as const, key: mk, label: '今月', hint: lastDays ? 'もうすぐ月末' : '' },
  ]
  return (
    <Card>
      <SectionTitle en="Journal" ja="ふりかえり" />
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const done = written.has(`${it.kind}|${it.key}`)
          return (
            <button key={it.kind} type="button" onClick={() => go('journal', { journal: { kind: it.kind, periodKey: it.key } })}
              className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-[13px] transition ${done ? 'bg-sage-light text-sage-deep' : 'bg-cream/70 text-ink'}`}>
              <span className="flex items-center gap-1">{done && <Icon name="check" size={14} strokeWidth={2.2} />}{it.label}</span>
              <span className="text-[10px] text-ink-faint">{done ? '書きました' : it.hint || '書く'}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
