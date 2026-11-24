import { db } from '../db/db'
import type { Recurring } from '../db/types'
import { addMonths, monthKey, monthRange, todayKey } from './date'

/** その月の記録日（指定日が月末を超える場合は月末） */
export function recurringDate(r: Recurring, mKey: string): string {
  const last = Number(monthRange(mKey)[1].slice(8))
  return `${mKey}-${String(Math.min(Math.max(1, r.day), last)).padStart(2, '0')}`
}

/**
 * 固定費の自動記録。開始月から今月まで、記録日を迎えた月のぶんを家計簿に追加する。
 * 一度記録した月は appliedMonths に残し、その記録をあとで消しても作り直さない。
 */
export async function applyRecurring(today = todayKey()): Promise<number> {
  let added = 0
  const cur = monthKey(today)
  await db.transaction('rw', db.recurring, db.transactions, async () => {
    for (const r of await db.recurring.toArray()) {
      if (!r.active) continue
      const applied = new Set(r.appliedMonths ?? [])
      let changed = false
      for (let m = r.startMonth, i = 0; m <= cur && i < 60; m = addMonths(m, 1), i++) {
        if (applied.has(m)) continue
        const date = recurringDate(r, m)
        if (date > today) continue
        await db.transactions.add({
          date, type: r.type, amount: r.amount, categoryId: r.categoryId, method: r.method,
          memo: r.memo || r.name, recurringId: r.id, goalId: r.type === 'saving' ? r.goalId : undefined, createdAt: Date.now(),
        })
        applied.add(m); changed = true; added++
      }
      if (changed) await db.recurring.update(r.id!, { appliedMonths: [...applied].sort().slice(-36) })
    }
  })
  return added
}
