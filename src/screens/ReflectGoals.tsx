import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { GoalHorizon, Habit, LifeGoal } from '../db/types'
import { Button, Card, Chip, Field, inputCls, ProgressBar, Sheet, toast } from '../components/ui'
import { Icon } from '../components/Icon'
import { addDays, formatJa, fromKey, toKey, todayKey, weekDays } from '../lib/date'
import { isDone, isDue, periodKeyFor, scopeOf, type LogMap } from '../lib/habits'
import { useHabits, useLogMap } from '../lib/store'

export const HORIZONS: { value: GoalHorizon; label: string; months: number; long: boolean }[] = [
  { value: '5y', label: '5年後', months: 60, long: true },
  { value: '3y', label: '3年後', months: 36, long: true },
  { value: '1y', label: '1年後', months: 12, long: true },
  { value: '6m', label: '半年', months: 6, long: false },
  { value: '3m', label: '3か月', months: 3, long: false },
  { value: '1m', label: '1か月', months: 1, long: false },
]
const H = Object.fromEntries(HORIZONS.map((h) => [h.value, h])) as Record<GoalHorizon, (typeof HORIZONS)[number]>
const rank = (g: LifeGoal) => HORIZONS.findIndex((h) => h.value === g.horizon)

const defaultDeadline = (h: GoalHorizon) => {
  const d = fromKey(todayKey())
  return toKey(new Date(d.getFullYear(), d.getMonth() + H[h].months, d.getDate()))
}

function leftLabel(deadline?: string) {
  if (!deadline) return ''
  const t = fromKey(todayKey()), d = fromKey(deadline)
  const months = (d.getFullYear() - t.getFullYear()) * 12 + d.getMonth() - t.getMonth()
  const date = `${d.getFullYear()}年${d.getMonth() + 1}月`
  if (deadline < todayKey()) return `${date}まで（期限を過ぎました）`
  if (months >= 24) return `${date}まで・あと${Math.floor(months / 12)}年${months % 12 ? `${months % 12}か月` : ''}`
  if (months >= 1) return `${date}まで・あと${months}か月`
  const days = Math.round((d.getTime() - t.getTime()) / 864e5)
  return `${date}${d.getDate()}日まで・あと${days}日`
}

/** 習慣の今週の達成（日次は今週の対象日のうち何日、週次・月次はできたか） */
function habitWeek(h: Habit, map: LogMap, today: string) {
  const s = scopeOf(h)
  if (s === 'daily') {
    const days = weekDays(today).filter((k) => k <= today && isDue(h, k))
    return { done: days.filter((k) => isDone(map, h, k)).length, total: days.length, unit: '今週' }
  }
  const ok = isDone(map, h, periodKeyFor(h, today))
  return { done: ok ? 1 : 0, total: 1, unit: s === 'weekly' ? '今週' : '今月' }
}

const newGoal = (horizon: GoalHorizon, parentId?: number): LifeGoal => ({
  horizon, title: '', why: '', deadline: defaultDeadline(horizon), progress: 0, now: '', next: '', steps: [], parentId, habitIds: [],
  checkins: [], order: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
})

