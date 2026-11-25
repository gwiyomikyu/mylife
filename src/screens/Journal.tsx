import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Journal } from '../db/types'
import type { JournalTarget } from '../App'
import { Card, Chip, IconButton, SectionTitle, Segmented } from '../components/ui'
import { addDays, addMonths, formatJa, formatMonthJa, formatWeekJa, monthKey, monthRange, todayKey, weekDays, weekStart } from '../lib/date'
import { dailyRate, periodRate, rangeRate } from '../lib/habits'
import { moneySummary, useHabits, useLogMap, useRestDays } from '../lib/store'
import { pct, yen, yenSigned } from '../lib/format'

type Kind = JournalTarget['kind']

const FIELDS: Record<Kind, { key: string; label: string; placeholder: string; rows?: number }[]> = {
  // 日次は質問なしの自由な日記（以前の「よかったこと」などは diaryText で本文にまとめて表示）
  daily: [],
  weekly: [
    { key: 'done', label: '今週できたこと', placeholder: '' },
    { key: 'improve', label: '改善したいこと', placeholder: '' },
    { key: 'body', label: '体調の変化', placeholder: '' },
    { key: 'money', label: 'お金の使い方', placeholder: '' },
    { key: 'next', label: '来週の目標', placeholder: '' },
  ],
  monthly: [
    { key: 'achievement', label: '今月の達成度', placeholder: '数字を見て、感じたこと' },
    { key: 'habits', label: '習慣の定着状況', placeholder: '続いた習慣・むずかしかった習慣' },
    { key: 'money', label: '収支の振り返り', placeholder: '' },
    { key: 'body', label: '身体の変化', placeholder: '' },
    { key: 'best1', label: '今月のベスト3', placeholder: '1つめ', rows: 1 },
    { key: 'best2', label: '', placeholder: '2つめ', rows: 1 },
    { key: 'best3', label: '', placeholder: '3つめ', rows: 1 },
    { key: 'next', label: '来月の目標', placeholder: '' },
  ],
}

const LEGACY_DAILY: [string, string][] = [['good', '今日よかったこと'], ['effort', '今日頑張ったこと'], ['tomorrow', '明日やりたいこと']]

/** 日記の本文。以前の質問形式で書いた日は、見出しつきで1つの文章にまとめる */
export function diaryText(fields: Record<string, string>): string {
  if (fields.diary != null) return fields.diary
  return LEGACY_DAILY.filter(([k]) => fields[k]?.trim()).map(([k, label]) => `【${label}】\n${fields[k].trim()}`).join('\n\n')
}

/** 一覧などで使う、最初のひとこと */
export function journalPreview(kind: Kind, fields: Record<string, string>): string {
  if (kind === 'daily') return diaryText(fields).replace(/【[^】]*】\n?/g, '').replace(/\n{2,}/g, '\n').trim()
  return Object.values(fields).find((v) => v.trim()) ?? ''
}

export const MOODS = ['とても良い', '良い', 'ふつう', 'すこし低め', 'つかれた']
const KIND_LABEL: Record<Kind, string> = { daily: '日記', weekly: '週次', monthly: '月次' }

const currentKey = (k: Kind, today: string) => (k === 'daily' ? today : k === 'weekly' ? weekStart(today) : monthKey(today))
const labelOf = (k: Kind, key: string) => (k === 'daily' ? formatJa(key) : k === 'weekly' ? formatWeekJa(key) : formatMonthJa(key))
const shiftKey = (k: Kind, key: string, dir: number) => (k === 'daily' ? addDays(key, dir) : k === 'weekly' ? addDays(key, dir * 7) : addMonths(key, dir))

