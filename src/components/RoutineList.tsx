import type { Habit } from '../db/types'
import { countOf, periodKeyFor, plannedDate, routineItems, soonItems, type LogMap } from '../lib/habits'
import { setPlannedDate, tapHabit } from '../lib/store'
import { monthKey, monthRange } from '../lib/date'
import { dueLabel } from '../screens/Tasks'
import { CheckCircle, toast } from './ui'
import { Icon } from './Icon'

/** 月次習慣の日付を、その場で決める小さなボタン（iPhone では日付ピッカーが開く） */
export function DatePickChip({ habit, mKey, today }: { habit: Habit; mKey: string; today: string }) {
  const planned = plannedDate(habit, mKey)
  const [min, max] = monthRange(mKey)
  return (
    <label className={`relative inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${planned ? 'bg-sage-light text-sage-deep' : 'border border-dashed border-greige text-ink-soft'}`}>
      <Icon name="calendar" size={12} />
      {planned ? dueLabel(planned, today) : '日付'}
      <input type="date" aria-label={`${habit.name}の${Number(mKey.slice(5))}月の日付を決める`} min={min} max={max} value={planned ?? ''}
        onChange={async (e) => { await setPlannedDate(habit, mKey, e.target.value); toast(e.target.value ? `${dueLabel(e.target.value, today)}に予定しました` : '日付を取り消しました') }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  )
}

/** 今日やる／期間内にやり残している週次・月次の習慣と、もうすぐ始まる月次の習慣（HOME と TASKS で共用） */
export function RoutineList({ habits, map, today, onEdit }: { habits: Habit[]; map: LogMap; today: string; onEdit?: (h: Habit) => void }) {
  const items = routineItems(habits, map, today)
  const soon = soonItems(habits, map, today)
  if (items.length === 0 && soon.length === 0) return null
  const mNow = monthKey(today)
  return (
    <div>
      {items.length > 0 && (
        <ul className="-my-1 divide-y divide-cream">
          {items.map(({ habit: h, start, done }) => {
            const pk = periodKeyFor(h, today)
            const count = countOf(map, h, pk)
            const target = Math.max(1, h.targetCount)
            const weekly = h.frequency === 'weekly'
            const carried = !done && start < today
            return (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <CheckCircle checked={done} count={count} target={target} label={`${h.name}を${done ? '未完了に戻す' : '完了にする'}`} onClick={() => tapHabit(h, today, map)} />
                <div className="min-w-0 flex-1">
                  <button type="button" className="block w-full text-left" onClick={onEdit ? () => onEdit(h) : undefined} disabled={!onEdit}>
                    <p className={`truncate text-[15px] ${done ? 'text-ink-faint line-through decoration-greige' : 'text-ink'}`}>{h.name}</p>
                  </button>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
                    <span className={`rounded-full px-1.5 ${weekly ? 'bg-sage-light text-sage-deep' : 'bg-beige text-ink-soft'}`}>{weekly ? '週次' : '月次'}</span>
                    {!done && (
                      <span className={`flex items-center gap-0.5 ${carried ? 'rounded-full bg-cream px-1.5 text-ink-soft' : ''}`}>
                        {carried ? `${dueLabel(start, today)}から・${weekly ? '今週' : '今月'}中に` : '今日'}
                      </span>
                    )}
                    {target > 1 && <span>{count}/{target}回</span>}
                  </p>
                </div>
                {!weekly && !done && <DatePickChip habit={h} mKey={mNow} today={today} />}
              </li>
            )
          })}
        </ul>
      )}
      {soon.length > 0 && (
        <div className={items.length ? 'mt-3 border-t border-cream pt-3' : ''}>
          <p className="mb-1 text-[11px] text-ink-faint">もうすぐ（月次）・日付を決めておけます</p>
          <ul className="divide-y divide-cream">
            {soon.map(({ habit: h, start, mKey, planned }) => (
              <li key={`${h.id}-${mKey}`} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream text-ink-faint"><Icon name="calendar" size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-ink">{h.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{planned ? `${dueLabel(start, today)}に予定` : `${dueLabel(start, today)}から（第${h.dueWeek ?? 1}週）`}</p>
                </div>
                <DatePickChip habit={h} mKey={mKey} today={today} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
