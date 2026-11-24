import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { SavingsGoal } from '../db/types'
import { Button, Card, Field, inputCls, ProgressBar, Sheet, toast } from '../components/ui'
import { Icon } from '../components/Icon'
import { addMonths, fromKey, monthKey, todayKey } from '../lib/date'
import { parseNum, pct, yen } from '../lib/format'

/** 目標ごとの現在額（登録時の額＋紐づけた貯金の記録） */
export function useGoalProgress() {
  const goals = useLiveQuery(() => db.savingsGoals.toArray(), [], [] as SavingsGoal[])
  const savings = useLiveQuery(() => db.transactions.where('type').equals('saving').toArray(), [], [])
  return useMemo(() => {
    const sum = new Map<number, number>()
    const month = new Map<number, number>()
    const mKey = monthKey(todayKey())
    savings.forEach((t) => {
      if (t.goalId == null) return
      sum.set(t.goalId, (sum.get(t.goalId) ?? 0) + t.amount)
      if (t.date.startsWith(mKey)) month.set(t.goalId, (month.get(t.goalId) ?? 0) + t.amount)
    })
    return goals
      .map((g) => ({ goal: g, current: (g.initialAmount ?? 0) + (sum.get(g.id!) ?? 0), thisMonth: month.get(g.id!) ?? 0 }))
      .sort((a, b) => (a.goal.order ?? a.goal.createdAt) - (b.goal.order ?? b.goal.createdAt))
  }, [goals, savings])
}

/** 貯金の総額（目標に紐づかない貯金も含む） */
function useSavingsTotal() {
  const savings = useLiveQuery(() => db.transactions.where('type').equals('saving').toArray(), [], [])
  return useMemo(() => {
    const mKey = monthKey(todayKey())
    let free = 0, month = 0
    savings.forEach((t) => { if (t.goalId == null) free += t.amount; if (t.date.startsWith(mKey)) month += t.amount })
    return { free, month }
  }, [savings])
}

/** 期限までの残り月数（今月を含む。期限なしは null） */
function monthsLeft(deadline?: string): number | null {
  if (!deadline) return null
  const t = fromKey(todayKey())
  const d = fromKey(deadline)
  return Math.max(1, (d.getFullYear() - t.getFullYear()) * 12 + (d.getMonth() - t.getMonth()) + 1)
}