export default function JournalScreen({ initial, onBack, embedded }: { initial: JournalTarget | null; onBack?: () => void; embedded?: boolean }) {
  const today = todayKey()
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'daily')
  const [key, setKey] = useState(initial?.periodKey ?? currentKey(initial?.kind ?? 'daily', today))
  const flush = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = undefined; if (statusRef.current === 'saving') persistRef.current() } }
  const changeKind = (k: Kind) => { flush(); setKind(k); setKey(currentKey(k, today)) }
  const goKey = (k: string) => { flush(); setKey(k) }
  const cur = currentKey(kind, today)

  const past = useLiveQuery(() => db.journals.where('kind').equals(kind).toArray(), [kind], [] as Journal[])
  const [fields, setFields] = useState<Record<string, string>>({})
  const [mood, setMood] = useState<number | undefined>()
  const [status, setStatus] = useState<'' | 'saving' | 'saved'>('')
  const timer = useRef<number | undefined>(undefined)

  // 期間を切り替えたら、その期間の記録を読み込む
  useEffect(() => {
    let alive = true
    setFields({}); setMood(undefined); setStatus('')
    db.journals.where('[kind+periodKey]').equals([kind, key]).first().then((e) => {
      if (!alive) return
      const f = e?.fields ?? {}
      setFields(kind === 'daily' ? { diary: diaryText(f) } : f); setMood(e?.mood)
    })
    return () => { alive = false }
  }, [kind, key])

  const persist = async (f: Record<string, string>, m: number | undefined) => {
    const existing = await db.journals.where('[kind+periodKey]').equals([kind, key]).first()
    const empty = !Object.values(f).some((v) => v.trim()) && m == null
    if (existing) {
      if (empty) await db.journals.delete(existing.id!)
      else await db.journals.update(existing.id!, { fields: f, mood: m, updatedAt: Date.now() })
    } else if (!empty) {
      await db.journals.add({ kind, periodKey: key, fields: f, mood: m, updatedAt: Date.now() })
    }
    setStatus('saved')
  }
  const schedule = (f: Record<string, string>, m: number | undefined) => {
    setStatus('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { timer.current = undefined; persist(f, m) }, 500)
  }
  const statusRef = useRef(status); statusRef.current = status
  const persistRef = useRef(() => {}); persistRef.current = () => { persist(fields, mood) }
  useEffect(() => () => { if (timer.current && statusRef.current === 'saving') persistRef.current() }, [])

  const setField = (k: string, v: string) => { const f = { ...fields, [k]: v }; setFields(f); schedule(f, mood) }
  const pickMood = (i: number) => { const m = mood === i ? undefined : i; setMood(m); schedule(fields, m) }

  const history = [...past].filter((j) => j.periodKey !== key).sort((a, b) => b.periodKey.localeCompare(a.periodKey)).slice(0, 30)

  return (
    <div>
      {!embedded && (
        <header className="flex items-center gap-1 px-2 pt-3 pb-2">
          <IconButton name="chevL" label="戻る" onClick={() => { flush(); onBack?.() }} />
          <h1 className="label-en text-[22px] font-semibold">Journal</h1>
          <span className="ml-2 text-[11px] text-ink-faint">ふりかえり</span>
        </header>
      )}
      <div className={embedded ? 'space-y-4' : 'space-y-4 px-4'}>
        <Segmented value={kind} onChange={changeKind} options={[{ value: 'daily', label: '日記' }, { value: 'weekly', label: '週次' }, { value: 'monthly', label: '月次' }]} />
        <div className="flex items-center justify-between">
          <IconButton name="chevL" label="前へ" onClick={() => goKey(shiftKey(kind, key, -1))} />
          <div className="text-center">
            <p className="text-[15px] font-medium">{labelOf(kind, key)}</p>
            {key !== cur
              ? <button type="button" onClick={() => goKey(cur)} className="text-[11px] text-sage-dark">{kind === 'daily' ? '今日' : kind === 'weekly' ? '今週' : '今月'}に戻る</button>
              : <p className="text-[11px] text-ink-faint">{kind === 'daily' ? '今日' : kind === 'weekly' ? '今週' : '今月'}</p>}
          </div>
          <IconButton name="chevR" label="次へ" onClick={() => key < cur && goKey(shiftKey(kind, key, 1))} className={key >= cur ? 'opacity-30' : ''} />
        </div>

        {kind !== 'daily' && <PeriodFacts kind={kind} periodKey={key} />}

        <Card>
          <SectionTitle en={kind === 'daily' ? 'Diary' : kind === 'weekly' ? 'Weekly review' : 'Monthly review'} ja={kind === 'daily' ? 'この日の日記' : `${KIND_LABEL[kind]}のふりかえり`}
            right={<span className="text-[11px] text-ink-faint" aria-live="polite">{status === 'saving' ? '保存中…' : status === 'saved' ? '保存しました' : ''}</span>} />
          {kind === 'daily' && (
            <div className="mb-4" role="group" aria-label="今日の気分">
              <p className="mb-1.5 text-[12px] text-ink-soft">気分</p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m, i) => <Chip key={m} active={mood === i} onClick={() => pickMood(i)}>{m}</Chip>)}
              </div>
            </div>
          )}
          {kind === 'daily' && (
            <textarea value={fields.diary ?? ''} onChange={(e) => setField('diary', e.target.value)} placeholder="今日のこと、思ったこと、なんでも自由に" aria-label="日記"
              className="mb-3 w-full resize-none rounded-2xl border border-beige bg-white px-4 py-3 text-[16px] leading-[1.9] text-ink outline-none placeholder:text-ink-faint focus:border-sage"
              style={{ fieldSizing: 'content', minHeight: 240 } as React.CSSProperties} />
          )}
          {FIELDS[kind].map((f) => (
            <label key={f.key} className={`block ${f.label ? 'mb-4' : '-mt-2 mb-4'}`}>
              {f.label && <span className="mb-1.5 block text-[12px] text-ink-soft">{f.label}</span>}
              <textarea rows={f.rows ?? 2} value={fields[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder}
                className="w-full resize-none rounded-2xl border border-beige bg-white px-4 py-3 text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-sage"
                style={{ fieldSizing: 'content', minHeight: f.rows === 1 ? 50 : 76 } as React.CSSProperties} />
            </label>
          ))}
          <p className="text-center text-[11px] text-ink-faint">入力すると自動で保存されます</p>
        </Card>

        {kind === 'daily' && <PeriodFacts kind={kind} periodKey={key} />}

        <Card>
          <SectionTitle en="Archive" ja={kind === 'daily' ? 'これまでの日記' : 'これまでのふりかえり'} />
          {history.length === 0 ? <p className="py-3 text-center text-[12px] text-ink-faint">まだありません</p> : (
            <ul className="divide-y divide-cream">
              {history.map((j) => {
                const first = journalPreview(kind, j.fields)
                return (
                  <li key={j.id}>
                    <button type="button" onClick={() => { goKey(j.periodKey); window.scrollTo({ top: 0 }) }} className="block w-full py-2.5 text-left">
                      <span className="flex items-center justify-between text-[12px] text-ink-soft">
                        <span>{labelOf(kind, j.periodKey)}</span>
                        {j.mood != null && <span className="rounded-full bg-cream px-2 text-[10px]">{MOODS[j.mood]}</span>}
                      </span>
                      {first && <span className={`mt-0.5 block text-[14px] text-ink ${kind === 'daily' ? 'line-clamp-2 whitespace-pre-line leading-relaxed' : 'truncate'}`}>{first}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

/** ふりかえりの参考になる、その期間の数字 */
function PeriodFacts({ kind, periodKey }: { kind: Kind; periodKey: string }) {
  const habits = useHabits()
  const rest = useRestDays()
  const [from, to] = kind === 'daily' ? [periodKey, periodKey] : kind === 'weekly' ? [periodKey, addDays(periodKey, 6)] : monthRange(periodKey)
  const map = useLogMap(addDays(from, -1), addDays(to, 1))
  const tx = useLiveQuery(() => db.transactions.where('date').between(from, to, true, true).toArray(), [from, to], [])
  const workouts = useLiveQuery(() => db.workouts.where('date').between(from, to, true, true).toArray(), [from, to], [])
  const weights = useLiveQuery(() => db.weights.where('date').between(from, to, true, true).sortBy('date'), [from, to], [])
  const today = todayKey()

  const rate = useMemo(() => {
    if (kind === 'daily') return dailyRate(habits, map, periodKey)
    const days = (kind === 'weekly' ? weekDays(periodKey) : Array.from({ length: Number(to.slice(8)) }, (_, i) => addDays(from, i))).filter((k) => k <= today)
    const d = rangeRate(habits, map, days, rest)
    const p = periodRate(habits, map, kind, from)
    const done = d.done + p.done, total = d.total + p.total
    return { done, total, rate: total ? done / total : 0 }
  }, [habits, map, rest, kind, periodKey, from, to, today])
  const m = moneySummary(tx, 0)
  const wChange = weights.length > 1 ? weights[weights.length - 1].weight - weights[0].weight : null

  const items: [string, string][] = [
    ['習慣の達成', rate.total ? `${pct(rate.rate)}（${rate.done}/${rate.total}）` : '—'],
    ['支出', yen(m.expense)],
    ...(kind !== 'daily' ? [['収支', yenSigned(m.balance)] as [string, string], ['貯金', yen(m.saving)] as [string, string]] : []),
    ['運動', workouts.length ? `${workouts.length}回・${workouts.reduce((a, w) => a + w.minutes, 0)}分` : '—'],
    [kind === 'daily' ? '体重' : '体重の変化', kind === 'daily' ? (weights[0] ? `${weights[0].weight.toFixed(1)}kg` : '—') : wChange == null ? '—' : `${wChange > 0 ? '+' : wChange < 0 ? '−' : '±'}${Math.abs(wChange).toFixed(1)}kg`],
  ]
  return (
    <Card className="!bg-sage-light/50">
      <p className="mb-2 text-[12px] text-ink-soft">{kind === 'daily' ? 'この日' : kind === 'weekly' ? 'この週' : 'この月'}の記録</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {items.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] text-ink-faint">{k}</dt>
            <dd className="truncate text-[14px] tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
