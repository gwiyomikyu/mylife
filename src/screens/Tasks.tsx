import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Task } from '../db/types'
import { Button, Card, CheckCircle, Chip, Empty, Field, inputCls, PageHeader, SectionTitle, Sheet, toast } from '../components/ui'
import { Icon } from '../components/Icon'
import { addDays, formatJa, fromKey, todayKey, WD_JA } from '../lib/date'
import { RoutineList } from '../components/RoutineList'
import { routineItems, soonItems } from '../lib/habits'
import { useHabits, useLogMap } from '../lib/store'

export function useTasks(): Task[] {
  return useLiveQuery(() => db.tasks.toArray(), [], [])
}

export async function toggleTask(t: Task) {
  await db.tasks.update(t.id!, t.done ? { done: false, doneAt: undefined } : { done: true, doneAt: Date.now() })
}

/** 期日の短い表示（今日・明日・昨日・M/D（曜）） */
export function dueLabel(due: string, today = todayKey()): string {
  if (!due) return ''
  if (due === today) return '今日'
  if (due === addDays(today, 1)) return '明日'
  if (due === addDays(today, -1)) return '昨日'
  const d = fromKey(due)
  return `${d.getMonth() + 1}/${d.getDate()}（${WD_JA[d.getDay()]}）`
}

const byDue = (a: Task, b: Task) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt - b.createdAt

export function TaskRow({ task, onEdit, showDue = true }: { task: Task; onEdit?: () => void; showDue?: boolean }) {
  const today = todayKey()
  const carried = !task.done && task.dueDate && task.dueDate < today
  return (
    <li className="flex items-center gap-3 py-2.5">
      <CheckCircle checked={task.done} label={`${task.title}を${task.done ? '未完了に戻す' : '完了にする'}`} onClick={() => toggleTask(task)} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit} disabled={!onEdit}>
        <p className={`truncate text-[15px] ${task.done ? 'text-ink-faint line-through decoration-greige' : 'text-ink'}`}>{task.title}</p>
        {(showDue && task.dueDate) || task.memo ? (
          <p className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-ink-faint">
            {showDue && task.dueDate && (
              <span className={`flex shrink-0 items-center gap-0.5 ${carried ? 'rounded-full bg-cream px-1.5 text-ink-soft' : ''}`}>
                <Icon name="calendar" size={11} />{dueLabel(task.dueDate, today)}{carried ? 'から' : ''}
              </span>
            )}
            {task.memo && <span className="truncate">{task.memo}</span>}
          </p>
        ) : null}
      </button>
    </li>
  )
}

type DueChoice = 'today' | 'tomorrow' | 'none' | 'pick'

