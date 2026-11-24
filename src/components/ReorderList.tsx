import type { Habit } from '../db/types'
import { db } from '../db/db'
import { reassignOrder, SortableList } from './SortableList'

/** 習慣の並び替え。並び順は habits.order に保存され、HOME のチェックリストにも反映される。 */
export function ReorderList({ habits }: { habits: Habit[] }) {
  const commit = async (next: Habit[]) => {
    const orders = reassignOrder(next)
    await db.transaction('rw', db.habits, async () => {
      for (let i = 0; i < next.length; i++) {
        if (next[i].order !== orders[i]) await db.habits.update(next[i].id!, { order: orders[i] })
      }
    })
  }
  return (
    <SortableList items={habits} name={(h) => h.name} onCommit={commit}
      render={(h) => (<><p className="truncate text-[15px] text-ink">{h.name}</p><p className="text-[11px] text-ink-faint">{h.category}</p></>)} />
  )
}
