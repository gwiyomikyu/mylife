import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Wish, WishGroup } from '../db/types'
import { Button, Card, CheckCircle, Chip, Field, inputCls, PageHeader, Sheet, toast } from '../components/ui'
import { Icon } from '../components/Icon'
import { reassignOrder, SortableList } from '../components/SortableList'
import { parseNum, yen } from '../lib/format'

export const WISH_GROUPS: { value: WishGroup; label: string; en: string; tone: string }[] = [
  { value: 'now', label: 'すぐ買う', en: 'Buy Now', tone: 'bg-sage-light text-sage-deep' },
  { value: 'next', label: '次買う', en: 'Next', tone: 'bg-cream text-ink' },
  { value: 'watch', label: '欲しいけど様子見', en: 'Thinking', tone: 'bg-beige/70 text-ink-soft' },
  { value: 'later', label: '欲しいなぁ～', en: 'Someday', tone: 'bg-cream/60 text-ink-faint' },
]
const groupIdx = (g: WishGroup) => WISH_GROUPS.findIndex((x) => x.value === g)
const byOrder = (a: Wish, b: Wish) => a.order - b.order || a.createdAt - b.createdAt

async function endOrder(group: WishGroup, dir: 'top' | 'bottom'): Promise<number> {
  const rows = (await db.wishes.where('group').equals(group).toArray()).filter((w) => !w.bought)
  if (rows.length === 0) return 0
  const orders = rows.map((w) => w.order)
  return dir === 'bottom' ? Math.max(...orders) + 1 : Math.min(...orders) - 1
}

