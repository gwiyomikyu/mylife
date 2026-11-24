import { useMemo, useState } from 'react'
import type { Go, HabitsView } from '../App'
import { HabitCalendar } from './HabitCalendar'
import type { Habit, HabitFrequency } from '../db/types'
import { Card, Empty, Fab, IconButton, PageHeader, ProgressBar, Ring, Segmented } from '../components/ui'
import { Icon } from '../components/Icon'
import { HabitRow } from '../components/HabitRow'
import { HabitEditor, newHabit } from './HabitEditor'
import { ReorderList } from '../components/ReorderList'
import { addDays, addMonths, formatJa, formatMonthJa, formatWeekJa, fromKey, monthKey, todayKey, WD_JA, weekDays, weekStart } from '../lib/date'
import { dailyRate, isDue, periodRate, scopeOf, streak } from '../lib/habits'
import { toggleRestDay, useHabits, useLogMap, useRestDays } from '../lib/store'
import { pct } from '../lib/format'

export default function Habits({ view, setView, go }: { view: HabitsView; setView: (v: HabitsView) => void; go?: Go }) {
  const today = todayKey()
  const [date, setDate] = useState(today)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [sorting, setSorting] = useState(false)
  const habits = useHabits()
  const rest = useRestDays()
  const map = useLogMap(addDays(today, -400), addDays(date > today ? date : today, 40))
  const categories = useMemo(() => Array.from(new Set(habits.map((h) => h.category))), [habits])

  const scope = view === 'calendar' ? 'daily' : view
  const list = habits.filter((h) => scopeOf(h) === scope && isDue(h, date))
  const allInScope = habits.filter((h) => scopeOf(h) === scope)
  const rate = scope === 'daily' ? dailyRate(habits, map, date) : periodRate(habits, map, scope, date)
  const isRest = view === 'daily' && rest.has(date)

  const shift = (dir: number) => {
    if (view === 'daily') setDate(addDays(date, dir * 7))
    else if (view === 'weekly') setDate(addDays(date, dir * 7))
    else setDate(`${addMonths(monthKey(date), dir)}-01`)
  }
  const periodLabel = view === 'daily' ? formatJa(date) : view === 'weekly' ? formatWeekJa(weekStart(date)) : formatMonthJa(monthKey(date))
  const isCurrent = view === 'daily' ? date === today : view === 'weekly' ? weekStart(date) === weekStart(today) : monthKey(date) === monthKey(today)
  const freqForNew: HabitFrequency = scope

  return (
    <div>
      <PageHeader en="Habits" ja="習慣" />
      <div className="space-y-4 px-4">
        <Segmented value={view} onChange={setView} options={[{ value: 'daily', label: '日次' }, { value: 'weekly', label: '週次' }, { value: 'monthly', label: '月次' }, { value: 'calendar', label: 'カレンダー' }]} />
        {view === 'calendar' ? (
          <HabitCalendar habits={habits} map={map} rest={rest} go={go} onEdit={setEditing} onOpenDay={(k) => { setDate(k); setView('daily'); window.scrollTo({ top: 0 }) }} />
        ) : (<>

        <div className="flex items-center justify-between">
          <IconButton name="chevL" label="前へ" onClick={() => shift(-1)} />
          <div className="text-center">
            <p className="text-[15px] font-medium text-ink">{periodLabel}</p>
            {!isCurrent && <button type="button" onClick={() => setDate(today)} className="text-[11px] text-sage-dark">今日に戻る</button>}
            {isCurrent && <p className="text-[11px] text-ink-faint">{view === 'daily' ? '今日' : view === 'weekly' ? '今週（日曜日は振り返りの日）' : '今月（1日は月次チェックの日）'}</p>}
          </div>
          <IconButton name="chevR" label="次へ" onClick={() => shift(1)} />
        </div>

        {view === 'daily' && (
          <div className="grid grid-cols-7 gap-1">
            {weekDays(date).map((k) => {
              const r = dailyRate(habits, map, k)
              const sel = k === date
              const d = fromKey(k)
              return (
                <button key={k} type="button" onClick={() => setDate(k)} aria-label={formatJa(k)}
                  className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition ${sel ? 'bg-white shadow-card ring-1 ring-beige' : ''}`}>
                  <span className={`text-[10px] ${d.getDay() === 0 ? 'text-clay' : 'text-ink-faint'}`}>{WD_JA[d.getDay()]}</span>
                  <Ring value={k > today ? 0 : rest.has(k) ? 0 : r.rate} size={30} stroke={3}>
                    <span className={`text-[11px] tabular-nums ${k === today ? 'font-bold text-sage-deep' : 'text-ink'}`}>{d.getDate()}</span>
                  </Ring>
                  <span className="h-1 text-[8px] leading-none text-ink-faint">{rest.has(k) ? '休' : ''}</span>
                </button>
              )
            })}
          </div>
        )}

        <Card>
          {isRest ? (
            <div className="flex items-center gap-3 py-1">
              <Icon name="moon" className="text-sage-dark" />
              <p className="flex-1 text-[14px] text-ink">この日は休息日です。記録はそのまま残ります。</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Ring value={rate.rate} size={64} stroke={6}><span className="text-[15px] font-semibold tabular-nums">{pct(rate.rate)}</span></Ring>
              <div className="flex-1">
                <p className="text-[13px] text-ink-soft">{view === 'daily' ? 'この日' : view === 'weekly' ? 'この週' : 'この月'}の達成</p>
                <p className="text-[22px] font-semibold tabular-nums">{rate.done}<span className="text-[13px] font-normal text-ink-soft"> / {rate.total}</span></p>
                <ProgressBar value={rate.rate} className="mt-1" />
              </div>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between px-1">
          <p className="text-[12px] text-ink-faint">{sorting ? '≡ をドラッグ、または矢印で並び替え' : ''}</p>
          <button type="button" onClick={() => setSorting(!sorting)}
            className={`rounded-full px-4 py-1.5 text-[13px] ${sorting ? 'bg-sage-dark text-white' : 'bg-cream text-ink-soft'}`}>
            {sorting ? '完了' : '並び替え'}
          </button>
        </div>

        {sorting ? (
          <Card>
            {allInScope.length === 0 ? <Empty>並び替える習慣がありません</Empty> : <ReorderList habits={allInScope} />}
          </Card>
        ) : (
        <Card>
          {list.length === 0 ? <Empty>この{view === 'daily' ? '日' : view === 'weekly' ? '週' : '月'}の習慣はありません。＋から追加できます</Empty> : (
            <ul className="-my-1 divide-y divide-cream">
              {list.map((h) => (
                <HabitRow key={h.id} habit={h} dateKey={date} map={map} onEdit={() => setEditing(h)}
                  streakDays={isCurrent ? streak(h, map, today, rest) : undefined} disabled={date > today && view === 'daily'} />
              ))}
            </ul>
          )}
          {view === 'daily' && date <= today && (
            <button type="button" onClick={() => toggleRestDay(date)} className="mt-3 w-full rounded-2xl bg-cream/70 py-2.5 text-[13px] text-ink-soft">
              {isRest ? '休息日を解除する' : 'この日を休息日にする'}
            </button>
          )}
        </Card>
        )}
        <p className="px-2 pb-2 text-center text-[11px] text-ink-faint">習慣名をタップすると編集・履歴が見られます。並び順はHOMEにも反映されます</p>
        </>)}
      </div>

      {!sorting && view !== 'calendar' && <Fab label="習慣を追加" onClick={() => setEditing(newHabit(freqForNew))} />}
      <HabitEditor habit={editing} onClose={() => setEditing(null)} map={map} restDays={rest} categories={categories} />
    </div>
  )
}
