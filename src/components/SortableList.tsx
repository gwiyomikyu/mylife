import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * 汎用の並び替えリスト。右端の ≡ を指でつかんで上下にドラッグ、または ∧∨ で1つずつ移動。
 * onCommit に新しい並びを渡す。onEdge を渡すと、先頭の ∧／末尾の ∨ で「リストの外へ」動かせる（区分の移動など）。
 */
export function SortableList<T extends { id?: number; order: number }>({ items: source, name, render, onCommit, onEdge }: {
  items: T[]
  name: (it: T) => string
  render: (it: T) => ReactNode
  onCommit: (next: T[]) => void | Promise<void>
  onEdge?: (it: T, dir: -1 | 1) => boolean // true を返したらそのボタンを有効にする前提で呼ぶ
}) {
  const [items, setItems] = useState(source)
  const [dragId, setDragId] = useState<number | null>(null)
  const dragging = useRef(false)
  const rowRefs = useRef(new Map<number, HTMLLIElement>())

  // ドラッグ中以外は DB の内容に追従
  useEffect(() => { if (!dragging.current) setItems(source) }, [source])

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    setItems(next)
    return next
  }

  const onPointerDown = (e: React.PointerEvent, id: number) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragging.current = true
    setDragId(id)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragId == null) return
    const from = items.findIndex((h) => h.id === dragId)
    // 指の位置がどの行の中心を越えたかで移動先を決める
    let to = from
    items.forEach((h, i) => {
      const el = rowRefs.current.get(h.id!)
      if (!el) return
      const r = el.getBoundingClientRect()
      const mid = r.top + r.height / 2
      if (i < from && e.clientY < mid) to = Math.min(to, i)
      if (i > from && e.clientY > mid) to = Math.max(to, i)
    })
    if (to !== from) move(from, to)
  }
  const onPointerUp = () => {
    if (dragId == null) return
    dragging.current = false
    setDragId(null)
    onCommit(items)
  }

  const step = (i: number, d: -1 | 1) => {
    const target = i + d
    if ((target < 0 || target >= items.length) && onEdge) { onEdge(items[i], d); return }
    const next = move(i, target)
    if (next) onCommit(next)
  }

  return (
    <ul className="-my-1 divide-y divide-cream" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {items.map((h, i) => (
        <li key={h.id} ref={(el) => { if (el) rowRefs.current.set(h.id!, el); else rowRefs.current.delete(h.id!) }}
          className={`flex items-center gap-2 py-2 transition-colors ${dragId === h.id ? 'rounded-2xl bg-sage-light/70' : ''}`}>
          <div className="flex shrink-0 flex-col">
            <button type="button" aria-label={`${name(h)}を上へ`} onClick={() => step(i, -1)} disabled={i === 0 && !onEdge}
              className="flex h-7 w-9 items-center justify-center text-ink-soft disabled:opacity-20"><Icon name="chevL" size={16} className="rotate-90" /></button>
            <button type="button" aria-label={`${name(h)}を下へ`} onClick={() => step(i, 1)} disabled={i === items.length - 1 && !onEdge}
              className="flex h-7 w-9 items-center justify-center text-ink-soft disabled:opacity-20"><Icon name="chevR" size={16} className="rotate-90" /></button>
          </div>
          <div className="min-w-0 flex-1">{render(h)}</div>
          <span aria-label={`${name(h)}をドラッグして移動`} role="button" onPointerDown={(e) => onPointerDown(e, h.id!)}
            className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-full text-ink-faint active:bg-cream"
            style={{ touchAction: 'none' }}>
            <Icon name="grip" size={20} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** 新しい並びに order を振り直す（この一覧が持っていた order 値の範囲内で） */
export function reassignOrder<T extends { order: number }>(next: T[]): number[] {
  const slots = next.map((h) => h.order).sort((a, b) => a - b)
  return slots.every((v, i) => i === 0 || v !== slots[i - 1]) ? slots : next.map((_, i) => (slots[0] ?? 0) + i)
}
