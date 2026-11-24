import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { SavingsGoal, Transaction } from '../db/types'
import { Card, IconButton, SectionTitle, Segmented } from '../components/ui'
import { BarChart, Donut, Dot, LineChart, SLICE_COLORS, yenShort, type Bar } from '../components/charts'
import { addMonths, formatMonthJa, fromKey, monthKey, monthRange, todayKey } from '../lib/date'
import { useCategories, useSettings } from '../lib/store'
import { pct, yen, yenSigned } from '../lib/format'

const mLabel = (mk: string) => `${Number(mk.slice(5))}月`

/** 家計簿の分析（グラフ） */
export function ChartsView() {
  const settings = useSettings()
  const cats = useCategories()
  const curM = monthKey(todayKey())
  const [range, setRange] = useState<'6' | '12'>('6')
  const [catM, setCatM] = useState(curM)
  const n = Number(range)
  const months = useMemo(() => Array.from({ length: n }, (_, i) => addMonths(curM, i - n + 1)), [curM, n])
  const all = useLiveQuery(() => db.transactions.toArray(), [], [] as Transaction[])
  const goals = useLiveQuery(() => db.savingsGoals.toArray(), [], [] as SavingsGoal[])

  const perMonth = useMemo(() => {
    const m = new Map<string, { income: number; expense: number; saving: number }>()
    all.forEach((t) => {
      const k = t.date.slice(0, 7)
      const v = m.get(k) ?? { income: 0, expense: 0, saving: 0 }
      v[t.type] += t.amount
      m.set(k, v)
    })
    return m
  }, [all])
  const get = (mk: string) => perMonth.get(mk) ?? { income: 0, expense: 0, saving: 0 }

  const expenseBars: Bar[] = months.map((mk) => ({ key: mk, label: mLabel(mk), values: [get(mk).expense], highlight: mk === curM }))
  const flowBars: Bar[] = months.map((mk) => ({ key: mk, label: mLabel(mk), values: [get(mk).income, get(mk).expense], highlight: mk === curM }))
  const avgExpense = (() => {
    const past = months.filter((mk) => mk < curM && get(mk).expense > 0)
    return past.length ? past.reduce((a, mk) => a + get(mk).expense, 0) / past.length : null
  })()

  // 貯金の推移（月末時点の総額 = 目標の初期額 ＋ それまでの貯金の記録）
  const savingPoints = useMemo(() => {
    const initial = goals.reduce((a, g) => a + (g.initialAmount ?? 0), 0)
    const savings = all.filter((t) => t.type === 'saving')
    return months.map((mk) => {
      const end = monthRange(mk)[1]
      const total = initial + savings.filter((t) => t.date <= end).reduce((a, t) => a + t.amount, 0)
      return { x: fromKey(`${mk}-01`).getTime(), y: total, label: mk }
    })
  }, [all, goals, months])

  // カテゴリ別の割合
  const catSlices = useMemo(() => {
    const m = new Map<number, number>()
    all.filter((t) => t.type === 'expense' && t.date.startsWith(catM)).forEach((t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount))
    const rows = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ id, label: cats.find((c) => c.id === id)?.name ?? '不明', value: v }))
    const top = rows.slice(0, 5)
    const rest = rows.slice(5).reduce((a, r) => a + r.value, 0)
    const list = rest > 0 ? [...top, { id: -1, label: 'その他', value: rest }] : top
    return list.map((r, i) => ({ ...r, ...SLICE_COLORS[i] }))
  }, [all, cats, catM])
  const catTotal = catSlices.reduce((a, s) => a + s.value, 0)
  const prevCat = get(addMonths(catM, -1)).expense

  return (
    <div className="space-y-4">
      <Segmented value={range} onChange={setRange} options={[{ value: '6', label: '6か月' }, { value: '12', label: '12か月' }]} className="!bg-white/60" />

      <Card>
        <SectionTitle en="Spending" ja="支出の推移" right={avgExpense != null ? <span className="text-[11px] text-ink-soft">月平均 {yen(avgExpense)}</span> : undefined} />
        <BarChart ariaLabel="月ごとの支出" bars={expenseBars} colors={['fill-sage']}
          detail={(b) => {
            const e = b.values[0]
            return (
              <p className="flex justify-between rounded-xl bg-cream/70 px-3 py-2 text-[12px] text-ink-soft">
                <span>{formatMonthJa(b.key)}の支出</span>
                <span className="tabular-nums text-ink">{yen(e)}</span>
              </p>
            )
          }} />
      </Card>

      <Card>
        <SectionTitle en="Breakdown" ja="カテゴリ別の割合" />
        <div className="mb-2 flex items-center justify-between">
          <IconButton name="chevL" label="前の月" onClick={() => setCatM(addMonths(catM, -1))} />
          <p className="text-[14px] font-medium">{formatMonthJa(catM)}</p>
          <IconButton name="chevR" label="次の月" onClick={() => setCatM(addMonths(catM, 1))} />
        </div>
        {catTotal === 0 ? <p className="py-6 text-center text-[13px] text-ink-faint">この月の支出はまだありません</p> : (
          <div className="flex items-center gap-4">
            <Donut slices={catSlices} center={<><span className="text-[10px] text-ink-faint">支出</span><span className="text-[14px] font-semibold tabular-nums">{yenShort(catTotal)}</span></>} />
            <ul className="min-w-0 flex-1 space-y-1.5">
              {catSlices.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[12px]">
                  <Dot className={s.bg} />
                  <span className="min-w-0 flex-1 truncate text-ink">{s.label}</span>
                  <span className="tabular-nums text-ink-soft">{pct(s.value / catTotal)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {catTotal > 0 && prevCat > 0 && (
          <p className="mt-3 text-center text-[12px] text-ink-soft">前の月より {catTotal >= prevCat ? `${yen(catTotal - prevCat)} 多め` : `${yen(prevCat - catTotal)} 少なめ`}</p>
        )}
      </Card>

      <Card>
        <SectionTitle en="Cash flow" ja="収支の推移" right={<span className="flex items-center gap-3 text-[11px] text-ink-soft"><span className="flex items-center gap-1"><Dot className="bg-sage" />収入</span><span className="flex items-center gap-1"><Dot className="bg-greige" />支出</span></span>} />
        <BarChart ariaLabel="月ごとの収入と支出" bars={flowBars} colors={['fill-sage', 'fill-greige']}
          detail={(b) => (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-cream/70 px-3 py-2 text-[12px]">
              <span><span className="block text-[10px] text-ink-faint">{mLabel(b.key)}の収入</span><span className="tabular-nums text-ink">{yen(b.values[0])}</span></span>
              <span><span className="block text-[10px] text-ink-faint">支出</span><span className="tabular-nums text-ink">{yen(b.values[1])}</span></span>
              <span><span className="block text-[10px] text-ink-faint">差額</span><span className="tabular-nums text-ink">{yenSigned(b.values[0] - b.values[1])}</span></span>
            </div>
          )} />
      </Card>

      <Card>
        <SectionTitle en="Savings" ja="貯金の推移" />
        <LineChart ariaLabel="貯金の総額の推移" points={savingPoints} zeroBase fmtY={yenShort}
          xTicks={[savingPoints[0], savingPoints[savingPoints.length - 1]].map((p) => ({ x: p.x, label: mLabel(p.label) }))}
          detail={(p) => (
            <p className="flex justify-between rounded-xl bg-cream/70 px-3 py-2 text-[12px] text-ink-soft">
              <span>{formatMonthJa(p.label)}末の総額</span>
              <span className="tabular-nums text-ink">{yen(p.y)}<span className="ml-1 text-ink-faint">（この月 +{yen(get(p.label).saving)}）</span></span>
            </p>
          )} />
      </Card>
      <p className="px-2 text-center text-[11px] text-ink-faint">グラフの棒や線をタップすると、その月の金額が出ます。</p>
    </div>
  )
}