function deadlineLabel(deadline?: string) {
  if (!deadline) return '期限なし'
  const d = fromKey(deadline)
  const left = monthsLeft(deadline)!
  const past = deadline < todayKey()
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日まで${past ? '（期限を過ぎました）' : `・あと${left}か月`}`
}

export function GoalsView({ onDeposit }: { onDeposit: (g: SavingsGoal) => void }) {
  const rows = useGoalProgress()
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const total = rows.reduce((a, r) => a + r.current, 0)
  const { free, month } = useSavingsTotal()
  const newGoal = (): SavingsGoal => ({ name: '', targetAmount: 0, initialAmount: 0, memo: '', createdAt: Date.now(), order: Date.now() })

  return (
    <div className="space-y-4">
      <Card className="!bg-sage-light/50">
        <p className="text-[12px] text-ink-soft">貯金の総額</p>
        <p className="mt-1 text-[30px] font-semibold tabular-nums text-ink">{yen(total + free)}</p>
        <p className="text-[12px] text-ink-soft">今月の貯金 {yen(month)}</p>
        {(rows.length > 0 || free > 0) && (
          <ul className="mt-3 space-y-1.5 border-t border-sage/20 pt-3 text-[13px]">
            {rows.map(({ goal: g, current }) => (
              <li key={g.id} className="flex justify-between gap-2"><span className="truncate text-ink-soft">{g.name}</span><span className="shrink-0 tabular-nums text-ink">{yen(current)}</span></li>
            ))}
            <li className="flex justify-between gap-2"><span className="text-ink-soft">目標に入れていない貯金</span><span className="shrink-0 tabular-nums text-ink">{yen(free)}</span></li>
          </ul>
        )}
      </Card>
      {rows.length === 0 && (
        <Card>
          <p className="py-2 text-center text-[13px] leading-relaxed text-ink-soft">「何のために・いつまでに・いくら」を<br />いくつでも登録できます。</p>
        </Card>
      )}
      {rows.map(({ goal: g, current, thisMonth }) => {
        const rate = g.targetAmount ? current / g.targetAmount : 0
        const remain = Math.max(0, g.targetAmount - current)
        const done = remain === 0 && g.targetAmount > 0
        return (
          <Card key={g.id}>
            <button type="button" className="block w-full text-left" onClick={() => setEditing(g)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-medium text-ink">{g.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint"><Icon name="calendar" size={11} />{deadlineLabel(g.deadline)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${done ? 'bg-sage text-white' : 'bg-cream text-ink-soft'}`}>{done ? '達成！' : pct(rate)}</span>
              </div>
              <p className="mt-3 text-[24px] font-semibold tabular-nums text-ink">{yen(current)}<span className="ml-1 text-[13px] font-normal text-ink-soft">/ {yen(g.targetAmount)}</span></p>
              <ProgressBar value={rate} className="mt-2" />
              <div className="mt-2 flex justify-between text-[12px] text-ink-soft">
                <span>{done ? '目標金額に届きました' : `あと ${yen(remain)}`}</span>
              </div>
            </button>
            {!done && g.targetAmount > 0 && <GoalPlan goal={g} current={current} thisMonth={thisMonth} onEdit={() => setEditing(g)} />}
            {!done && (
              <button type="button" onClick={() => onDeposit(g)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-2xl bg-cream/70 py-2.5 text-[13px] text-ink">
                <Icon name="plus" size={16} /> この目標に貯金を記録
              </button>
            )}
          </Card>
        )
      })}
      <Button variant="soft" className="w-full" onClick={() => setEditing(newGoal())}>＋ 貯金目標を追加</Button>
      <p className="px-2 text-center text-[11px] leading-relaxed text-ink-faint">家計簿で「貯金」を記録するときに目標を選ぶと、その目標の金額に加算されます。</p>
      <GoalEditor goal={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

const ceil100 = (n: number) => Math.ceil(n / 100) * 100
const mLabel = (mk: string) => `${Number(mk.slice(5))}月`
const ymLabel = (mk: string) => `${mk.slice(0, 4)}年${Number(mk.slice(5))}月`

/** 期限までに毎月いくら入れれば届くか（道のりつき） */
function GoalPlan({ goal: g, current, thisMonth, onEdit }: { goal: SavingsGoal; current: number; thisMonth: number; onEdit: () => void }) {
  const today = todayKey()
  const remain = Math.max(0, g.targetAmount - current)

  if (!g.deadline || g.deadline < today) {
    // 期限なし（または過ぎた）：ペースごとの達成見込み
    const cur = monthKey(today)
    const paces = [3000, 5000, 10000, 20000, 30000, 50000, 100000].filter((a) => remain / a <= 60 && remain / a >= 1).slice(-3)
    return (
      <div className="mt-3 rounded-2xl bg-sage-light/60 p-4">
        <p className="text-[12px] text-ink-soft">{g.deadline ? '期限を過ぎています。期限を決め直すと、毎月の目安を計算します。' : '「いつまでに」を決めると、毎月いくら貯めればいいか計算します。'}</p>
        {paces.length > 0 && (
          <ul className="mt-2 space-y-1">
            {paces.map((a) => (
              <li key={a} className="flex justify-between text-[13px] text-ink">
                <span>毎月 <b className="font-semibold tabular-nums">{yen(a)}</b> なら</span>
                <span className="tabular-nums text-ink-soft">{ymLabel(addMonths(cur, Math.ceil(remain / a) - 1))}に達成</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onEdit} className="mt-2 text-[12px] font-medium text-sage-deep underline underline-offset-2">期限を設定する</button>
      </div>
    )
  }

  const left = monthsLeft(g.deadline)!
  const base = current - thisMonth // 今月の貯金を入れる前の額
  const perMonth = ceil100(Math.max(0, g.targetAmount - base) / left)
  const thisLeft = Math.max(0, perMonth - thisMonth)
  const cur = monthKey(today)
  const months = Array.from({ length: left }, (_, i) => addMonths(cur, i))
  const label = (i: number) => left <= 8 || i === 0 || i === left - 1 || (left <= 14 && i % 2 === 0)

  return (
    <div className="mt-3 rounded-2xl bg-sage-light/60 p-4">
      <p className="text-[12px] text-ink-soft">期限までに届くには</p>
      <p className="mt-0.5 flex items-baseline gap-1.5 text-ink">
        <span className="text-[14px]">毎月</span>
        <span className="text-[30px] font-semibold leading-tight tabular-nums text-sage-deep">{yen(perMonth)}</span>
      </p>
      <p className="text-[12px] text-ink-soft">
        あと <b className="font-semibold text-ink">{left}か月</b>（{left === 1 ? `${mLabel(cur)}中` : `${mLabel(cur)}〜${left > 12 ? ymLabel(months[left - 1]) : mLabel(months[left - 1])}`}）
      </p>

      <div className="mt-3 rounded-xl bg-white/70 p-3">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="text-ink-soft">今月の分</span>
          <span className="tabular-nums text-ink">{yen(thisMonth)} <span className="text-ink-faint">/ {yen(perMonth)}</span></span>
        </div>
        <ProgressBar value={perMonth ? thisMonth / perMonth : 1} className="mt-1.5" />
        <p className="mt-1.5 text-[12px] text-ink-soft">{thisLeft > 0 ? `今月はあと ${yen(thisLeft)} 入れればOK` : '今月の分は入れられました ✓'}</p>
      </div>

      {left > 1 && (
        <div className="mt-3" aria-label="月ごとの道のり">
          <p className="mb-1.5 text-[11px] text-ink-soft">月ごとの道のり（この額ずつ入れたとき）</p>
          <div className="relative flex h-20 items-end gap-[3px] border-t border-dashed border-sage-dark/40 pt-0">
            <span className="absolute -top-2 right-0 bg-transparent text-[9px] text-sage-deep">目標 {yen(g.targetAmount)}</span>
            {months.map((mk, i) => {
              const plan = Math.min(g.targetAmount, base + perMonth * (i + 1))
              const h = (plan / g.targetAmount) * 100
              const actual = i === 0 ? Math.min(current, plan) : 0
              return (
                <div key={mk} className="relative flex h-full flex-1 items-end" title={`${ymLabel(mk)}末：${yen(plan)}`}>
                  <div className="relative w-full overflow-hidden rounded-t-[4px] bg-sage/35" style={{ height: `${h}%` }}>
                    {actual > 0 && <div className="absolute inset-x-0 bottom-0 bg-sage" style={{ height: `${(actual / plan) * 100}%` }} />}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-[3px]">
            {months.map((mk, i) => (
              <span key={mk} className={`flex-1 whitespace-nowrap text-center text-[9px] ${i === 0 ? 'font-medium text-ink' : 'text-ink-faint'}`}>{label(i) ? (i === 0 ? '今月' : mLabel(mk)) : ''}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GoalEditor({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const [g, setG] = useState<SavingsGoal | null>(goal)
  const [target, setTarget] = useState('')
  const [initial, setInitial] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => {
    setG(goal); setConfirmDel(false)
    setTarget(goal?.targetAmount ? String(goal.targetAmount) : '')
    setInitial(goal?.initialAmount ? String(goal.initialAmount) : '')
  }, [goal])
  if (!g) return null
  const isNew = g.id == null
  const set = (p: Partial<SavingsGoal>) => setG({ ...g, ...p })
  const num = (s: string) => s.replace(/[^0-9０-９,]/g, '')
  const save = async () => {
    const t = Math.round(parseNum(target))
    if (!g.name.trim()) { toast('何のための貯金か入力してください'); return }
    if (!t || t <= 0) { toast('目標金額を入力してください'); return }
    const i = initial.trim() ? Math.round(parseNum(initial)) || 0 : 0
    await db.savingsGoals.put({ ...g, name: g.name.trim(), targetAmount: t, initialAmount: i })
    toast(isNew ? '貯金目標を追加しました' : '保存しました')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.transaction('rw', db.savingsGoals, db.transactions, async () => {
      await db.transactions.where('goalId').equals(g.id!).modify({ goalId: undefined })
      await db.savingsGoals.delete(g.id!)
    })
    toast('目標を削除しました（家計簿の記録は残ります）')
    onClose()
  }
  return (
    <Sheet open title={isNew ? '貯金目標を追加' : '貯金目標を編集'} onClose={onClose}>
      <Field label="何のため？"><input className={inputCls} value={g.name} onChange={(e) => set({ name: e.target.value })} placeholder="例：韓国旅行、引っ越し資金" autoFocus={isNew} /></Field>
      <Field label="目標金額（円）"><input inputMode="numeric" className={inputCls} value={target} onChange={(e) => setTarget(num(e.target.value))} placeholder="300000" /></Field>
      <Field label="いつまでに（任意）"><input type="date" className={inputCls} value={g.deadline ?? ''} onChange={(e) => set({ deadline: e.target.value || undefined })} /></Field>
      <Field label="現時点で貯まっている額（円）" hint="ここから先は、家計簿で「貯金」を記録するときにこの目標を選ぶと加算されます">
        <input inputMode="numeric" className={inputCls} value={initial} onChange={(e) => setInitial(num(e.target.value))} placeholder="0" />
      </Field>
      <Field label="メモ"><input className={inputCls} value={g.memo ?? ''} onChange={(e) => set({ memo: e.target.value })} placeholder="任意" /></Field>
      <Button onClick={save} className="w-full">{isNew ? '追加する' : '保存する'}</Button>
      {!isNew && <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'この目標を削除'}</Button>}
    </Sheet>
  )
}