export default function Tasks() {
  const today = todayKey()
  const tasks = useTasks()
  const [title, setTitle] = useState('')
  const [choice, setChoice] = useState<DueChoice>('today')
  const [picked, setPicked] = useState(addDays(today, 2))
  const [editing, setEditing] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)
  const habits = useHabits()
  const map = useLogMap(addDays(today, -40), today)
  const hasRoutine = routineItems(habits, map, today).length + soonItems(habits, map, today).length > 0

  const groups = useMemo(() => {
    const open = tasks.filter((t) => !t.done).sort(byDue)
    return {
      carried: open.filter((t) => t.dueDate && t.dueDate < today),
      // 今日完了したものも「今日」に残して、できたことが見えるようにする
      today: [...open.filter((t) => t.dueDate === today), ...tasks.filter((t) => t.done && t.dueDate === today)],
      upcoming: open.filter((t) => t.dueDate && t.dueDate > today),
      someday: open.filter((t) => !t.dueDate),
      done: tasks.filter((t) => t.done && t.dueDate !== today).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    }
  }, [tasks, today])

  const add = async () => {
    const tt = title.trim()
    if (!tt) return
    const dueDate = choice === 'today' ? today : choice === 'tomorrow' ? addDays(today, 1) : choice === 'pick' ? picked : ''
    await db.tasks.add({ title: tt, dueDate, memo: '', done: false, createdAt: Date.now() })
    setTitle('')
    toast(dueDate ? `${dueLabel(dueDate)}のタスクに追加しました` : 'タスクを追加しました')
  }

  // 明日以降は日付ごとにまとめる
  const upcomingByDate = useMemo(() => {
    const m = new Map<string, Task[]>()
    groups.upcoming.forEach((t) => m.set(t.dueDate, [...(m.get(t.dueDate) ?? []), t]))
    return [...m.entries()]
  }, [groups.upcoming])

  const openCount = groups.carried.length + groups.today.length + groups.upcoming.length + groups.someday.length

  return (
    <div>
      <PageHeader en="Tasks" ja="やること" right={<p className="pb-1 text-[12px] text-ink-faint">のこり {openCount}件</p>} />
      <div className="space-y-4 px-4">
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); add() }} className="flex gap-2">
            <input className={`${inputCls} !py-2.5`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="やることを入力" aria-label="新しいタスク" enterKeyHint="done" />
            <Button type="submit" disabled={!title.trim()} className="shrink-0 !px-4 !py-2.5">追加</Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip active={choice === 'today'} onClick={() => setChoice('today')}>今日</Chip>
            <Chip active={choice === 'tomorrow'} onClick={() => setChoice('tomorrow')}>明日</Chip>
            <Chip active={choice === 'pick'} onClick={() => setChoice('pick')}>日付を選ぶ</Chip>
            <Chip active={choice === 'none'} onClick={() => setChoice('none')}>期日なし</Chip>
          </div>
          {choice === 'pick' && (
            <input type="date" aria-label="期日" className={`${inputCls} mt-2 !py-2.5`} value={picked} onChange={(e) => setPicked(e.target.value || today)} />
          )}
        </Card>

        {groups.carried.length > 0 && (
          <Card className="!bg-cream/60">
            <SectionTitle en="Carry Over" ja="持ち越し" />
            <ul className="-my-1 divide-y divide-beige/60">{groups.carried.map((t) => <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} />)}</ul>
          </Card>
        )}

        <Card>
          <SectionTitle en="Today" ja={formatJa(today)} />
          {groups.today.length === 0 ? <Empty>今日のタスクはありません</Empty> : (
            <ul className="-my-1 divide-y divide-cream">{groups.today.map((t) => <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} showDue={false} />)}</ul>
          )}
        </Card>

        {hasRoutine && (
          <Card>
            <SectionTitle en="Routine" ja="今週・今月の習慣" />
            <RoutineList habits={habits} map={map} today={today} />
          </Card>
        )}

        {upcomingByDate.length > 0 && (
          <Card>
            <SectionTitle en="Upcoming" ja="これから" />
            {upcomingByDate.map(([date, rows]) => (
              <div key={date} className="mb-2 last:mb-0">
                <p className="text-[11px] text-ink-faint">{dueLabel(date)}{date !== addDays(today, 1) ? '' : `・${formatJa(date)}`}</p>
                <ul className="divide-y divide-cream">{rows.map((t) => <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} showDue={false} />)}</ul>
              </div>
            ))}
          </Card>
        )}

        {groups.someday.length > 0 && (
          <Card>
            <SectionTitle en="Someday" ja="期日なし" />
            <ul className="-my-1 divide-y divide-cream">{groups.someday.map((t) => <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} />)}</ul>
          </Card>
        )}

        {groups.done.length > 0 && (
          <Card>
            <button type="button" onClick={() => setShowDone(!showDone)} className="flex w-full items-center justify-between">
              <span className="flex items-baseline gap-2"><span className="label-en text-[15px] font-semibold">Done</span><span className="text-[11px] text-ink-faint">完了 {groups.done.length}件</span></span>
              <Icon name="chevR" size={18} className={`text-ink-faint transition ${showDone ? 'rotate-90' : ''}`} />
            </button>
            {showDone && (
              <>
                <ul className="mt-2 divide-y divide-cream">{groups.done.slice(0, 50).map((t) => <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} />)}</ul>
                <ClearDone ids={groups.done.map((t) => t.id!)} />
              </>
            )}
          </Card>
        )}
        <p className="px-2 pb-2 text-center text-[11px] text-ink-faint">タスク名をタップすると、期日やメモの変更・削除ができます</p>
      </div>
      <TaskEditor task={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function ClearDone({ ids }: { ids: number[] }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <Button variant="ghost" className="mt-2 w-full !py-2.5 text-[13px]" onClick={async () => {
      if (!confirm) { setConfirm(true); return }
      await db.tasks.bulkDelete(ids)
      setConfirm(false)
      toast('完了したタスクを消しました')
    }}>{confirm ? 'もう一度タップで完了タスクをすべて消す' : '完了したタスクを消す'}</Button>
  )
}

function TaskEditor({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const [t, setT] = useState<Task | null>(task)
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => { setT(task); setConfirmDel(false) }, [task])
  if (!t) return null
  const today = todayKey()
  const set = (p: Partial<Task>) => setT({ ...t, ...p })
  const save = async () => {
    if (!t.title.trim()) { toast('タスク名を入力してください'); return }
    await db.tasks.put({ ...t, title: t.title.trim() })
    toast('保存しました')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.tasks.delete(t.id!)
    toast('削除しました')
    onClose()
  }
  return (
    <Sheet open title="タスクを編集" onClose={onClose}>
      <Field label="タスク名"><input className={inputCls} value={t.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="期日" group>
        <div className="mb-2 flex flex-wrap gap-2">
          <Chip active={t.dueDate === today} onClick={() => set({ dueDate: today })}>今日</Chip>
          <Chip active={t.dueDate === addDays(today, 1)} onClick={() => set({ dueDate: addDays(today, 1) })}>明日</Chip>
          <Chip active={!t.dueDate} onClick={() => set({ dueDate: '' })}>期日なし</Chip>
        </div>
        <input type="date" className={inputCls} value={t.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
      </Field>
      <Field label="メモ"><textarea className={`${inputCls} min-h-[72px]`} value={t.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="任意" /></Field>
      <label className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-beige">
        <span className="text-[14px] text-ink">完了</span>
        <input type="checkbox" className="h-5 w-5 accent-sage-dark" checked={t.done} onChange={(e) => set({ done: e.target.checked, doneAt: e.target.checked ? Date.now() : undefined })} />
      </label>
      <Button onClick={save} className="w-full">保存する</Button>
      <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'このタスクを削除'}</Button>
    </Sheet>
  )
}
