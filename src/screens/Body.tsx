import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { WeightLog, Workout, WorkoutType } from '../db/types'
import { Button, Card, Chip, Empty, Field, inputCls, PageHeader, ProgressBar, SectionTitle, Segmented, Sheet, Stat, toast } from '../components/ui'
import { Icon } from '../components/Icon'
import { addDays, formatJa, monthKey, monthRange, todayKey, weekStart } from '../lib/date'
import { useSettings } from '../lib/store'
import { saveSettings } from '../db/db'
import { kg, parseNum } from '../lib/format'
import { BarChart, LineChart, type Bar } from '../components/charts'
import { fromKey } from '../lib/date'

const TYPES: WorkoutType[] = ['ランニング', 'ウォーキング', '筋トレ', 'ストレッチ', 'その他']

export default function Body() {
  const today = todayKey()
  const settings = useSettings()
  const [tab, setTab] = useState<'weight' | 'workout'>('weight')
  const [editW, setEditW] = useState<WeightLog | null>(null)
  const [editX, setEditX] = useState<Workout | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [], [])
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [], [])

  const latest = weights[weights.length - 1] as WeightLog | undefined
  const initial = settings.initialWeight ?? weights[0]?.weight ?? null
  const target = settings.targetWeight
  const diff = latest && target != null ? latest.weight - target : null
  const [ms] = monthRange(monthKey(today))
  const beforeMonth = [...weights].reverse().find((w) => w.date < ms) ?? weights.find((w) => w.date >= ms)
  const monthChange = latest && beforeMonth && beforeMonth !== latest ? latest.weight - beforeMonth.weight : null
  const progress = latest && initial != null && target != null && initial !== target ? (initial - latest.weight) / (initial - target) : 0

  const ws = weekStart(today)
  const thisWeek = workouts.filter((w) => w.date >= ws && w.date <= addDays(ws, 6))
  const thisMonth = workouts.filter((w) => w.date.startsWith(monthKey(today)))
  const monthMinutes = thisMonth.reduce((a, w) => a + w.minutes, 0)
  const runKm = thisMonth.filter((w) => w.type === 'ランニング').reduce((a, w) => a + (w.distanceKm ?? 0), 0)

  return (
    <div>
      <PageHeader en="Body" ja="からだ" />
      <div className="space-y-4 px-4">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setEditW({ date: today, weight: latest?.weight ?? 0, memo: '' })} className="flex items-center justify-center gap-2 rounded-3xl bg-sage-dark py-4 text-[14px] font-medium text-white active:bg-sage-deep">
            <Icon name="scale" size={20} /> 体重を記録
          </button>
          <button type="button" onClick={() => setEditX({ date: today, type: 'ウォーキング', minutes: 30, memo: '' })} className="flex items-center justify-center gap-2 rounded-3xl bg-white py-4 text-[14px] font-medium text-ink ring-1 ring-beige active:bg-cream">
            <Icon name="run" size={20} /> 運動を記録
          </button>
        </div>

        <Card>
          <SectionTitle en="Weight" ja="体重" right={
            <button type="button" onClick={() => setGoalOpen(true)} className="flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-[12px] text-ink-soft">
              <Icon name="edit" size={13} />目標を変更
            </button>
          } />
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] text-ink-faint">最新{latest ? ` · ${formatJa(latest.date)}` : ''}</p>
              <p className="text-[36px] font-semibold leading-none tabular-nums">{kg(latest?.weight)}<span className="ml-1 text-[14px] font-normal text-ink-soft">kg</span></p>
            </div>
            {monthChange != null && <p className="text-[13px] tabular-nums text-ink-soft">今月 {monthChange > 0 ? '+' : monthChange < 0 ? '−' : '±'}{Math.abs(monthChange).toFixed(1)}kg</p>}
          </div>
          <WeightChart weights={weights} target={target} />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="初期体重" value={kg(initial)} unit="kg" />
            <Stat label="目標体重" value={kg(target)} unit="kg" />
            <Stat label="目標まで" value={diff == null ? '—' : diff <= 0 ? '達成' : diff.toFixed(1)} unit={diff != null && diff > 0 ? 'kg' : undefined} />
          </div>
          {target != null && initial != null && <ProgressBar value={progress} className="mt-3" />}
          {target == null && <button type="button" onClick={() => setGoalOpen(true)} className="mt-2 text-[12px] text-sage-dark">目標体重を決める</button>}
        </Card>

        <Card>
          <SectionTitle en="Workout" ja="運動" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label="今週" value={thisWeek.length} unit={`/ ${settings.weeklyWorkoutGoal}回`} />
            <Stat label="今月" value={thisMonth.length} unit="回" />
            <Stat label="今月の運動時間" value={monthMinutes >= 60 ? `${Math.floor(monthMinutes / 60)}時間${monthMinutes % 60}` : monthMinutes} unit="分" />
            <Stat label="今月のランニング" value={runKm.toFixed(1)} unit="km" />
          </div>
          <ProgressBar value={settings.weeklyWorkoutGoal ? thisWeek.length / settings.weeklyWorkoutGoal : 0} className="mt-4" />
          <p className="mb-1 mt-5 text-[11px] text-ink-soft">週ごとの運動回数（直近8週）</p>
          <BarChart ariaLabel="週ごとの運動回数" height={120} colors={['fill-sage']} fmt={(n) => `${Math.round(n)}`}
            refLine={settings.weeklyWorkoutGoal ? { value: settings.weeklyWorkoutGoal, label: `目標 ${settings.weeklyWorkoutGoal}回` } : undefined}
            bars={Array.from({ length: 8 }, (_, i): Bar => {
              const s0 = addDays(ws, (i - 7) * 7)
              const list = workouts.filter((w) => w.date >= s0 && w.date <= addDays(s0, 6))
              const d = fromKey(s0)
              return { key: s0, label: i === 7 ? '今週' : `${d.getMonth() + 1}/${d.getDate()}`, values: [list.length], highlight: i === 7 }
            })}
            detail={(b) => {
              const list = workouts.filter((w) => w.date >= b.key && w.date <= addDays(b.key, 6))
              const min = list.reduce((a, w) => a + w.minutes, 0)
              return <p className="flex justify-between rounded-xl bg-cream/70 px-3 py-2 text-[12px] text-ink-soft"><span>{formatJa(b.key)}からの週</span><span className="tabular-nums text-ink">{list.length}回・{min}分</span></p>
            }} />
        </Card>

        <Card>
          <Segmented value={tab} onChange={setTab} className="mb-3" options={[{ value: 'weight', label: '体重の記録' }, { value: 'workout', label: '運動の記録' }]} />
          {tab === 'weight' ? (
            weights.length === 0 ? <Empty>まだ記録がありません</Empty> : (
              <ul className="divide-y divide-cream">
                {[...weights].reverse().map((w) => (
                  <li key={w.id}>
                    <button type="button" onClick={() => setEditW(w)} className="flex w-full items-center justify-between py-2.5 text-left">
                      <span className="text-[13px] text-ink-soft">{formatJa(w.date)}{w.memo && <span className="ml-2 text-ink-faint">{w.memo}</span>}</span>
                      <span className="tabular-nums text-[15px]">{w.weight.toFixed(1)}kg{w.bodyFat != null && <span className="ml-2 text-[12px] text-ink-faint">{w.bodyFat}%</span>}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            workouts.length === 0 ? <Empty>まだ記録がありません</Empty> : (
              <ul className="divide-y divide-cream">
                {workouts.map((w) => (
                  <li key={w.id}>
                    <button type="button" onClick={() => setEditX(w)} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <span className="w-24 shrink-0 text-[12px] text-ink-soft">{formatJa(w.date)}</span>
                      <span className="min-w-0 flex-1 truncate text-[14px]">{w.type}{w.memo && <span className="ml-2 text-[11px] text-ink-faint">{w.memo}</span>}</span>
                      <span className="tabular-nums text-[13px] text-ink-soft">{w.minutes}分{w.distanceKm ? ` ・ ${w.distanceKm}km` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </Card>
      </div>
      <WeightInput w={editW} onClose={() => setEditW(null)} />
      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} initial={settings.initialWeight} target={settings.targetWeight} weekly={settings.weeklyWorkoutGoal} />
      <WorkoutInput w={editX} onClose={() => setEditX(null)} />
    </div>
  )
}

const RANGES = [{ value: '30', label: '1か月' }, { value: '90', label: '3か月' }, { value: '365', label: '1年' }, { value: 'all', label: 'すべて' }] as const
type Range = (typeof RANGES)[number]['value']

function WeightChart({ weights, target }: { weights: WeightLog[]; target: number | null }) {
  const [range, setRange] = useState<Range>('90')
  const today = todayKey()
  const from = range === 'all' ? (weights[0]?.date ?? today) : addDays(today, -Number(range) + 1)
  const list = weights.filter((w) => w.date >= from)
  const pts = list.map((w) => ({ x: fromKey(w.date).getTime(), y: w.weight, label: w.date }))
  const md = (k: string) => { const d = fromKey(k); return range === '365' || range === 'all' ? `${d.getFullYear() % 100}/${d.getMonth() + 1}` : `${d.getMonth() + 1}/${d.getDate()}` }
  const change = list.length > 1 ? list[list.length - 1].weight - list[0].weight : null
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label="体重グラフの期間">
          {RANGES.map((r) => (
            <button key={r.value} type="button" role="tab" aria-selected={range === r.value} onClick={() => setRange(r.value)}
              className={`rounded-full px-2.5 py-1 text-[11px] transition ${range === r.value ? 'bg-sage-light font-medium text-sage-deep' : 'text-ink-soft'}`}>{r.label}</button>
          ))}
        </div>
        {change != null && <span className="shrink-0 text-[11px] tabular-nums text-ink-soft">期間 {change > 0 ? '+' : change < 0 ? '−' : '±'}{Math.abs(change).toFixed(1)}kg</span>}
      </div>
      <LineChart ariaLabel="体重の推移" points={pts} padY={0.4} height={160} fmtY={(n) => n.toFixed(1)}
        target={target != null ? { value: target, label: `目標 ${target.toFixed(1)}kg` } : null}
        xTicks={[{ x: fromKey(from).getTime(), label: md(from) }, { x: fromKey(today).getTime(), label: '今日' }]}
        detail={(p) => {
          const w = list.find((x) => x.date === p.label)
          return (
            <p className="flex justify-between rounded-xl bg-cream/70 px-3 py-2 text-[12px] text-ink-soft">
              <span>{formatJa(p.label)}</span>
              <span className="tabular-nums text-ink">{p.y.toFixed(1)}kg{w?.bodyFat != null && <span className="ml-1 text-ink-faint">体脂肪 {w.bodyFat}%</span>}</span>
            </p>
          )
        }} />
    </div>
  )
}

function useDeleteConfirm(dep: unknown) {
  const [c, setC] = useState(false)
  useEffect(() => setC(false), [dep])
  return [c, setC] as const
}

function WeightInput({ w, onClose }: { w: WeightLog | null; onClose: () => void }) {
  const [v, setV] = useState({ date: '', weight: '', bodyFat: '', memo: '' })
  const [confirmDel, setConfirmDel] = useDeleteConfirm(w)
  useEffect(() => { if (w) setV({ date: w.date, weight: w.weight ? String(w.weight) : '', bodyFat: w.bodyFat != null ? String(w.bodyFat) : '', memo: w.memo }) }, [w])
  if (!w) return null
  const isNew = w.id == null
  const save = async () => {
    const weight = parseNum(v.weight)
    if (!weight || weight < 20 || weight > 300) { toast('体重を入力してください'); return }
    const bf = v.bodyFat ? parseNum(v.bodyFat) : undefined
    const row: WeightLog = { ...w, date: v.date || todayKey(), weight: Math.round(weight * 10) / 10, bodyFat: bf != null && !Number.isNaN(bf) ? bf : undefined, memo: v.memo }
    if (isNew) {
      // 同じ日の記録があれば上書き（1日1件）
      const same = await db.weights.where('date').equals(row.date).first()
      if (same) row.id = same.id
    }
    await db.weights.put(row)
    toast('体重を記録しました')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.weights.delete(w.id!)
    toast('削除しました'); onClose()
  }
  return (
    <Sheet open title={isNew ? '体重を記録' : '体重を編集'} onClose={onClose}>
      <div className="mb-4 flex items-baseline rounded-3xl bg-white px-5 py-4 ring-1 ring-beige focus-within:ring-sage">
        <input aria-label="体重" inputMode="decimal" className="w-full bg-transparent text-[34px] font-semibold tabular-nums outline-none placeholder:text-greige"
          value={v.weight} onChange={(e) => setV({ ...v, weight: e.target.value })} placeholder="0.0" autoFocus={isNew} />
        <span className="text-[18px] text-ink-soft">kg</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="日付"><input type="date" className={inputCls} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        <Field label="体脂肪率（任意）"><input inputMode="decimal" className={inputCls} value={v.bodyFat} onChange={(e) => setV({ ...v, bodyFat: e.target.value })} placeholder="%" /></Field>
      </div>
      <Field label="メモ"><input className={inputCls} value={v.memo} onChange={(e) => setV({ ...v, memo: e.target.value })} placeholder="任意" /></Field>
      <Button onClick={save} className="w-full">{isNew ? '記録する' : '保存する'}</Button>
      {!isNew && <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'この記録を削除'}</Button>}
    </Sheet>
  )
}

function WorkoutInput({ w, onClose }: { w: Workout | null; onClose: () => void }) {
  const [v, setV] = useState<Workout | null>(w)
  const [dist, setDist] = useState('')
  const [confirmDel, setConfirmDel] = useDeleteConfirm(w)
  useEffect(() => { setV(w); setDist(w?.distanceKm != null ? String(w.distanceKm) : '') }, [w])
  if (!v || !w) return null
  const isNew = w.id == null
  const save = async () => {
    if (!v.minutes || v.minutes <= 0) { toast('運動時間を入力してください'); return }
    const d = dist ? parseNum(dist) : undefined
    await db.workouts.put({ ...v, distanceKm: d != null && !Number.isNaN(d) && d > 0 ? d : undefined })
    toast('運動を記録しました')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.workouts.delete(w.id!)
    toast('削除しました'); onClose()
  }
  const showDist = v.type === 'ランニング' || v.type === 'ウォーキング' || !!dist
  return (
    <Sheet open title={isNew ? '運動を記録' : '運動を編集'} onClose={onClose}>
      <Field label="運動の種類" group>
        <div className="flex flex-wrap gap-2">{TYPES.map((t) => <Chip key={t} active={v.type === t} onClick={() => setV({ ...v, type: t })}>{t}</Chip>)}</div>
      </Field>
      <Field label="運動時間（分）" group>
        <div className="flex flex-wrap gap-2">
          {[10, 15, 20, 30, 45, 60].map((m) => <Chip key={m} active={v.minutes === m} onClick={() => setV({ ...v, minutes: m })}>{m}分</Chip>)}
        </div>
        <input inputMode="numeric" className={`${inputCls} mt-2`} value={v.minutes || ''} onChange={(e) => setV({ ...v, minutes: Math.round(parseNum(e.target.value)) || 0 })} placeholder="分" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="日付"><input type="date" className={inputCls} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value || todayKey() })} /></Field>
        {showDist && <Field label="距離（任意）"><input inputMode="decimal" className={inputCls} value={dist} onChange={(e) => setDist(e.target.value)} placeholder="km" /></Field>}
      </div>
      <Field label="メモ"><input className={inputCls} value={v.memo} onChange={(e) => setV({ ...v, memo: e.target.value })} placeholder="任意" /></Field>
      <Button onClick={save} className="w-full">{isNew ? '記録する' : '保存する'}</Button>
      {!isNew && <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'この記録を削除'}</Button>}
    </Sheet>
  )
}

/** 体重の目標などを BODY 画面からすぐ変更する */
function GoalSheet({ open, onClose, initial, target, weekly }: { open: boolean; onClose: () => void; initial: number | null; target: number | null; weekly: number }) {
  const [v, setV] = useState({ initial: '', target: '', weekly: '' })
  useEffect(() => { if (open) setV({ initial: initial == null ? '' : String(initial), target: target == null ? '' : String(target), weekly: String(weekly) }) }, [open, initial, target, weekly])
  if (!open) return null
  const n = (s: string) => { const x = parseNum(s); return s.trim() === '' || Number.isNaN(x) ? null : Math.round(x * 10) / 10 }
  const save = async () => {
    await saveSettings({ initialWeight: n(v.initial), targetWeight: n(v.target), weeklyWorkoutGoal: Math.max(0, Math.round(n(v.weekly) ?? weekly)) })
    toast('目標を保存しました')
    onClose()
  }
  return (
    <Sheet open title="からだの目標" onClose={onClose}>
      <Field label="目標体重（kg）">
        <input inputMode="decimal" className={`${inputCls} !text-[22px] font-semibold`} value={v.target} onChange={(e) => setV({ ...v, target: e.target.value })} placeholder="例：52.0" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="初期体重（kg）"><input inputMode="decimal" className={inputCls} value={v.initial} onChange={(e) => setV({ ...v, initial: e.target.value })} /></Field>
        <Field label="週の運動目標（回）"><input inputMode="numeric" className={inputCls} value={v.weekly} onChange={(e) => setV({ ...v, weekly: e.target.value })} /></Field>
      </div>
      <Button onClick={save} className="w-full">保存する</Button>
    </Sheet>
  )
}
