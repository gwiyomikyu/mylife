import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Habit, HabitFrequency } from '../db/types'
import { Button, Chip, Field, inputCls, Sheet, toast } from '../components/ui'
import { addDays, addMonths, monthKey, todayKey, WD_JA, weekStart } from '../lib/date'
import { dueWeekOf, dueWeekdayOf, isDone, isDue, MONTH_WEEKS, plannedDate, streak, type LogMap } from '../lib/habits'
import { monthRange } from '../lib/date'

const FREQS: { value: HabitFrequency; label: string }[] = [
  { value: 'daily', label: '毎日' },
  { value: 'weekdays', label: '曜日指定' },
  { value: 'weekly', label: '毎週' },
  { value: 'monthly', label: '毎月' },
]
const BASE_CATS = ['生活', '健康', '美容', '時間', '睡眠', '家事', 'お金', '自分']

export function newHabit(frequency: HabitFrequency = 'daily'): Habit {
  return { name: '', category: '生活', frequency, weekdays: [], optional: false, targetCount: 1, startDate: todayKey(), memo: '', order: Date.now(), archived: false, createdAt: Date.now() }
}

export function HabitEditor({ habit, onClose, map, restDays, categories }: {
  habit: Habit | null; onClose: () => void; map: LogMap; restDays: Set<string>; categories: string[]
}) {
  const [h, setH] = useState<Habit | null>(habit)
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => { setH(habit); setConfirmDel(false) }, [habit])
  const cats = useMemo(() => Array.from(new Set([...BASE_CATS, ...categories])), [categories])

  if (!h) return null
  const set = (p: Partial<Habit>) => setH({ ...h, ...p })
  const isNew = h.id == null

  const save = async () => {
    const name = h.name.trim()
    if (!name) { toast('習慣名を入力してください'); return }
    if (h.frequency === 'weekdays' && h.weekdays.length === 0) { toast('曜日を1つ以上選んでください'); return }
    const row = { ...h, name, category: h.category.trim() || 'その他', targetCount: Math.max(1, Math.round(h.targetCount) || 1) }
    if (isNew) await db.habits.add(row)
    else await db.habits.put(row)
    toast(isNew ? '習慣を追加しました' : '保存しました')
    onClose()
  }

  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.transaction('rw', db.habits, db.habitLogs, async () => {
      await db.habitLogs.where('habitId').equals(h.id!).delete()
      await db.habits.delete(h.id!)
    })
    toast('削除しました')
    onClose()
  }

  return (
    <Sheet open title={isNew ? '習慣を追加' : '習慣を編集'} onClose={onClose}>
      {!isNew && <History habit={h} map={map} restDays={restDays} />}
      <Field label="習慣名">
        <input className={inputCls} value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="例：朝にストレッチをする" autoFocus={isNew} />
      </Field>
      <Field label="カテゴリ" group>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => <Chip key={c} active={h.category === c} onClick={() => set({ category: c })}>{c}</Chip>)}
        </div>
        <input className={`${inputCls} mt-2 !py-2.5`} value={cats.includes(h.category) ? '' : h.category} onChange={(e) => set({ category: e.target.value })} placeholder="新しいカテゴリを入力" />
      </Field>
      <Field label="実施頻度" group>
        <div className="flex flex-wrap gap-2">
          {FREQS.map((f) => <Chip key={f.value} active={h.frequency === f.value} onClick={() => set({ frequency: f.value })}>{f.label}</Chip>)}
        </div>
        {h.frequency === 'weekdays' && (
          <div className="mt-3 flex justify-between">
            {WD_JA.map((w, i) => {
              const on = h.weekdays.includes(i)
              return (
                <button key={w} type="button" onClick={() => set({ weekdays: on ? h.weekdays.filter((x) => x !== i) : [...h.weekdays, i].sort() })}
                  className={`h-10 w-10 rounded-full border text-[14px] ${on ? 'border-sage bg-sage text-white' : 'border-beige bg-white text-ink-soft'}`}>{w}</button>
              )
            })}
          </div>
        )}
      </Field>
      {h.frequency === 'weekly' && (
        <Field label="実行する曜日" hint="この曜日になったら HOME と TASKS に表示します。週内にできなければ日曜まで持ち越し表示" group>
          <div className="flex justify-between">
            {WD_JA.map((w, i) => (
              <button key={w} type="button" onClick={() => set({ dueWeekday: i })}
                className={`h-10 w-10 rounded-full border text-[14px] ${dueWeekdayOf(h) === i ? 'border-sage bg-sage text-white' : 'border-beige bg-white text-ink-soft'}`}>{w}</button>
            ))}
          </div>
        </Field>
      )}
      {h.frequency === 'monthly' && (
        <Field label="実行する週" hint="毎月この週の初日から HOME と TASKS に表示します（日付を決めた月はその日から）。月内にできなければ月末まで持ち越し表示" group>
          <div className="grid grid-cols-2 gap-2">
            {MONTH_WEEKS.map((w) => (
              <button key={w.value} type="button" onClick={() => set({ dueWeek: w.value })}
                className={`rounded-2xl border px-3 py-2.5 text-left ${dueWeekOf(h) === w.value ? 'border-sage bg-sage-light text-sage-deep' : 'border-beige bg-white text-ink-soft'}`}>
                <span className="block text-[14px] font-medium">{w.label}</span>
                <span className="block text-[11px] opacity-80">{w.range}</span>
              </button>
            ))}
          </div>
        </Field>
      )}
      {h.frequency === 'monthly' && <MonthDateField h={h} set={set} />}
      {(h.frequency === 'daily' || h.frequency === 'weekdays') && (
        <label className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-beige">
          <span>
            <span className="block text-[14px] text-ink">任意の日（やった日だけ記録）</span>
            <span className="block text-[11px] text-ink-faint">できなかった日も達成率は下がりません</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-sage-dark" checked={h.optional} onChange={(e) => set({ optional: e.target.checked })} />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={`目標回数（${h.frequency === 'weekly' ? '週' : h.frequency === 'monthly' ? '月' : '日'}あたり）`} group>
          <div className="flex items-center rounded-2xl border border-beige bg-white">
            <button type="button" className="h-12 w-12 text-xl text-ink-soft" onClick={() => set({ targetCount: Math.max(1, h.targetCount - 1) })} aria-label="減らす">−</button>
            <span className="flex-1 text-center text-[16px] tabular-nums">{h.targetCount}回</span>
            <button type="button" className="h-12 w-12 text-xl text-ink-soft" onClick={() => set({ targetCount: Math.min(30, h.targetCount + 1) })} aria-label="増やす">＋</button>
          </div>
        </Field>
        <Field label="開始日">
          <input type="date" className={inputCls} value={h.startDate} onChange={(e) => set({ startDate: e.target.value || todayKey() })} />
        </Field>
      </div>
      <Field label="メモ">
        <textarea className={`${inputCls} min-h-[72px]`} value={h.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="自分へのひとこと" />
      </Field>
      <Button onClick={save} className="w-full">{isNew ? '追加する' : '保存する'}</Button>
      {!isNew && (
        <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除（記録も消えます）' : 'この習慣を削除'}</Button>
      )}
    </Sheet>
  )
}

/** 習慣ごとの達成履歴（直近の期間をドットで表示） */
function History({ habit, map, restDays }: { habit: Habit; map: LogMap; restDays: Set<string> }) {
  const today = todayKey()
  let cells: { key: string; label: string; done: boolean; due: boolean }[] = []
  if (habit.frequency === 'weekly') {
    const ws = weekStart(today)
    cells = Array.from({ length: 12 }, (_, i) => addDays(ws, -7 * (11 - i))).map((k) => ({ key: k, label: k.slice(5).replace('-', '/'), done: isDone(map, habit, k), due: habit.startDate <= addDays(k, 6) }))
  } else if (habit.frequency === 'monthly') {
    const m = monthKey(today)
    cells = Array.from({ length: 12 }, (_, i) => addMonths(m, -(11 - i))).map((k) => ({ key: k, label: `${Number(k.slice(5))}月`, done: isDone(map, habit, k), due: habit.startDate.slice(0, 7) <= k }))
  } else {
    cells = Array.from({ length: 28 }, (_, i) => addDays(today, -(27 - i))).map((k) => ({ key: k, label: k.slice(8), done: isDone(map, habit, k), due: isDue(habit, k) && !restDays.has(k) }))
  }
  const done = cells.filter((c) => c.done).length
  const s = streak(habit, map, today, restDays)
  const unit = habit.frequency === 'weekly' ? '週' : habit.frequency === 'monthly' ? 'か月' : '日'
  return (
    <div className="mb-5 rounded-3xl bg-white p-4 ring-1 ring-beige/70">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="label-en text-[13px] font-semibold text-ink">History</p>
        <p className="text-[12px] text-ink-soft">継続 <b className="text-sage-deep">{s}</b>{unit} ・ 直近 {done}回</p>
      </div>
      <div className={`grid gap-1.5 ${cells.length > 12 ? 'grid-cols-7' : 'grid-cols-6'}`}>
        {cells.map((c) => (
          <div key={c.key} className="flex flex-col items-center gap-0.5">
            <div className={`h-6 w-6 rounded-full ${c.done ? 'bg-sage' : c.due ? 'bg-cream' : 'bg-transparent ring-1 ring-cream'}`} title={c.key} />
            <span className="text-[9px] text-ink-faint">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 月次：今月・来月の具体的な日付（任意）。決めた月だけ有効で、翌月以降は週の指定に戻る */
function MonthDateField({ h, set }: { h: Habit; set: (p: Partial<Habit>) => void }) {
  const now = monthKey(todayKey())
  const next = addMonths(now, 1)
  const [m, setM] = useState(now)
  const [min, max] = monthRange(m)
  const v = plannedDate(h, m) ?? ''
  const change = (date: string) => {
    const pd = { ...(h.plannedDates ?? {}) }
    if (date) pd[m] = date
    else delete pd[m]
    set({ plannedDates: pd })
  }
  return (
    <Field label="日付（任意・その月だけ）" hint="決まっていなければ空のままで大丈夫です。週が近づいたら HOME からも決められます" group>
      <div className="mb-2 flex gap-2">
        {[now, next].map((k) => (
          <Chip key={k} active={m === k} onClick={() => setM(k)}>{Number(k.slice(5))}月{plannedDate(h, k) ? ' ✓' : ''}</Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="date" className={inputCls} min={min} max={max} value={v} onChange={(e) => change(e.target.value)} aria-label="この月の日付" />
        {v && <Button variant="soft" className="shrink-0 !px-4" onClick={() => change('')}>取消</Button>}
      </div>
    </Field>
  )
}
