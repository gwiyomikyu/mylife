import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Recurring, SavingsGoal, TxType } from '../db/types'
import { Button, Card, Chip, Field, inputCls, SectionTitle, Segmented, Sheet, toast } from '../components/ui'
import { addMonths, monthKey, todayKey } from '../lib/date'
import { applyRecurring } from '../lib/recurring'
import { useCategories, useSettings } from '../lib/store'
import { parseNum, yen } from '../lib/format'

const TYPE_LABEL: Record<TxType, string> = { expense: '支出', income: '収入', saving: '貯金' }
const dayLabel = (d: number) => (d >= 31 ? '月末' : `${d}日`)

export function FixedView() {
  const items = useLiveQuery(() => db.recurring.toArray(), [], [] as Recurring[])
  const cats = useCategories()
  const settings = useSettings()
  const [editing, setEditing] = useState<Recurring | null>(null)
  const catName = useMemo(() => new Map(cats.map((c) => [c.id!, c.name])), [cats])
  const sorted = [...items].sort((a, b) => Number(b.active) - Number(a.active) || a.day - b.day)
  const monthlyExpense = items.filter((r) => r.active && r.type === 'expense').reduce((a, r) => a + r.amount, 0)

  const newItem = (): Recurring => ({
    name: '', type: 'expense', amount: 0, categoryId: cats.find((c) => c.name === '固定費')?.id ?? cats.find((c) => c.type === 'expense')?.id ?? 0,
    day: 25, method: settings.paymentMethods.find((m) => m === '口座振替') ?? '', memo: '', active: true,
    startMonth: monthKey(todayKey()), appliedMonths: [], createdAt: Date.now(),
  })

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle en="Fixed" ja="毎月の自動記録" right={monthlyExpense ? <span className="text-[12px] text-ink-soft">支出 月 {yen(monthlyExpense)}</span> : undefined} />
        <p className="mb-2 text-[12px] leading-relaxed text-ink-faint">登録しておくと、毎月その日に家計簿へ自動で記録されます。記録された明細は、ふつうの記録と同じように編集・削除できます。</p>
        {sorted.length === 0 ? <p className="py-4 text-center text-[13px] text-ink-faint">家賃・通信費・サブスク・給料などを登録してみましょう</p> : (
          <ul className="divide-y divide-cream">
            {sorted.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setEditing(r)} className={`flex w-full items-center gap-3 py-3 text-left ${r.active ? '' : 'opacity-50'}`}>
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-2xl bg-cream text-ink-soft">
                    <span className="text-[9px] leading-none">毎月</span>
                    <span className="text-[13px] font-semibold leading-tight">{r.day >= 31 ? '末' : r.day}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-ink">{r.name}</span>
                    <span className="block truncate text-[11px] text-ink-faint">{TYPE_LABEL[r.type]} · {catName.get(r.categoryId) ?? '—'}{r.method ? ` · ${r.method}` : ''}{r.active ? '' : ' · 停止中'}</span>
                  </span>
                  <span className={`shrink-0 tabular-nums text-[15px] ${r.type === 'income' ? 'text-sage-deep' : 'text-ink'}`}>{r.type === 'income' ? '+' : ''}{yen(r.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Button variant="soft" className="w-full" onClick={() => setEditing(newItem())}>＋ 固定費を追加</Button>
      <FixedEditor item={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function FixedEditor({ item, onClose }: { item: Recurring | null; onClose: () => void }) {
  const cats = useCategories()
  const settings = useSettings()
  const goals = useLiveQuery(() => db.savingsGoals.toArray(), [], [] as SavingsGoal[])
  const [r, setR] = useState<Recurring | null>(item)
  const [amount, setAmount] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => { setR(item); setAmount(item?.amount ? String(item.amount) : ''); setConfirmDel(false) }, [item])
  if (!r) return null
  const isNew = r.id == null
  const set = (p: Partial<Recurring>) => setR({ ...r, ...p })
  const typeCats = cats.filter((c) => c.type === r.type)
  const thisMonth = monthKey(todayKey())

  const save = async () => {
    const n = Math.round(parseNum(amount))
    if (!r.name.trim()) { toast('名前を入力してください'); return }
    if (!n || n <= 0) { toast('金額を入力してください'); return }
    if (!r.categoryId) { toast('カテゴリを選んでください'); return }
    await db.recurring.put({ ...r, name: r.name.trim(), amount: n, goalId: r.type === 'saving' ? r.goalId : undefined })
    const added = await applyRecurring()
    toast(added ? `保存して、${added}件を家計簿に記録しました` : isNew ? '登録しました（記録日に自動で記録されます）' : '保存しました（これからの月に反映されます）')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.recurring.delete(r.id!)
    toast('削除しました（これまでの記録は残ります）')
    onClose()
  }

  return (
    <Sheet open title={isNew ? '固定費を追加' : '固定費を編集'} onClose={onClose}>
      <Segmented value={r.type} className="mb-4" onChange={(type) => set({ type, categoryId: cats.find((c) => c.type === type)?.id ?? 0 })}
        options={[{ value: 'expense', label: '支出' }, { value: 'income', label: '収入' }, { value: 'saving', label: '貯金' }]} />
      <Field label="名前"><input className={inputCls} value={r.name} onChange={(e) => set({ name: e.target.value })} placeholder="例：家賃、スマホ代、Netflix" autoFocus={isNew} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="金額（円）"><input inputMode="numeric" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9０-９,]/g, ''))} placeholder="0" /></Field>
        <Field label="毎月の記録日">
          <select className={inputCls} value={Math.min(r.day, 31)} onChange={(e) => set({ day: Number(e.target.value) })}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}日</option>)}
            <option value={31}>月末</option>
          </select>
        </Field>
      </div>
      <Field label="カテゴリ" group>
        <div className="flex flex-wrap gap-2">{typeCats.map((c) => <Chip key={c.id} active={r.categoryId === c.id} onClick={() => set({ categoryId: c.id! })}>{c.name}</Chip>)}</div>
      </Field>
      {r.type === 'saving' && goals.length > 0 && (
        <Field label="貯金目標（任意）" group>
          <div className="flex flex-wrap gap-2">
            <Chip active={r.goalId == null} onClick={() => set({ goalId: undefined })}>指定しない</Chip>
            {goals.map((g) => <Chip key={g.id} active={r.goalId === g.id} onClick={() => set({ goalId: g.id })}>{g.name}</Chip>)}
          </div>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="支払い方法">
          <select className={inputCls} value={r.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">—</option>
            {settings.paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="メモ"><input className={inputCls} value={r.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="任意" /></Field>
      </div>
      {isNew ? (
        <Field label="いつから記録する？" hint={`今月分は記録日（${dayLabel(r.day)}）を過ぎていれば、すぐに記録されます`} group>
          <div className="flex gap-2">
            <Chip active={r.startMonth === thisMonth} onClick={() => set({ startMonth: thisMonth })}>今月から</Chip>
            <Chip active={r.startMonth === addMonths(thisMonth, 1)} onClick={() => set({ startMonth: addMonths(thisMonth, 1) })}>来月から</Chip>
          </div>
        </Field>
      ) : (
        <label className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-beige">
          <span>
            <span className="block text-[14px] text-ink">自動で記録する</span>
            <span className="block text-[11px] text-ink-faint">オフにすると一時停止（これまでの記録は残ります）</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-sage-dark" checked={r.active} onChange={(e) => set({ active: e.target.checked })} />
        </label>
      )}
      {!isNew && <p className="mb-3 text-[11px] text-ink-faint">金額などの変更は、これから記録される月に反映されます。記録済みの月を直すときは、家計簿の明細から編集してください。</p>}
      <Button onClick={save} className="w-full">{isNew ? '登録する' : '保存する'}</Button>
      {!isNew && <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'この固定費を削除'}</Button>}
    </Sheet>
  )
}
