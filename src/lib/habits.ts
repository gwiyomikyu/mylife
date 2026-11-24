import type { Habit, HabitLog } from '../db/types'
import { addDays, addMonths, fromKey, monthKey, weekStart, WD_JA } from './date'

export type Scope = 'daily' | 'weekly' | 'monthly'

export function scopeOf(h: Habit): Scope {
  if (h.frequency === 'weekly') return 'weekly'
  if (h.frequency === 'monthly') return 'monthly'
  return 'daily'
}

/** 指定日を含む期間のキー */
export function periodKeyFor(h: Habit, dateKey: string): string {
  const s = scopeOf(h)
  if (s === 'weekly') return weekStart(dateKey)
  if (s === 'monthly') return monthKey(dateKey)
  return dateKey
}

/** その日（その期間）に実施対象かどうか */
export function isDue(h: Habit, dateKey: string): boolean {
  if (h.archived) return false
  const s = scopeOf(h)
  if (s === 'daily') {
    if (h.startDate > dateKey) return false
    if (h.frequency === 'weekdays') return h.weekdays.includes(fromKey(dateKey).getDay())
    return true
  }
  if (s === 'weekly') return h.startDate <= addDays(weekStart(dateKey), 6)
  return h.startDate.slice(0, 7) <= monthKey(dateKey)
}

export type LogMap = Map<string, number> // `${habitId}|${periodKey}` -> count

export function toLogMap(logs: HabitLog[]): LogMap {
  const m: LogMap = new Map()
  for (const l of logs) m.set(`${l.habitId}|${l.periodKey}`, l.count)
  return m
}

export function countOf(map: LogMap, h: Habit, periodKey: string): number {
  return map.get(`${h.id}|${periodKey}`) ?? 0
}

export function isDone(map: LogMap, h: Habit, periodKey: string): boolean {
  return countOf(map, h, periodKey) >= Math.max(1, h.targetCount)
}

export interface Rate {
  done: number
  total: number
  rate: number // 0..1（total=0 のときは 0）
}

const mkRate = (done: number, total: number): Rate => ({ done, total, rate: total ? done / total : 0 })

/**
 * 日次の達成率。対象：その日に実施対象となる日次習慣。
 * 「任意の日」の習慣は実施した日だけ分母・分子に加える（やらなくても下がらない）。
 */
export function dailyRate(habits: Habit[], map: LogMap, dateKey: string): Rate {
  let done = 0
  let total = 0
  for (const h of habits) {
    if (scopeOf(h) !== 'daily' || !isDue(h, dateKey)) continue
    const ok = isDone(map, h, dateKey)
    if (h.optional) {
      if (ok) { done++; total++ }
      continue
    }
    total++
    if (ok) done++
  }
  return mkRate(done, total)
}

export function periodRate(habits: Habit[], map: LogMap, scope: 'weekly' | 'monthly', dateKey: string): Rate {
  let done = 0
  let total = 0
  for (const h of habits) {
    if (scopeOf(h) !== scope || !isDue(h, dateKey)) continue
    const pk = periodKeyFor(h, dateKey)
    const ok = isDone(map, h, pk)
    if (h.optional) { if (ok) { done++; total++ } continue }
    total++
    if (ok) done++
  }
  return mkRate(done, total)
}

/** 複数日の日次習慣をまとめた達成率（休息日は除外） */
export function rangeRate(habits: Habit[], map: LogMap, days: string[], restDays: Set<string>): Rate {
  let done = 0
  let total = 0
  for (const d of days) {
    if (restDays.has(d)) continue
    const r = dailyRate(habits, map, d)
    done += r.done
    total += r.total
  }
  return mkRate(done, total)
}

/**
 * 継続日数：直近の連続達成日数。今日が未達成でも「まだ途中」として昨日から数える。
 * 実施対象外の日・休息日はスキップ（途切れ扱いにしない）。
 */
export function streak(h: Habit, map: LogMap, today: string, restDays: Set<string>): number {
  const s = scopeOf(h)
  let n = 0
  if (s === 'daily') {
    let d = today
    if (!isDone(map, h, d)) d = addDays(d, -1)
    for (let i = 0; i < 400; i++) {
      if (d < h.startDate) break
      if (!isDue(h, d) || restDays.has(d)) { d = addDays(d, -1); continue }
      if (isDone(map, h, d)) { n++; d = addDays(d, -1) } else break
    }
    return n
  }
  // 週次・月次は期間単位で数える
  let key = periodKeyFor(h, today)
  const step = (k: string) => (s === 'weekly' ? addDays(k, -7) : prevMonth(k))
  if (!isDone(map, h, key)) key = step(key)
  for (let i = 0; i < 120; i++) {
    if (isDone(map, h, key)) { n++; key = step(key) } else break
  }
  return n
}

