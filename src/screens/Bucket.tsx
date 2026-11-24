import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { BucketItem } from '../db/types'
import { Burst, Button, Card, CheckCircle, Field, IconButton, inputCls, PageHeader, ProgressBar, Ring, Segmented, Sheet, toast } from '../components/ui'
import { reassignOrder, SortableList } from '../components/SortableList'

type Filter = 'all' | 'todo' | 'done'
const byOrder = (a: BucketItem, b: BucketItem) => a.order - b.order || a.createdAt - b.createdAt
const md = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}` }

/** 達成の割合に合わせたひとこと（失敗を責めない） */
function cheer(done: number, total: number): string {
  if (total === 0) return '思いついたことを、どんどん書いてみよう'
  if (done === 0) return '書けた時点で、もう一歩前へ。'
  if (done >= total) return 'ぜんぶ叶えた1年！ほんとうにおつかれさま'
  const r = done / total
  if (r < 0.25) return 'ひとつずつ、叶っていくのが楽しみ'
  if (r < 0.5) return 'いい調子。少しずつ形になってきた'
  if (r < 0.75) return '半分を超えた！たくさん叶えてきたね'
  return 'もうすぐぜんぶ。最後まで楽しもう'
}

async function nextOrder(year: number) {
  const rows = await db.bucket.where('year').equals(year).toArray()
  return rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0
}

export default function Bucket() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sorting, setSorting] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [editing, setEditing] = useState<BucketItem | null>(null)
  const [burst, setBurst] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = useLiveQuery(() => db.bucket.where('year').equals(year).toArray(), [year], [] as BucketItem[])
  const prevLeft = useLiveQuery(() => db.bucket.where('year').equals(year - 1).filter((b) => !b.done).count(), [year], 0)
  const sorted = useMemo(() => [...items].sort(byOrder), [items])
  const done = items.filter((b) => b.done).length
  const total = items.length
  const rate = total ? done / total : 0
  const shown = sorted.filter((b) => (filter === 'all' ? true : filter === 'done' ? b.done : !b.done))
  const thisMonth = useMemo(() => {
    const now = new Date()
    return items.filter((b) => b.done && b.doneAt && new Date(b.doneAt).getMonth() === now.getMonth() && new Date(b.doneAt).getFullYear() === now.getFullYear()).length
  }, [items])

  const addLines = async (lines: string[]) => {
    const list = lines.map((l) => l.replace(/^\s*([-・*●○]|\d+[.)．、])\s*/, '').trim()).filter(Boolean)
    if (!list.length) return 0
    let order = await nextOrder(year)
    const now = Date.now()
    await db.bucket.bulkAdd(list.map((t, i) => ({ year, text: t, memo: '', done: false, order: order++, createdAt: now + i })))
    return list.length
  }

  const add = async () => {
    if (!text.trim()) return
    await addLines([text])
    setText('')
    inputRef.current?.focus()
  }

  const toggle = async (b: BucketItem) => {
    if (b.done) { await db.bucket.update(b.id!, { done: false, doneAt: undefined }); return }
    await db.bucket.update(b.id!, { done: true, doneAt: Date.now() })
    const n = done + 1
    setBurst(Date.now())
    toast(n >= total ? 'ぜんぶ達成！おめでとう' : `${n}個目、達成！`)
  }

  const commit = async (next: BucketItem[]) => {
    const orders = reassignOrder(next)
    await db.transaction('rw', db.bucket, async () => {
      for (let i = 0; i < next.length; i++) if (next[i].order !== orders[i]) await db.bucket.update(next[i].id!, { order: orders[i] })
    })
  }

  const carryOver = async () => {
    const rows = (await db.bucket.where('year').equals(year - 1).toArray()).filter((b) => !b.done).sort(byOrder)
    let order = await nextOrder(year)
    await db.transaction('rw', db.bucket, async () => {
      for (const r of rows) await db.bucket.update(r.id!, { year, order: order++ })
    })
    toast(`${rows.length}個を${year}年に引き継ぎました`)
  }

  return (
    <div>
      <PageHeader en={`${year} List`} ja="今年やりたいこと" right={
        total > 0 ? (
          <button type="button" onClick={() => { setSorting(!sorting); setFilter('all') }} className={`mb-1 rounded-full px-4 py-1.5 text-[13px] ${sorting ? 'bg-sage-dark text-white' : 'bg-cream text-ink-soft'}`}>
            {sorting ? '完了' : '並び替え'}
          </button>
        ) : undefined
      } />
      <div className="space-y-4 px-4">
        <div className="flex items-center justify-between">
          <IconButton name="chevL" label="前の年" onClick={() => setYear(year - 1)} />
          <p className="label-en text-[15px] font-semibold">{year}{year === thisYear && <span className="ml-1.5 font-sans text-[11px] font-normal text-ink-faint">今年</span>}</p>
          <IconButton name="chevR" label="次の年" onClick={() => setYear(year + 1)} />
        </div>

        <Card>
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <Ring value={rate} size={88} stroke={8}>
                <span className="text-[18px] font-semibold tabular-nums text-ink">{Math.round(rate * 100)}<span className="text-[11px]">%</span></span>
              </Ring>
              <Burst show={burst} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink-faint">達成</p>
              <p className="whitespace-nowrap text-ink" style={{ fontSize: 'clamp(15px, 4.6vw, 18px)' }}>
                <span className="tabular-nums">{total}</span><span className="text-[13px] text-ink-soft">個中 </span>
                <span className="font-semibold tabular-nums" style={{ fontSize: 'clamp(24px, 7.5vw, 30px)' }}>{done}</span><span className="text-[13px] text-ink-soft">個</span>
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{cheer(done, total)}</p>
            </div>
          </div>
          {total > 0 && (
            <>
              <div className="mt-4 flex flex-wrap gap-[5px]" aria-label={`${total}個中${done}個達成`}>
                {sorted.map((b) => <span key={b.id} className={`h-2.5 w-2.5 rounded-full transition ${b.done ? 'bg-sage' : 'bg-ivory ring-1 ring-inset ring-beige'}`} />)}
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-ink-faint">
                <span>のこり {total - done}個</span>
                {year === thisYear && <span>今月かなえた {thisMonth}個</span>}
              </div>
            </>
          )}
        </Card>

        {!sorting && (
          <Card>
            <form onSubmit={(e) => { e.preventDefault(); add() }} className="flex gap-2">
              <input ref={inputRef} className={`${inputCls} !py-2.5`} value={text} onChange={(e) => setText(e.target.value)} placeholder="やりたいことを書く" aria-label="やりたいこと" enterKeyHint="done" />
              <Button type="submit" disabled={!text.trim()} className="shrink-0 !px-4 !py-2.5">追加</Button>
            </form>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-ink-faint">追加すると続けて書けます</p>
              <button type="button" onClick={() => setBulk(true)} className="shrink-0 text-[12px] text-sage-deep underline decoration-beige underline-offset-4">まとめて書く</button>
            </div>
          </Card>
        )}

        {prevLeft > 0 && !sorting && (
          <Card className="!bg-cream/70">
            <p className="text-[13px] text-ink-soft">{year - 1}年のリストに、まだのものが {prevLeft}個 あります。</p>
            <Button variant="soft" onClick={carryOver} className="mt-2 w-full !py-2.5">{year}年に引き継ぐ</Button>
          </Card>
        )}

        {total > 0 && (
          <Card>
            {sorting ? (
              <>
                <p className="mb-2 text-[12px] leading-relaxed text-ink-faint">≡ をドラッグ、または ∧∨ で順番を変えられます。</p>
                <SortableList items={sorted} name={(b) => b.text} onCommit={commit}
                  render={(b) => <p className={`truncate text-[15px] ${b.done ? 'text-ink-faint line-through decoration-greige' : 'text-ink'}`}>{b.text}</p>} />
              </>
            ) : (
              <>
                <Segmented value={filter} onChange={setFilter} className="mb-2"
                  options={[{ value: 'all', label: `すべて ${total}` }, { value: 'todo', label: `まだ ${total - done}` }, { value: 'done', label: `できた ${done}` }]} />
                {shown.length === 0 ? <p className="py-4 text-center text-[12px] text-ink-faint">{filter === 'done' ? 'かなえたものがここに並びます' : 'ぜんぶかなえました！'}</p> : (
                  <ul className="divide-y divide-cream">
                    {shown.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 py-2.5">
                        <CheckCircle checked={b.done} label={b.done ? `${b.text}をまだに戻す` : `${b.text}を達成にする`} onClick={() => toggle(b)} />
                        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setEditing(b)}>
                          <span className="w-5 shrink-0 text-[11px] tabular-nums text-ink-faint">{sorted.indexOf(b) + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className={`block break-words text-[15px] leading-snug ${b.done ? 'text-ink-faint line-through decoration-greige' : 'text-ink'}`}>{b.text}</span>
                            {b.memo && <span className="block truncate text-[11px] text-ink-faint">{b.memo}</span>}
                          </span>
                          {b.done && b.doneAt && <span className="shrink-0 text-[11px] tabular-nums text-sage-deep">{md(b.doneAt)}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        )}
        {total > 0 && !sorting && <p className="px-2 pb-2 text-center text-[11px] text-ink-faint">○ をタップで達成。文字をタップで編集・メモ・削除</p>}
      </div>
      <BulkSheet open={bulk} onClose={() => setBulk(false)} year={year} onAdd={addLines} />
      <BucketEditor item={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function BulkSheet({ open, onClose, year, onAdd }: { open: boolean; onClose: () => void; year: number; onAdd: (lines: string[]) => Promise<number> }) {
  const [v, setV] = useState('')
  useEffect(() => { if (open) setV('') }, [open])
  if (!open) return null
  const count = v.split('\n').filter((l) => l.trim()).length
  const save = async () => {
    const n = await onAdd(v.split('\n'))
    if (n) toast(`${n}個 追加しました`)
    onClose()
  }
  return (
    <Sheet open title={`${year}年にやりたいこと`} onClose={onClose}>
      <Field label="1行に1つずつ" hint="メモアプリからまとめて貼り付けてもOK。先頭の「・」や番号は自動で外します">
        <textarea className={`${inputCls} min-h-[220px] leading-relaxed`} value={v} onChange={(e) => setV(e.target.value)} placeholder={'温泉旅行に行く\n本を20冊読む\nパンを焼いてみる'} autoFocus />
      </Field>
      <Button onClick={save} disabled={!count} className="w-full">{count ? `${count}個 追加する` : '追加する'}</Button>
    </Sheet>
  )
}

function BucketEditor({ item, onClose }: { item: BucketItem | null; onClose: () => void }) {
  const [b, setB] = useState<BucketItem | null>(item)
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => { setB(item); setConfirmDel(false) }, [item])
  if (!b || !item) return null
  const set = (p: Partial<BucketItem>) => setB({ ...b, ...p })
  const save = async () => {
    if (!b.text.trim()) { toast('内容を入力してください'); return }
    await db.bucket.put({ ...b, text: b.text.trim() })
    toast('保存しました')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.bucket.delete(b.id!)
    toast('削除しました')
    onClose()
  }
  return (
    <Sheet open title="やりたいことを編集" onClose={onClose}>
      <Field label="やりたいこと"><textarea className={`${inputCls} min-h-[64px]`} value={b.text} onChange={(e) => set({ text: e.target.value })} /></Field>
      <Field label="メモ"><textarea className={`${inputCls} min-h-[72px]`} value={b.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="いつ・だれと・どこで・感想など" /></Field>
      <label className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-beige">
        <span className="text-[14px] text-ink">達成した{b.done && b.doneAt ? `（${md(b.doneAt)}）` : ''}</span>
        <input type="checkbox" className="h-5 w-5 accent-sage-dark" checked={b.done} onChange={(e) => set({ done: e.target.checked, doneAt: e.target.checked ? Date.now() : undefined })} />
      </label>
      <Button onClick={save} className="w-full">保存する</Button>
      <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'リストから削除'}</Button>
    </Sheet>
  )
}
