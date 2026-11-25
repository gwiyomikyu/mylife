import { journalPreview } from './Journal'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Habit, Journal } from '../db/types'
import { Card, IconButton, ProgressBar, SectionTitle } from '../components/ui'
import { Icon } from '../components/Icon'
import { HabitRow } from '../components/HabitRow'
import { addDays, addMonths, formatJa, formatMonthJa, fromKey, monthKey, monthRange, todayKey, weekStart } from '../lib/date'
import { dailyRate, isDone, isDue, scopeOf, type LogMap } from '../lib/habits'
import { pct, yen } from '../lib/format'
import type { Go } from '../App'

const WD = ['月', '火', '水', '木', '金', '土', '日']

/** 達成率に応じたマスの色（赤は使わない） */
function cellTone(rate: number, total: number) {
  if (!total) return ''
  if (rate >= 1) return 'bg-sage text-white font-semibold'
  if (rate >= 0.5) return 'bg-sage/45 text-ink'
  if (rate > 0) return 'bg-sage-light text-ink'
  return ''
}

export function HabitCalendar({ habits, map, rest, onOpenDay, go, onEdit }: {
  habits: Habit[]; map: LogMap; rest: Set<string>; onOpenDay: (k: string) => void; go?: Go; onEdit: (h: Habit) => void
}) {
  const today = todayKey()
  const [mKey, setMKey] = useState(monthKey(today))
  const [sel, setSel] = useState(today)
  const [ms, me] = monthRange(mKey)
  const gridStart = weekStart(ms)
  const gridDays = useMemo(() => {
    const out: string[] = []
    for (let d = gridStart; d <= me || out.length % 7; d = addDays(d, 1)) out.push(d)
    return out
  }, [gridStart, me])

  const workouts = useLiveQuery(() => db.workouts.where('date').between(gridStart, gridDays[gridDays.length - 1], true, true).toArray(), [gridStart, gridDays.length], [])
  const expenses = useLiveQuery(() => db.transactions.where('date').between(gridStart, gridDays[gridDays.length - 1], true, true).toArray(), [gridStart, gridDays.length], [])
  const journals = useLiveQuery(() => db.journals.where('kind').equals('daily').toArray(), [], [] as Journal[])
  const weights = useLiveQuery(() => db.weights.where('date').between(gridStart, gridDays[gridDays.length - 1], true, true).toArray(), [gridStart, gridDays.length], [])
  const jSet = useMemo(() => new Set(journals.map((j) => j.periodKey)), [journals])
  const wSet = useMemo(() => new Set(workouts.map((w) => w.date)), [workouts])

  // 月のまとめ
  const monthDays = gridDays.filter((k) => k.startsWith(mKey) && k <= today)
  const summary = useMemo(() => {
    let done = 0, total = 0, perfect = 0
    monthDays.forEach((k) => {
      if (rest.has(k)) return
      const r = dailyRate(habits, map, k)
      done += r.done; total += r.total
      if (r.total && r.rate >= 1) perfect++
    })
    return { rate: total ? done / total : 0, perfect, days: monthDays.length }
  }, [habits, map, rest, monthDays.join()])

  // 習慣ごとの達成（この月）
  const perHabit = useMemo(() => habits.map((h) => {
    const s = scopeOf(h)
    if (s === 'daily') {
      let d = 0, t = 0
      monthDays.forEach((k) => { if (rest.has(k) || !isDue(h, k)) return; t++; if (isDone(map, h, k)) d++ })
      if (h.optional) t = d
      return { h, d, t, unit: '日' }
    }
    if (s === 'weekly') {
      const weeks = Array.from(new Set(monthDays.map((k) => weekStart(k))))
      const due = weeks.filter((w) => isDue(h, w))
      return { h, d: due.filter((w) => isDone(map, h, w)).length, t: due.length, unit: '週' }
    }
    const due = monthDays.length > 0 && isDue(h, ms)
    return { h, d: due && isDone(map, h, mKey) ? 1 : 0, t: due ? 1 : 0, unit: 'か月' }
  }).filter((x) => x.t > 0 || x.d > 0), [habits, map, rest, monthDays.join(), mKey])

  const selDaily = habits.filter((h) => scopeOf(h) === 'daily' && isDue(h, sel))
  const selRate = dailyRate(habits, map, sel)
  const selSpend = expenses.filter((t) => t.date === sel && t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const selWorkouts = workouts.filter((w) => w.date === sel)
  const selWeight = weights.find((w) => w.date === sel)
  const selJournal = journals.find((j) => j.periodKey === sel)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <IconButton name="chevL" label="前の月" onClick={() => setMKey(addMonths(mKey, -1))} />
        <div className="text-center">
          <p className="text-[15px] font-medium">{formatMonthJa(mKey)}</p>
          {mKey !== monthKey(today) && <button type="button" onClick={() => { setMKey(monthKey(today)); setSel(today) }} className="text-[11px] text-sage-dark">今月に戻る</button>}
        </div>
        <IconButton name="chevR" label="次の月" onClick={() => setMKey(addMonths(mKey, 1))} />
      </div>

      <Card className="!px-3">
        <div className="grid grid-cols-7 text-center">
          {WD.map((w, i) => <span key={w} className={`pb-1 text-[10px] ${i === 6 ? 'text-clay' : 'text-ink-faint'}`}>{w}</span>)}
          {gridDays.map((k) => {
            const inMonth = k.startsWith(mKey)
            const future = k > today
            const r = dailyRate(habits, map, k)
            const isRest = rest.has(k)
            const on = k === sel
            return (
              <button key={k} type="button" onClick={() => setSel(k)} aria-label={`${formatJa(k)}${!future && !isRest && r.total ? ` 達成${pct(r.rate)}` : ''}`} aria-pressed={on}
                className={`flex flex-col items-center gap-0.5 py-1 ${inMonth ? '' : 'opacity-35'}`}>
                <span className={`flex h-[min(36px,9vw)] w-[min(36px,9vw)] items-center justify-center rounded-full text-[13px] tabular-nums transition
                  ${future || isRest ? 'text-ink-soft' : cellTone(r.rate, r.total) || 'text-ink'}
                  ${on ? 'ring-2 ring-sage-dark ring-offset-1 ring-offset-white' : k === today ? 'ring-1 ring-sage-dark' : ''}`}>
                  {isRest && !future ? '休' : fromKey(k).getDate()}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {wSet.has(k) && <span className="h-1.5 w-1.5 rounded-full bg-sage-deep" />}
                  {jSet.has(k) && <span className="h-1.5 w-1.5 rounded-full bg-clay" />}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-ink-soft">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-sage" />全部できた</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-sage/45" />半分以上</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-sage-light" />少し</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sage-deep" />運動</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-clay" />日記</span>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[15px] font-medium text-ink">{formatJa(sel)}</p>
          {sel <= today && selRate.total > 0 && !rest.has(sel) && <span className="rounded-full bg-cream px-2.5 py-1 text-[12px] tabular-nums text-ink-soft">{selRate.done} / {selRate.total}</span>}
        </div>
        {rest.has(sel) ? <p className="py-2 text-[13px] text-ink-soft">休息日でした。</p> : selDaily.length > 0 && (
          <ul className="-my-1 divide-y divide-cream">
            {selDaily.map((h) => <HabitRow key={h.id} habit={h} dateKey={sel} map={map} disabled={sel > today} onEdit={() => onEdit(h)} />)}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-cream/60 py-2"><p className="text-[10px] text-ink-faint">支出</p><p className="text-[13px] tabular-nums text-ink">{yen(selSpend)}</p></div>
          <div className="rounded-2xl bg-cream/60 py-2"><p className="text-[10px] text-ink-faint">運動</p><p className="text-[13px] tabular-nums text-ink">{selWorkouts.length ? `${selWorkouts.reduce((a, w) => a + w.minutes, 0)}分` : '—'}</p></div>
          <div className="rounded-2xl bg-cream/60 py-2"><p className="text-[10px] text-ink-faint">体重</p><p className="text-[13px] tabular-nums text-ink">{selWeight ? `${selWeight.weight.toFixed(1)}kg` : '—'}</p></div>
        </div>
        {selJournal && journalPreview('daily', selJournal.fields) && (
          <p className="mt-3 line-clamp-2 whitespace-pre-line rounded-2xl bg-sage-light/50 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
            {journalPreview('daily', selJournal.fields)}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onOpenDay(sel)} className="flex-1 rounded-2xl bg-cream/70 py-2.5 text-[13px] text-ink">この日のチェックへ</button>
          {go && sel <= today && (
            <button type="button" onClick={() => go('journal', { journal: { kind: 'daily', periodKey: sel } })} className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-cream/70 py-2.5 text-[13px] text-ink">
              <Icon name="edit" size={14} />{selJournal ? '日記を見る' : '日記を書く'}
            </button>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle en="History" ja={`${Number(mKey.slice(5))}月の達成`} />
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-[10px] text-ink-faint">日次の達成率</p><p className="text-[20px] font-semibold tabular-nums">{pct(summary.rate)}</p></div>
          <div><p className="text-[10px] text-ink-faint">全部できた日</p><p className="text-[20px] font-semibold tabular-nums">{summary.perfect}<span className="text-[11px] font-normal text-ink-soft">日</span></p></div>
          <div><p className="text-[10px] text-ink-faint">記録した日数</p><p className="text-[20px] font-semibold tabular-nums">{summary.days}<span className="text-[11px] font-normal text-ink-soft">日</span></p></div>
        </div>
        {perHabit.length === 0 ? <p className="text-center text-[12px] text-ink-faint">この月の記録はまだありません</p> : (
          <ul className="space-y-3">
            {perHabit.map(({ h, d, t, unit }) => (
              <li key={h.id}>
                <div className="flex justify-between gap-2 text-[13px]">
                  <span className="truncate text-ink">{h.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-soft">{h.optional ? `${d}${unit}` : `${d} / ${t}${unit}`}</span>
                </div>
                <ProgressBar value={h.optional ? (d ? 1 : 0) : t ? d / t : 0} className="mt-1 !h-1.5" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