export default function WishScreen() {
  const wishes = useLiveQuery(() => db.wishes.toArray(), [], [])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [group, setGroup] = useState<WishGroup>('next')
  const [sorting, setSorting] = useState(false)
  const [editing, setEditing] = useState<Wish | null>(null)
  const [showBought, setShowBought] = useState(false)

  const byGroup = useMemo(() => {
    const m = new Map<WishGroup, Wish[]>(WISH_GROUPS.map((g) => [g.value, []]))
    wishes.filter((w) => !w.bought).sort(byOrder).forEach((w) => m.get(w.group)?.push(w))
    return m
  }, [wishes])
  const bought = useMemo(() => wishes.filter((w) => w.bought).sort((a, b) => (b.boughtAt ?? 0) - (a.boughtAt ?? 0)), [wishes])
  const sum = (rows: Wish[]) => rows.reduce((a, w) => a + (w.price ?? 0), 0)

  const add = async () => {
    const n = name.trim()
    if (!n) return
    const p = price.trim() ? Math.round(parseNum(price)) : undefined
    await db.wishes.add({ name: n, price: p && p > 0 ? p : undefined, group, order: await endOrder(group, 'bottom'), memo: '', bought: false, createdAt: Date.now() })
    setName(''); setPrice('')
    toast(`「${WISH_GROUPS[groupIdx(group)].label}」に追加しました`)
  }

  const commit = (g: WishGroup) => async (next: Wish[]) => {
    const orders = reassignOrder(next)
    await db.transaction('rw', db.wishes, async () => {
      for (let i = 0; i < next.length; i++) if (next[i].order !== orders[i] || next[i].group !== g) await db.wishes.update(next[i].id!, { order: orders[i], group: g })
    })
  }
  // 区分の先頭で ∧ → ひとつ上の区分の末尾へ、末尾で ∨ → ひとつ下の区分の先頭へ
  const onEdge = (w: Wish, dir: -1 | 1) => {
    const to = WISH_GROUPS[groupIdx(w.group) + dir]
    if (!to) return false
    endOrder(to.value, dir < 0 ? 'bottom' : 'top').then((order) => db.wishes.update(w.id!, { group: to.value, order }))
    toast(`「${to.label}」へ移動しました`)
    return true
  }

  const toggleBought = (w: Wish) => db.wishes.update(w.id!, w.bought ? { bought: false, boughtAt: undefined } : { bought: true, boughtAt: Date.now() })

  return (
    <div>
      <PageHeader en="Wish List" ja="欲しいもの" right={
        <button type="button" onClick={() => setSorting(!sorting)} className={`mb-1 rounded-full px-4 py-1.5 text-[13px] ${sorting ? 'bg-sage-dark text-white' : 'bg-cream text-ink-soft'}`}>
          {sorting ? '完了' : '並び替え'}
        </button>
      } />
      <div className="space-y-4 px-4">
        {!sorting && (
          <Card>
            <form onSubmit={(e) => { e.preventDefault(); add() }}>
              <div className="flex gap-2">
                <input className={`${inputCls} !py-2.5`} value={name} onChange={(e) => setName(e.target.value)} placeholder="欲しいもの" aria-label="欲しいもの" />
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">¥</span>
                  <input className={`${inputCls} !py-2.5 !pl-7`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9０-９,]/g, ''))} placeholder="任意" aria-label="値段（任意）" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {WISH_GROUPS.map((g) => <Chip key={g.value} active={group === g.value} onClick={() => setGroup(g.value)}>{g.label}</Chip>)}
              </div>
              <Button type="submit" disabled={!name.trim()} className="mt-3 w-full !py-3">リストに追加</Button>
            </form>
          </Card>
        )}
        {sorting && <p className="px-1 text-[12px] leading-relaxed text-ink-faint">≡ をドラッグすると区分の中で順番を変えられます。∧∨ は1つずつ移動し、区分の先頭・末尾では隣の区分へ移ります。</p>}

        {WISH_GROUPS.map((g) => {
          const rows = byGroup.get(g.value) ?? []
          return (
            <Card key={g.value}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${g.tone}`}>{g.label}</span>
                  <span className="label-en truncate text-[12px] text-ink-faint">{g.en}</span>
                </div>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-soft">{rows.length}件{sum(rows) ? ` · ${yen(sum(rows))}` : ''}</span>
              </div>
              {rows.length === 0 ? <p className="py-3 text-center text-[12px] text-ink-faint">まだありません</p> : sorting ? (
                <SortableList items={rows} name={(w) => w.name} onCommit={commit(g.value)} onEdge={onEdge}
                  render={(w) => (<div className="flex items-baseline justify-between gap-2"><p className="truncate text-[15px] text-ink">{w.name}</p>{w.price != null && <span className="shrink-0 text-[13px] tabular-nums text-ink-soft">{yen(w.price)}</span>}</div>)} />
              ) : (
                <ul className="-my-1 divide-y divide-cream">
                  {rows.map((w, i) => (
                    <li key={w.id} className="flex items-center gap-3 py-2.5">
                      <CheckCircle checked={false} label={`${w.name}を買ったにする`} onClick={() => { toggleBought(w); toast('買ったものに移しました') }} />
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setEditing(w)}>
                        <span className="w-4 shrink-0 text-[11px] tabular-nums text-ink-faint">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] text-ink">{w.name}</span>
                          {w.memo && <span className="block truncate text-[11px] text-ink-faint">{w.memo}</span>}
                        </span>
                        {w.price != null && <span className="shrink-0 text-[14px] tabular-nums text-ink-soft">{yen(w.price)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}

        {bought.length > 0 && !sorting && (
          <Card>
            <button type="button" onClick={() => setShowBought(!showBought)} className="flex w-full items-center justify-between">
              <span className="flex items-baseline gap-2"><span className="label-en text-[15px] font-semibold">Got it</span><span className="text-[11px] text-ink-faint">買ったもの {bought.length}件</span></span>
              <Icon name="chevR" size={18} className={`text-ink-faint transition ${showBought ? 'rotate-90' : ''}`} />
            </button>
            {showBought && (
              <ul className="mt-2 divide-y divide-cream">
                {bought.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 py-2.5">
                    <CheckCircle checked label={`${w.name}を欲しいものに戻す`} onClick={() => toggleBought(w)} />
                    <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left" onClick={() => setEditing(w)}>
                      <span className="truncate text-[15px] text-ink-faint line-through decoration-greige">{w.name}</span>
                      {w.price != null && <span className="shrink-0 text-[13px] tabular-nums text-ink-faint">{yen(w.price)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <p className="px-2 pb-2 text-center text-[11px] text-ink-faint">○ をタップすると「買ったもの」に移ります。名前をタップで編集・削除</p>
      </div>
      <WishEditor wish={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function WishEditor({ wish, onClose }: { wish: Wish | null; onClose: () => void }) {
  const [w, setW] = useState<Wish | null>(wish)
  const [price, setPrice] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => { setW(wish); setPrice(wish?.price != null ? String(wish.price) : ''); setConfirmDel(false) }, [wish])
  if (!w || !wish) return null
  const set = (p: Partial<Wish>) => setW({ ...w, ...p })
  const save = async () => {
    if (!w.name.trim()) { toast('名前を入力してください'); return }
    const p = price.trim() ? Math.round(parseNum(price)) : undefined
    // 区分を変えたら、移動先の末尾に入れる
    const order = w.group !== wish.group ? await endOrder(w.group, 'bottom') : w.order
    await db.wishes.put({ ...w, name: w.name.trim(), price: p && p > 0 ? p : undefined, order })
    toast('保存しました')
    onClose()
  }
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    await db.wishes.delete(w.id!)
    toast('削除しました')
    onClose()
  }
  return (
    <Sheet open title="欲しいものを編集" onClose={onClose}>
      <Field label="名前"><input className={inputCls} value={w.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="値段（任意）">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">¥</span>
          <input className={`${inputCls} !pl-8`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9０-９,]/g, ''))} placeholder="未定" />
        </div>
      </Field>
      <Field label="区分" group>
        <div className="flex flex-wrap gap-2">{WISH_GROUPS.map((g) => <Chip key={g.value} active={w.group === g.value} onClick={() => set({ group: g.value })}>{g.label}</Chip>)}</div>
      </Field>
      <Field label="メモ"><textarea className={`${inputCls} min-h-[72px]`} value={w.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="色・サイズ・お店など" /></Field>
      <label className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-beige">
        <span className="text-[14px] text-ink">買った</span>
        <input type="checkbox" className="h-5 w-5 accent-sage-dark" checked={w.bought} onChange={(e) => set({ bought: e.target.checked, boughtAt: e.target.checked ? Date.now() : undefined })} />
      </label>
      <Button onClick={save} className="w-full">保存する</Button>
      <Button variant="danger" onClick={remove} className="mt-2 w-full">{confirmDel ? 'もう一度タップで削除' : 'リストから削除'}</Button>
    </Sheet>
  )
}