export function GoalsMap() {
  const today = todayKey()
  const goals = useLiveQuery(() => db.lifeGoals.toArray(), [], [] as LifeGoal[])
  const habits = useHabits()
  const map = useLogMap(addDays(today, -40), today)
  const [editing, setEditing] = useState<LifeGoal | null>(null)
  const [showDone, setShowDone] = useState(false)

  const active = goals.filter((g) => !g.achievedAt).sort((a, b) => rank(a) - rank(b) || a.order - b.order)
  const done = goals.filter((g) => g.achievedAt).sort((a, b) => b.achievedAt! - a.achievedAt!)
  const ids = new Set(active.map((g) => g.id))
  const roots = active.filter((g) => g.parentId == null || !ids.has(g.parentId))
  const longRoots = roots.filter((g) => H[g.horizon].long)
  const shortRoots = roots.filter((g) => !H[g.horizon].long)
  const childrenOf = (id: number) => active.filter((g) => g.parentId === id)
  const habitMap = useMemo(() => new Map(habits.map((h) => [h.id!, h])), [habits])

  const Node = ({ g, depth }: { g: LifeGoal; depth: number }) => {
    const kids = childrenOf(g.id!)
    const stepsDone = g.steps.filter((s) => s.done).length
    const nextStep = g.steps.find((s) => !s.done)
    const lastCheck = g.checkins[g.checkins.length - 1]
    const linked = g.habitIds.map((id) => habitMap.get(id)).filter(Boolean) as Habit[]
    return (
      <div className={depth ? 'relative ml-3 border-l-2 border-sage/30 pl-3' : ''}>
        <button type="button" onClick={() => setEditing(g)} className={`block w-full text-left ${depth ? 'rounded-2xl bg-white/90 p-4 ring-1 ring-beige' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${H[g.horizon].long ? 'bg-sage-dark text-white' : 'bg-sage-light text-sage-deep'}`}>{H[g.horizon].label}</span>
              <p className={`mt-1 font-medium text-ink ${depth ? 'text-[15px]' : 'text-[17px]'}`}>{g.title}</p>
              {g.deadline && <p className="mt-0.5 text-[11px] text-ink-faint">{leftLabel(g.deadline)}</p>}
            </div>
            <span className="shrink-0 text-[18px] font-semibold tabular-nums text-ink">{g.progress}<span className="text-[11px] font-normal text-ink-soft">%</span></span>
          </div>
          <ProgressBar value={g.progress / 100} className="mt-2" />
          {(g.now || nextStep || g.next) && (
            <div className="mt-3 space-y-1.5 text-[12px] leading-relaxed">
              {g.now && <p className="line-clamp-2 text-ink-soft"><span className="mr-1.5 rounded bg-cream px-1.5 py-0.5 text-[10px] text-ink-soft">いま</span>{g.now}</p>}
              {nextStep ? <p className="line-clamp-2 text-ink"><span className="mr-1.5 rounded bg-sage-light px-1.5 py-0.5 text-[10px] text-sage-deep">つぎ</span>{nextStep.text}<span className="ml-1 text-ink-faint">（{stepsDone}/{g.steps.length}）</span></p>
                : g.next && <p className="line-clamp-2 text-ink"><span className="mr-1.5 rounded bg-sage-light px-1.5 py-0.5 text-[10px] text-sage-deep">これから</span>{g.next}</p>}
            </div>
          )}
          {linked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {linked.map((h) => {
                const w = habitWeek(h, map, today)
                return (
                  <span key={h.id} className="flex items-center gap-1 rounded-full bg-cream/80 px-2.5 py-1 text-[11px] text-ink-soft">
                    <Icon name="habits" size={12} />{h.name}<span className="tabular-nums text-ink-faint">{w.unit} {w.done}/{w.total}</span>
                  </span>
                )
              })}
            </div>
          )}
          <p className="mt-2 text-[10px] text-ink-faint">{lastCheck ? `最後の見直し：${formatJa(lastCheck.date)}` : 'まだ見直しの記録はありません'}</p>
        </button>
        {kids.length > 0 && <div className="mt-3 space-y-3">{kids.map((k) => <Node key={k.id} g={k} depth={depth + 1} />)}</div>}
        {H[g.horizon].long && depth === 0 && (
          <button type="button" onClick={() => setEditing(newGoal(g.horizon === '5y' ? '1y' : g.horizon === '3y' ? '1y' : '3m', g.id))}
            className="ml-3 mt-3 flex items-center gap-1 pl-3 text-[12px] text-sage-deep">
            <Icon name="plus" size={14} />この目標につながる目標を追加
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="!bg-sage-light/50">
        <p className="text-[13px] leading-relaxed text-ink">
          遠い目標から、いまの習慣まで。<br />
          <span className="text-[12px] text-ink-soft">長期の目標の下に短期の目標をつなげ、さらに日々の習慣をひもづけると、毎日の行動がどこに向かっているかが見えます。</span>
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-soft">
          <span className="rounded-full bg-sage-dark px-2 py-0.5 text-white">5年後・1年後</span><Icon name="chevR" size={12} />
          <span className="rounded-full bg-sage-light px-2 py-0.5 text-sage-deep">3か月・1か月</span><Icon name="chevR" size={12} />
          <span className="rounded-full bg-cream px-2 py-0.5">毎日の習慣</span>
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="label-en text-[14px] font-semibold text-ink">Long term <span className="ml-1 text-[11px] font-normal normal-case tracking-normal text-ink-faint">長期の目標</span></h2>
          <button type="button" onClick={() => setEditing(newGoal('1y'))} className="flex items-center gap-0.5 rounded-full bg-cream px-3 py-1 text-[12px] text-ink-soft"><Icon name="plus" size={14} />追加</button>
        </div>
        {longRoots.length === 0 ? (
          <Card><button type="button" onClick={() => setEditing(newGoal('5y'))} className="w-full py-2 text-center text-[13px] leading-relaxed text-ink-soft">「5年後こうなっていたい」「1年後にはこれを」<br />まずはひとつ書いてみましょう</button></Card>
        ) : longRoots.map((g) => <Card key={g.id}><Node g={g} depth={0} /></Card>)}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="label-en text-[14px] font-semibold text-ink">Short term <span className="ml-1 text-[11px] font-normal normal-case tracking-normal text-ink-faint">短期の目標</span></h2>
          <button type="button" onClick={() => setEditing(newGoal('3m'))} className="flex items-center gap-0.5 rounded-full bg-cream px-3 py-1 text-[12px] text-ink-soft"><Icon name="plus" size={14} />追加</button>
        </div>
        {shortRoots.length === 0 ? (
          <p className="px-2 text-[12px] text-ink-faint">長期の目標につなげた短期の目標は、上の長期の目標の中に表示されます。</p>
        ) : shortRoots.map((g) => <Card key={g.id}><Node g={g} depth={0} /></Card>)}
      </section>

      {done.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone(!showDone)} className="flex w-full items-center justify-between px-1 text-[12px] text-ink-soft">
            <span>達成した目標（{done.length}）</span><Icon name={showDone ? 'chevL' : 'chevR'} size={14} className={showDone ? '-rotate-90' : ''} />
          </button>
          {showDone && (
            <ul className="mt-2 space-y-2">
              {done.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => setEditing(g)} className="flex w-full items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-left ring-1 ring-beige">
                    <Icon name="check" size={16} className="text-sage-dark" />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{g.title}</span>
                    <span className="text-[11px] text-ink-faint">{H[g.horizon].label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <GoalEditor goal={editing} onClose={() => setEditing(null)} goals={goals} habits={habits} />
    </div>
  )
}

function GoalEditor({ goal, onClose, goals, habits }: { goal: LifeGoal | null; onClose: () => void; goals: LifeGoal[]; habits: Habit[] }) {
  const [g, setG] = useState<LifeGoal | null>(goal)
  const [stepText, setStepText] = useState('')
  const [checkNote, setCheckNote] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => { setG(goal); setStepText(''); setCheckNote(''); setConfirmDel(false) }, [goal])
  if (!g) return null
  const isNew = g.id == null
  const set = (p: Partial<LifeGoal>) => setG({ ...g, ...p })
  const myRank = HORIZONS.findIndex((h) => h.value === g.horizon)
  const parents = goals.filter((p) => p.id !== g.id && !p.achievedAt && HORIZONS.findIndex((h) => h.value === p.horizon) < myRank)

  const write = async (row: LifeGoal) => {
    const r = { ...row, title: row.title.trim(), updatedAt: Date.now() }
    if (r.id == null) { const id = await db.lifeGoals.add(r); return { ...r, id } }
    await db.lifeGoals.put(r)
    return r
  }
  const save = async () => {
    if (!g.title.trim()) { toast('目標を入力してください'); return }
    await write(g)
    toast(isNew ? '目標を追加しました' : '保存しました')
    onClose()
  }
  const addStep = () => { const t = stepText.trim(); if (!t) return; set({ steps: [...g.steps, { text: t, done: false }] }); setStepText('') }
  const checkin = async () => {
    if (!g.title.trim()) { toast('目標を入力してください'); return }
    const note = checkNote.trim() || g.now.trim()
    const row = { ...g, checkins: [...g.checkins, { date: todayKey(), progress: g.progress, note }] }
    const saved = await write(row)
    setG(saved); setCheckNote('')
    toast('いまの地点を記録しました')
  }
  const toggleAchieved = async () => {
    const row = { ...g, achievedAt: g.achievedAt ? undefined : Date.now(), progress: g.achievedAt ? g.progress : 100 }
    if (!row.title.trim()) return
    await write(row)
    toast(row.achievedAt ? 'おめでとう！達成にしました' : '進行中に戻しました')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.transaction('rw', db.lifeGoals, async () => {
      await db.lifeGoals.where('parentId').equals(g.id!).modify({ parentId: undefined })
      await db.lifeGoals.delete(g.id!)
    })
    toast('削除しました'); onClose()
  }

  return (
    <Sheet open title={isNew ? '目標を追加' : '目標'} onClose={onClose}>
      <Field label="いつまでの目標？" group>
        <div className="flex flex-wrap gap-2">
          {HORIZONS.map((h) => <Chip key={h.value} active={g.horizon === h.value} onClick={() => set({ horizon: h.value, deadline: isNew ? defaultDeadline(h.value) : g.deadline })}>{h.label}</Chip>)}
        </div>
      </Field>
      <Field label="目標"><input className={inputCls} value={g.title} onChange={(e) => set({ title: e.target.value })} placeholder={H[g.horizon].long ? '例：自分のペースで働ける仕事をしている' : '例：資格の勉強を毎週3時間'} /></Field>
      <Field label="なぜ・なりたい姿（任意）"><textarea rows={2} className={`${inputCls} resize-none`} value={g.why} onChange={(e) => set({ why: e.target.value })} /></Field>
      <Field label="期限（任意）"><input type="date" className={inputCls} value={g.deadline ?? ''} onChange={(e) => set({ deadline: e.target.value || undefined })} /></Field>

      <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-beige">
        <p className="mb-2 text-[13px] font-medium text-ink">いまの地点</p>
        <label className="block">
          <span className="flex items-center justify-between text-[12px] text-ink-soft"><span>進み具合（自分の感覚で）</span><span className="text-[16px] font-semibold tabular-nums text-ink">{g.progress}%</span></span>
          <input type="range" min={0} max={100} step={5} value={g.progress} onChange={(e) => set({ progress: Number(e.target.value) })} className="mt-2 w-full accent-[rgb(var(--c-sagedark))]" aria-label="進み具合" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[12px] text-ink-soft">現在地：いまどこにいる？</span>
          <textarea rows={3} className={`${inputCls} resize-none`} value={g.now} onChange={(e) => set({ now: e.target.value })} placeholder="できていること・足りないこと・気づいたこと" />
        </label>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-beige">
        <p className="mb-2 text-[13px] font-medium text-ink">これからどうする</p>
        <textarea rows={3} className={`${inputCls} resize-none`} value={g.next} onChange={(e) => set({ next: e.target.value })} placeholder="方針や、やってみたいこと" aria-label="これからどうする" />
        <p className="mb-1.5 mt-3 text-[12px] text-ink-soft">次のステップ</p>
        <ul className="space-y-1">
          {g.steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <button type="button" aria-pressed={s.done} aria-label={`${s.text}を${s.done ? '未完了に戻す' : '完了にする'}`}
                onClick={() => set({ steps: g.steps.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${s.done ? 'border-sage bg-sage text-white' : 'border-greige'}`}>
                {s.done && <Icon name="check" size={13} strokeWidth={2.4} />}
              </button>
              <span className={`min-w-0 flex-1 text-[14px] ${s.done ? 'text-ink-faint line-through' : 'text-ink'}`}>{s.text}</span>
              <button type="button" aria-label={`${s.text}を削除`} onClick={() => set({ steps: g.steps.filter((_, j) => j !== i) })} className="p-1 text-ink-faint"><Icon name="close" size={15} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input className={`${inputCls} !py-2.5`} value={stepText} onChange={(e) => setStepText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStep()} placeholder="例：説明会に申し込む" aria-label="次のステップを追加" />
          <Button variant="soft" onClick={addStep} className="shrink-0 !px-4 !py-2.5">追加</Button>
        </div>
      </div>

      {parents.length > 0 && (
        <Field label="つながる長期の目標（任意）" group>
          <div className="flex flex-wrap gap-2">
            <Chip active={g.parentId == null} onClick={() => set({ parentId: undefined })}>なし</Chip>
            {parents.map((p) => <Chip key={p.id} active={g.parentId === p.id} onClick={() => set({ parentId: p.id })}>{H[p.horizon].label}：{p.title}</Chip>)}
          </div>
        </Field>
      )}
      {habits.length > 0 && (
        <Field label="つながる習慣（任意・いくつでも）" group>
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => {
              const on = g.habitIds.includes(h.id!)
              return <Chip key={h.id} active={on} onClick={() => set({ habitIds: on ? g.habitIds.filter((x) => x !== h.id) : [...g.habitIds, h.id!] })}>{h.name}</Chip>
            })}
          </div>
        </Field>
      )}

      <Button onClick={save} className="w-full">{isNew ? '追加する' : '保存する'}</Button>

      {!isNew && (
        <div className="mt-5 rounded-2xl bg-cream/70 p-4">
          <p className="text-[13px] font-medium text-ink">見直しの記録</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">ときどき「いまの地点」を記録しておくと、あとで道のりを振り返れます。</p>
          <div className="mt-2 flex gap-2">
            <input className={`${inputCls} !py-2.5`} value={checkNote} onChange={(e) => setCheckNote(e.target.value)} placeholder="ひとこと（空なら現在地を記録）" aria-label="見直しのひとこと" />
            <Button variant="soft" onClick={checkin} className="shrink-0 !bg-white !px-4 !py-2.5">記録</Button>
          </div>
          {g.checkins.length > 0 && (
            <ul className="mt-3 space-y-2">
              {[...g.checkins].reverse().map((c, i) => (
                <li key={i} className="text-[12px]">
                  <span className="flex justify-between text-ink-soft"><span>{formatJa(c.date)}</span><span className="tabular-nums text-ink">{c.progress}%</span></span>
                  {c.note && <span className="block whitespace-pre-wrap text-ink">{c.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isNew && (
        <>
          <Button variant="soft" onClick={toggleAchieved} className="mt-4 w-full">{g.achievedAt ? '進行中に戻す' : '達成した！'}</Button>
          <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'この目標を削除'}</Button>
        </>
      )}
    </Sheet>
  )
}
