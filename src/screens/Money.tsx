import { useEffect, useMemo, useState } from 'react'
import { db, saveSettings } from '../db/db'
import type { Category, Transaction, TxType } from '../db/types'
import { Button, Card, Chip, Empty, Fab, Field, IconButton, inputCls, PageHeader, ProgressBar, SectionTitle, Segmented, Sheet, Stat, toast } from '../components/ui'
import { addMonths, formatJa, formatMonthJa, monthKey, todayKey } from '../lib/date'
import { categoryBudget, moneySummary, useCategories, useMonthTx, useSettings } from '../lib/store'
import { parseNum, pct, yen, yenSigned } from '../lib/format'
import { useLiveQuery } from 'dexie-react-hooks'
import type { SavingsGoal } from '../db/types'
import { GoalsView } from './MoneyGoals'
import { FixedView } from './MoneyFixed'
import { ChartsView } from './MoneyCharts'

const TYPE_LABEL: Record<TxType, string> = { expense: '支出', income: '収入', saving: '貯金' }

export default function Money() {
  const [mKey, setMKey] = useState(monthKey(todayKey()))
  const [view, setView] = useState<'book' | 'charts' | 'goals' | 'fixed'>('book')
  const [budgetOpen, setBudgetOpen] = useState(false)
  const goals = useLiveQuery(() => db.savingsGoals.toArray(), [], [] as SavingsGoal[])
  const [editing, setEditing] = useState<Transaction | null>(null)
  const settings = useSettings()
  const tx = useMonthTx(mKey)
  const cats = useCategories()
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id!, c])), [cats])
  const s = moneySummary(tx, 0)
  const budget = categoryBudget(tx, cats)
  const isNow = mKey === monthKey(todayKey())

  const byCat = useMemo(() => {
    const m = new Map<number, number>()
    tx.filter((t) => t.type === 'expense').forEach((t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount))
    cats.forEach((c) => { if (c.type === 'expense' && c.budget && !m.has(c.id!)) m.set(c.id!, 0) })
    return [...m.entries()].sort((a, b) => b[1] - a[1] || (catMap.get(b[0])?.budget ?? 0) - (catMap.get(a[0])?.budget ?? 0))
  }, [tx, cats, catMap])

  const grouped = useMemo(() => {
    const g = new Map<string, Transaction[]>()
    ;[...tx].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).forEach((t) => {
      g.set(t.date, [...(g.get(t.date) ?? []), t])
    })
    return [...g.entries()]
  }, [tx])

  const newTx = (): Transaction => ({
    date: isNow ? todayKey() : `${mKey}-01`, type: 'expense', amount: 0,
    categoryId: cats.find((c) => c.type === 'expense')?.id ?? 0, method: settings.paymentMethods[0] ?? '', memo: '', createdAt: Date.now(),
  })

  return (
    <div>
      <PageHeader en="Money" ja="家計簿" />
      <div className="space-y-4 px-4">
        <Segmented value={view} onChange={setView} options={[{ value: 'book', label: '家計簿' }, { value: 'charts', label: 'グラフ' }, { value: 'goals', label: '貯金目標' }, { value: 'fixed', label: '固定費' }]} />
        {view === 'charts' && <ChartsView />}
        {view === 'goals' && <GoalsView onDeposit={(g) => setEditing({ ...newTx(), type: 'saving', categoryId: cats.find((c) => c.type === 'saving')?.id ?? 0, goalId: g.id, date: todayKey() })} />}
        {view === 'fixed' && <FixedView />}
        {view === 'book' && (<>
        <div className="flex items-center justify-between">
          <IconButton name="chevL" label="前の月" onClick={() => setMKey(addMonths(mKey, -1))} />
          <div className="text-center">
            <p className="text-[15px] font-medium">{formatMonthJa(mKey)}</p>
            {!isNow && <button type="button" onClick={() => setMKey(monthKey(todayKey()))} className="text-[11px] text-sage-dark">今月に戻る</button>}
          </div>
          <IconButton name="chevR" label="次の月" onClick={() => setMKey(addMonths(mKey, 1))} />
        </div>

        <Card>
          <p className="text-[12px] text-ink-faint">収支差額（収入 − 支出）</p>
          <p className="mt-1 text-[32px] font-semibold tabular-nums text-ink">{yenSigned(s.balance)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="収入" value={yen(s.income)} />
            <Stat label="支出" value={yen(s.expense)} />
            <Stat label="貯金" value={yen(s.saving)} />
          </div>
        </Card>

        <Card>
          <SectionTitle en="Budget" ja="カテゴリ別の予算" right={budget.total > 0 ? <span className="text-[12px] text-ink-soft">合計 {yen(budget.total)}</span> : undefined} />
          {budget.total > 0 ? (<>
            <div className="flex items-end justify-between">
              <Stat label="予算の残り" value={yen(budget.left)} sub={`予算を決めた${budget.count}カテゴリの合計`} />
              <span className="text-[13px] tabular-nums text-ink-soft">{pct(budget.rate)} 使用</span>
            </div>
            <ProgressBar value={budget.rate} tone={budget.rate > 0.85 ? 'clay' : 'sage'} className="mt-3" />
            {budget.rate >= 0.85 && <p className="mt-2 text-[12px] text-ink-soft">予算の{budget.rate >= 1 ? '上限に達しました' : '85%を超えました'}。残りの日をゆるやかに調整してみましょう。</p>}
          </>) : <p className="text-[12px] leading-relaxed text-ink-soft">カテゴリごとに予算を決めると、ここに残りが表示されます。</p>}
          {byCat.length > 0 && (
            <ul className="mt-5 space-y-3">
              {byCat.map(([cid, amt]) => {
                const b = catMap.get(cid)?.budget
                const over = b ? amt / b : 0
                return (
                  <li key={cid}>
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="truncate text-ink">{catMap.get(cid)?.name ?? '不明'}</span>
                      <span className="shrink-0 tabular-nums text-ink-soft">{yen(amt)}{b ? <span className="text-ink-faint"> / {yen(b)}</span> : null}</span>
                    </div>
                    <ProgressBar value={b ? over : s.expense ? amt / s.expense : 0} tone={b && over >= 1 ? 'clay' : 'sage'} className="mt-1 !h-1.5" />
                    {b ? <p className="mt-0.5 text-right text-[11px] text-ink-faint">{amt <= b ? `あと ${yen(b - amt)}` : `予算より ${yen(amt - b)} 多め`}</p> : null}
                  </li>
                )
              })}
            </ul>
          )}
          <button type="button" onClick={() => setBudgetOpen(true)} className="mt-4 flex w-full items-center justify-center gap-1 rounded-2xl bg-cream/70 py-2.5 text-[13px] text-ink">
            カテゴリ別の予算を設定
          </button>
        </Card>

        <Card>
          <SectionTitle en="History" ja="明細" />
          {grouped.length === 0 ? <Empty>この月の記録はまだありません</Empty> : grouped.map(([date, rows]) => (
            <div key={date} className="mb-3 last:mb-0">
              <p className="mb-1 text-[11px] text-ink-faint">{formatJa(date)}</p>
              <ul className="divide-y divide-cream">
                {rows.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setEditing(t)} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${t.type === 'income' ? 'bg-sage-light text-sage-deep' : t.type === 'saving' ? 'bg-beige text-ink-soft' : 'bg-cream text-ink-soft'}`}>{TYPE_LABEL[t.type]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-ink">{catMap.get(t.categoryId)?.name ?? '—'}</span>
                        {(t.memo || t.method || t.recurringId || t.goalId) && (
                          <span className="flex items-center gap-1 truncate text-[11px] text-ink-faint">
                            {t.recurringId != null && <span className="shrink-0 rounded-full bg-cream px-1.5">毎月</span>}
                            {t.goalId != null && <span className="shrink-0 rounded-full bg-sage-light px-1.5 text-sage-deep">{goals.find((g) => g.id === t.goalId)?.name ?? '目標'}</span>}
                            <span className="truncate">{[t.method, t.memo].filter(Boolean).join(' ・ ')}</span>
                          </span>
                        )}
                      </span>
                      <span className={`tabular-nums text-[15px] ${t.type === 'income' ? 'text-sage-deep' : 'text-ink'}`}>{t.type === 'income' ? '+' : ''}{yen(t.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
        </>)}
      </div>
      {view === 'book' && <Fab label="収支を記録" onClick={() => setEditing(newTx())} />}
      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} cats={cats.filter((c) => c.type === 'expense')} />
      <MoneyInput tx={editing} onClose={() => setEditing(null)} cats={cats} methods={settings.paymentMethods} goals={goals} />
    </div>
  )
}

function MoneyInput({ tx, onClose, cats, methods, goals }: { tx: Transaction | null; onClose: () => void; cats: Category[]; methods: string[]; goals: SavingsGoal[] }) {
  const [t, setT] = useState<Transaction | null>(tx)
  const [amount, setAmount] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => { setT(tx); setAmount(tx && tx.amount ? String(tx.amount) : ''); setConfirmDel(false) }, [tx])
  if (!t) return null
  const isNew = t.id == null
  const set = (p: Partial<Transaction>) => setT({ ...t, ...p })
  const typeCats = cats.filter((c) => c.type === t.type)

  const changeType = (type: TxType) => set({ type, categoryId: cats.find((c) => c.type === type)?.id ?? 0, goalId: type === 'saving' ? t.goalId : undefined })

  const save = async () => {
    const n = Math.round(parseNum(amount))
    if (!n || n < 0) { toast('金額を入力してください'); return }
    if (!t.categoryId) { toast('カテゴリを選んでください'); return }
    const row = { ...t, amount: n }
    if (isNew) await db.transactions.add(row)
    else await db.transactions.put(row)
    toast(isNew ? `${TYPE_LABEL[t.type]}を記録しました` : '保存しました')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.transactions.delete(t.id!)
    toast('削除しました')
    onClose()
  }

  return (
    <Sheet open title={isNew ? '収支を記録' : '記録を編集'} onClose={onClose}>
      <Segmented value={t.type} onChange={changeType} className="mb-4"
        options={[{ value: 'expense', label: '支出' }, { value: 'income', label: '収入' }, { value: 'saving', label: '貯金' }]} />
      <div className="mb-4 flex items-baseline rounded-3xl bg-white px-5 py-4 ring-1 ring-beige focus-within:ring-sage">
        <span className="text-[22px] text-ink-soft">¥</span>
        <input aria-label="金額" inputMode="numeric" pattern="[0-9]*" className="w-full bg-transparent pl-2 text-[34px] font-semibold tabular-nums outline-none placeholder:text-greige"
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9０-９,]/g, ''))} placeholder="0" autoFocus={isNew} />
      </div>
      <Field label="カテゴリ" group>
        <div className="flex flex-wrap gap-2">
          {typeCats.map((c) => <Chip key={c.id} active={t.categoryId === c.id} onClick={() => set({ categoryId: c.id! })}>{c.name}</Chip>)}
        </div>
      </Field>
      {t.type === 'saving' && goals.length > 0 && (
        <Field label="どの貯金目標に入れる？（任意）" group>
          <div className="flex flex-wrap gap-2">
            <Chip active={t.goalId == null} onClick={() => set({ goalId: undefined })}>指定しない</Chip>
            {goals.map((g) => <Chip key={g.id} active={t.goalId === g.id} onClick={() => set({ goalId: g.id })}>{g.name}</Chip>)}
          </div>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="日付">
          <input type="date" className={inputCls} value={t.date} onChange={(e) => set({ date: e.target.value || todayKey() })} />
        </Field>
        <Field label="支払い方法">
          <select className={inputCls} value={t.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">—</option>
            {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="メモ">
        <input className={inputCls} value={t.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="任意" />
      </Field>
      <Button onClick={save} className="w-full">{isNew ? '記録する' : '保存する'}</Button>
      {!isNew && <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'この記録を削除'}</Button>}
    </Sheet>
  )
}

function BudgetSheet({ open, onClose, cats }: { open: boolean; onClose: () => void; cats: Category[] }) {
  const [vals, setVals] = useState<Record<number, string>>({})
  useEffect(() => {
    if (!open) return
    setVals(Object.fromEntries(cats.map((c) => [c.id!, c.budget ? String(c.budget) : ''])))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const sum = Object.values(vals).reduce((a, v) => a + (Math.round(parseNum(v)) || 0), 0)
  const save = async () => {
    await db.transaction('rw', db.categories, async () => {
      for (const c of cats) {
        const n = Math.round(parseNum(vals[c.id!] ?? ''))
        await db.categories.update(c.id!, { budget: n > 0 ? n : undefined })
      }
    })
    toast('予算を保存しました')
    onClose()
  }
  return (
    <Sheet open={open} title="カテゴリ別の予算" onClose={onClose}>
      <p className="mb-2 text-[12px] text-ink-soft">カテゴリごとの月の予算（空欄なら設定なし）</p>
      <ul className="mb-3 divide-y divide-cream rounded-2xl bg-white px-4 ring-1 ring-beige">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{c.name}</span>
            <span className="text-[13px] text-ink-faint">¥</span>
            <input aria-label={`${c.name}の予算`} inputMode="numeric" value={vals[c.id!] ?? ''} placeholder="—"
              onChange={(e) => setVals({ ...vals, [c.id!]: e.target.value.replace(/[^0-9０-９,]/g, '') })}
              className="w-28 rounded-xl bg-cream/60 px-3 py-2 text-right text-[16px] tabular-nums outline-none focus:ring-1 focus:ring-sage" />
          </li>
        ))}
      </ul>
      <p className="mb-4 text-right text-[12px] text-ink-soft">合計 {yen(sum)}</p>
      <Button onClick={save} className="w-full">保存する</Button>
    </Sheet>
  )
}
