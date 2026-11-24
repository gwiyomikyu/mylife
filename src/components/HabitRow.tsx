import type { Habit } from '../db/types'
import { countOf, periodKeyFor, routineLabel, type LogMap } from '../lib/habits'
import { tapHabit } from '../lib/store'
import { CheckCircle } from './ui'
import { Icon } from './Icon'

export function HabitRow({ habit, dateKey, map, onEdit, streakDays, disabled }: {
  habit: Habit; dateKey: string; map: LogMap; onEdit?: () => void; streakDays?: number; disabled?: boolean
}) {
  const pk = periodKeyFor(habit, dateKey)
  const count = countOf(map, habit, pk)
  const target = Math.max(1, habit.targetCount)
  const done = count >= target
  return (
    <li className={`flex items-center gap-3 py-2.5 ${disabled ? 'opacity-50' : ''}`}>
      <CheckCircle checked={done} count={count} target={target} label={`${habit.name}を${done ? '未完了に戻す' : '完了にする'}`}
        onClick={() => !disabled && tapHabit(habit, dateKey, map)} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit} disabled={!onEdit}>
        <p className={`truncate text-[15px] transition ${done ? 'text-ink-faint line-through decoration-greige' : 'text-ink'}`}>{habit.name}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
          <span>{habit.category}</span>
          {(habit.frequency === 'weekly' || habit.frequency === 'monthly') && (
            <span className="flex items-center gap-0.5"><Icon name="calendar" size={11} />{routineLabel(habit, dateKey.slice(0, 7))}</span>
          )}
          {habit.optional && <span className="rounded-full bg-cream px-1.5">任意</span>}
          {target > 1 && <span>{count}/{target}回</span>}
          {!!streakDays && streakDays >= 2 && (
            <span className="flex items-center gap-0.5 text-sage-dark"><Icon name="leaf" size={11} />{streakDays}{habit.frequency === 'weekly' ? '週' : habit.frequency === 'monthly' ? 'か月' : '日'}継続</span>
          )}
        </p>
      </button>
    </li>
  )
}