function prevMonth(mKey: string): string {
  const [y, m] = mKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const FREQ_LABEL: Record<string, string> = {
  daily: '毎日',
  weekdays: '曜日指定',
  weekly: '毎週',
  monthly: '毎月',
}

// ---- 週次・月次の「実行日」 ----

export const MONTH_WEEKS = [
  { value: 1, label: '第1週', range: '1〜7日' },
  { value: 2, label: '第2週', range: '8〜14日' },
  { value: 3, label: '第3週', range: '15〜21日' },
  { value: 4, label: '第4週', range: '22日〜月末' },
]

export const dueWeekdayOf = (h: Habit) => h.dueWeekday ?? 0
export const dueWeekOf = (h: Habit) => Math.min(4, Math.max(1, h.dueWeek ?? 1))

/** 週次・月次の習慣が、その期間の中で「やる日」として始まる日付（日次は null） */
export function routineStart(h: Habit, dateKey: string): string | null {
  const s = scopeOf(h)
  if (s === 'weekly') return addDays(weekStart(dateKey), (dueWeekdayOf(h) + 6) % 7)
  if (s === 'monthly') return monthlyStart(h, monthKey(dateKey))
  return null
}

/** 月次：その月に決めた日付（なければ undefined） */
export const plannedDate = (h: Habit, mKey: string): string | undefined => {
  const d = h.plannedDates?.[mKey]
  return d && d.startsWith(mKey) ? d : undefined
}
export const weekFirstDay = (h: Habit, mKey: string) => `${mKey}-${String(1 + 7 * (dueWeekOf(h) - 1)).padStart(2, '0')}`
/** 月次：日付が決まっていればその日、未定なら指定週の初日 */
export const monthlyStart = (h: Habit, mKey: string) => plannedDate(h, mKey) ?? weekFirstDay(h, mKey)

export function routineLabel(h: Habit, mKey?: string): string {
  const s = scopeOf(h)
  if (s === 'weekly') return `${WD_JA[dueWeekdayOf(h)]}曜`
  if (s === 'monthly') {
    const w = MONTH_WEEKS[dueWeekOf(h) - 1]
    const p = mKey ? plannedDate(h, mKey) : undefined
    if (p) { const d = fromKey(p); return `${w.label}・${d.getMonth() + 1}/${d.getDate()}（${WD_JA[d.getDay()]}）` }
    return `${w.label}（${w.range}）`
  }
  return ''
}

export interface RoutineItem { habit: Habit; start: string; done: boolean }

/**
 * 今日やる・やり残している週次・月次の習慣。
 * 実行日（週次は指定曜日、月次は指定週の初日）を迎えたら表示し、その週・その月が終わるまで残す。
 */
export function routineItems(habits: Habit[], map: LogMap, today: string): RoutineItem[] {
  const items: RoutineItem[] = []
  for (const h of habits) {
    const s = scopeOf(h)
    if (s === 'daily' || !isDue(h, today)) continue
    const start = routineStart(h, today)!
    if (start > today) continue
    const done = isDone(map, h, periodKeyFor(h, today))
    items.push({ habit: h, start, done })
  }
  return items.sort((a, b) => Number(a.done) - Number(b.done) || b.start.localeCompare(a.start) || a.habit.order - b.habit.order)
}

export interface SoonItem { habit: Habit; start: string; mKey: string; planned: boolean }

/** もうすぐ始まる月次の習慣（7日以内。翌月の第1週も含む）と、日付を決めて予定に入っている月次の習慣 */
export function soonItems(habits: Habit[], map: LogMap, today: string): SoonItem[] {
  const out: SoonItem[] = []
  const limit = addDays(today, 7)
  for (const h of habits) {
    if (scopeOf(h) !== 'monthly' || h.archived) continue
    for (const mKey of [monthKey(today), addMonths(monthKey(today), 1)]) {
      const start = monthlyStart(h, mKey)
      const planned = !!plannedDate(h, mKey)
      // 日付を決めたものは先の日付でも表示、未定のものは7日以内に始まるものだけ
      if (start <= today || (!planned && start > limit) || !isDue(h, start) || isDone(map, h, mKey)) continue
      out.push({ habit: h, start, mKey, planned })
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.habit.order - b.habit.order)
}
