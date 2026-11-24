import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings } from '../db/db'
import type { Habit, Settings } from '../db/types'
import { DEFAULT_SETTINGS } from '../db/types'
import { toLogMap, periodKeyFor, countOf, type LogMap } from './habits'
import { monthRange } from './date'

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
}

export function useHabits(): Habit[] {
  return useLiveQuery(async () => (await db.habits.orderBy('order').toArray()).filter((h) => !h.archived), [], [])
}

/** 指定範囲の periodKey の記録をまとめて取得（日次キー・週キー・月キーは文字列比較で同じ範囲に収まる） */
export function useLogMap(fromKey: string, toKey: string): LogMap {
  const logs = useLiveQuery(() => db.habitLogs.where('periodKey').between(fromKey, toKey + '￿', true, true).toArray(), [fromKey, toKey], [])
  return toLogMap(logs)
}

export function useRestDays(): Set<string> {
  const rows = useLiveQuery(() => db.restDays.toArray(), [], [])
  return new Set(rows.map((r) => r.date))
}

export async function toggleRestDay(date: string) {
  const ex = await db.restDays.get(date)
  if (ex) await db.restDays.delete(date)
  else await db.restDays.put({ date })
}

/** チェック操作。目標回数が 1 なら ON/OFF、2 以上ならタップごとに +1（目標到達後のタップで 0 に戻る） */
export async function tapHabit(h: Habit, dateKey: string, map: LogMap) {
  const pk = periodKeyFor(h, dateKey)
  const cur = countOf(map, h, pk)
  const target = Math.max(1, h.targetCount)
  const next = cur >= target ? 0 : cur + 1
  const existing = await db.habitLogs.where('[habitId+periodKey]').equals([h.id!, pk]).first()
  if (next === 0) {
    if (existing) await db.habitLogs.delete(existing.id!)
  } else if (existing) {
    await db.habitLogs.update(existing.id!, { count: next, updatedAt: Date.now() })
  } else {
    await db.habitLogs.add({ habitId: h.id!, periodKey: pk, count: next, updatedAt: Date.now() })
  }
}

export function useMonthTx(mKey: string) {
  const [s, e] = monthRange(mKey)
  return useLiveQuery(() => db.transactions.where('date').between(s, e, true, true).toArray(), [s, e], [])
}

export function useCategories() {
  return useLiveQuery(() => db.categories.orderBy('order').toArray(), [], [])
}

/** カテゴリ別予算の集計（予算を決めたカテゴリだけで計算） */
export function categoryBudget(tx: { type: string; amount: number; categoryId: number }[], cats: { id?: number; type: string; budget?: number }[]) {
  const budgets = new Map(cats.filter((c) => c.type === 'expense' && c.budget).map((c) => [c.id!, c.budget!]))
  let total = 0
  budgets.forEach((b) => { total += b })
  const used = tx.filter((t) => t.type === 'expense' && budgets.has(t.categoryId)).reduce((a, t) => a + t.amount, 0)
  return { total, used, left: total - used, rate: total ? used / total : 0, count: budgets.size }
}

export function moneySummary(tx: { type: string; amount: number }[], budget: number) {
  let income = 0, expense = 0, saving = 0
  for (const t of tx) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
    else saving += t.amount
  }
  return { income, expense, saving, balance: income - expense, budgetLeft: budget - expense, budgetUsed: budget ? expense / budget : 0 }
}

/** 月次習慣の「その月の実行日」を決める／取り消す（date が空なら取り消し） */
export async function setPlannedDate(h: Habit, mKey: string, date: string) {
  const cur = (await db.habits.get(h.id!))?.plannedDates ?? {}
  const next = { ...cur }
  if (date) next[mKey] = date
  else delete next[mKey]
  // 古い月の予定は持ち続けない（直近12か月分だけ残す）
  for (const k of Object.keys(next).sort().slice(0, -12)) delete next[k]
  await db.habits.update(h.id!, { plannedDates: next })
}
