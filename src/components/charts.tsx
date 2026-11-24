import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** 要素の幅を追いかける（SVG を実寸で描いて文字がゆがまないようにする） */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(300)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth || 300)
    const ro = new ResizeObserver(() => setW(el.clientWidth || 300))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** 1.2万 のような短い金額表記 */
export const yenShort = (n: number) => {
  const a = Math.abs(n)
  const s = a >= 10000 ? `${+(a / 10000).toFixed(a >= 1000000 ? 0 : 1)}万` : a >= 1000 ? `${+(a / 1000).toFixed(1)}千` : `${Math.round(a)}`
  return (n < 0 ? '−' : '') + s
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const m = v / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
}

export interface Bar { key: string; label: string; values: number[]; highlight?: boolean }

/** 棒グラフ（系列が複数なら横に並べる）。タップでその月の値を表示 */
export function BarChart({ bars, colors, height = 150, refLine, fmt = yenShort, detail, ariaLabel }: {
  bars: Bar[]; colors: string[]; height?: number; refLine?: { value: number; label: string }; fmt?: (n: number) => string
  detail?: (b: Bar) => ReactNode; ariaLabel: string
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { setSel(bars.find((b) => b.highlight)?.key ?? bars[bars.length - 1]?.key ?? null) }, [bars.map((b) => b.key).join()])
  const left = 34, top = 8, bottom = 20
  const H = height
  const max = niceMax(Math.max(1, refLine?.value ?? 0, ...bars.flatMap((b) => b.values)))
  const iw = Math.max(10, W - left)
  const slot = iw / Math.max(1, bars.length)
  const n = colors.length
  const bw = Math.min(n > 1 ? 10 : 20, (slot * 0.7) / n)
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max)
  const every = Math.ceil(bars.length / 7)
  const selected = bars.find((b) => b.key === sel)

  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} role="img" aria-label={ariaLabel} className="block">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(max * t)} y2={y(max * t)} className="stroke-beige" strokeWidth="1" />
            <text x={left - 6} y={y(max * t) + 3} textAnchor="end" className="fill-ink-faint" fontSize="9">{fmt(max * t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = left + slot * i + slot / 2
          const on = b.key === sel
          return (
            <g key={b.key} onClick={() => setSel(b.key)} className="cursor-pointer">
              <rect x={left + slot * i} y={top} width={slot} height={H - top} fill="transparent" />
              {on && <rect x={left + slot * i + 1} y={top} width={slot - 2} height={H - top - bottom} rx="6" className="fill-cream" />}
              {b.values.map((v, j) => {
                const x = cx - (bw * n) / 2 + bw * j + (n > 1 ? 1 : 0)
                const h = Math.max(v > 0 ? 2 : 0, H - bottom - y(v))
                return <rect key={j} x={x} y={H - bottom - h} width={Math.max(2, bw - (n > 1 ? 2 : 0))} height={h} rx={Math.min(4, bw / 2)} className={colors[j]} opacity={on || b.highlight ? 1 : 0.75} />
              })}
              {(i % every === 0 || i === bars.length - 1) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="9.5" className={on ? 'fill-ink' : 'fill-ink-faint'} fontWeight={on ? 600 : 400}>{b.label}</text>
              )}
            </g>
          )
        })}
        {refLine && refLine.value > 0 && (
          <g>
            <line x1={left} x2={W} y1={y(refLine.value)} y2={y(refLine.value)} className="stroke-sage-dark" strokeDasharray="4 3" strokeWidth="1" opacity="0.6" />
            <text x={left + 4} y={y(refLine.value) - 4} textAnchor="start" className="fill-sage-deep" fontSize="9">{refLine.label}</text>
          </g>
        )}
      </svg>
      {selected && detail && <div className="mt-2">{detail(selected)}</div>}
    </div>
  )
}

export interface Slice { label: string; value: number; cls: string; bg: string }

/** ドーナツ（割合） */
export function Donut({ slices, size = 132, center }: { slices: Slice[]; size?: number; center?: ReactNode }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const r = size / 2 - 12
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label="割合">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="18" className="stroke-cream" />
        {total > 0 && slices.map((s) => {
          const len = (s.value / total) * c
          const el = <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="18" className={s.cls}
            strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-acc} />
          acc += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
    </div>
  )
}

/** カテゴリなどを塗り分ける色（テーマの色から作る） */
export const SLICE_COLORS: { cls: string; bg: string }[] = [
  { cls: 'stroke-sage-deep', bg: 'bg-sage-deep' },
  { cls: 'stroke-sage', bg: 'bg-sage' },
  { cls: 'stroke-clay', bg: 'bg-clay' },
  { cls: 'stroke-stone-dark', bg: 'bg-stone-dark' },
  { cls: 'stroke-stone', bg: 'bg-stone' },
  { cls: 'stroke-greige', bg: 'bg-greige' },
]

export interface Pt { x: number; y: number; label: string }

/** 折れ線（面つき）。x は日付の時刻など。タップで近い点を表示 */
export function LineChart({ points, height = 150, target, fmtY, xTicks, ariaLabel, padY = 0, detail, zeroBase }: {
  points: Pt[]; height?: number; target?: { value: number; label: string } | null; fmtY: (n: number) => string; xTicks: { x: number; label: string }[]
  ariaLabel: string; padY?: number; detail?: (p: Pt) => ReactNode; zeroBase?: boolean
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [sel, setSel] = useState<number | null>(null)
  useEffect(() => { setSel(null) }, [points.length, points[0]?.x])
  const left = 36, right = 8, top = 10, bottom = 20
  const H = height
  if (points.length === 0) return <div ref={ref} className="flex items-center justify-center rounded-2xl bg-cream/50 text-[12px] text-ink-faint" style={{ height }}>まだ記録がありません</div>
  const ys = points.map((p) => p.y).concat(target ? [target.value] : [])
  let lo = zeroBase ? 0 : Math.min(...ys) - padY
  let hi = Math.max(...ys) + padY
  if (hi - lo < 1e-6) { hi += 1; lo -= zeroBase ? 0 : 1 }
  if (zeroBase) hi = niceMax(hi)
  const x0 = Math.min(...points.map((p) => p.x), ...xTicks.map((t) => t.x))
  const x1 = Math.max(...points.map((p) => p.x), ...xTicks.map((t) => t.x))
  const X = (x: number) => left + (W - left - right) * (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0))
  const Y = (v: number) => top + (H - top - bottom) * (1 - (v - lo) / (hi - lo))
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
  const base = H - bottom
  const cur = sel == null ? points[points.length - 1] : points[sel]
  const pick = (clientX: number, el: SVGSVGElement) => {
    const bx = clientX - el.getBoundingClientRect().left
    let best = 0
    points.forEach((p, i) => { if (Math.abs(X(p.x) - bx) < Math.abs(X(points[best].x) - bx)) best = i })
    setSel(best)
  }
  const grid = [0, 0.5, 1].map((t) => lo + (hi - lo) * t)

  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} role="img" aria-label={ariaLabel} className="block touch-pan-y"
        onClick={(e) => pick(e.clientX, e.currentTarget)} onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget)}>
        {grid.map((v, i) => (
          <g key={i}>
            <line x1={left} x2={W - right} y1={Y(v)} y2={Y(v)} className="stroke-beige" strokeWidth="1" />
            <text x={left - 6} y={Y(v) + 3} textAnchor="end" className="fill-ink-faint" fontSize="9">{fmtY(v)}</text>
          </g>
        ))}
        {target && (
          <g>
            <line x1={left} x2={W - right} y1={Y(target.value)} y2={Y(target.value)} className="stroke-sage-dark" strokeDasharray="4 3" strokeWidth="1" opacity="0.7" />
            <text x={W - right} y={Y(target.value) - 4} textAnchor="end" className="fill-sage-deep" fontSize="9">{target.label}</text>
          </g>
        )}
        {points.length > 1 && <path d={`${d} L${X(points[points.length - 1].x)},${base} L${X(points[0].x)},${base} Z`} className="fill-sage-light" opacity="0.7" />}
        <path d={d} fill="none" className="stroke-sage-dark" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 40 && points.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r="2.2" className="fill-sage-dark" />)}
        {cur && (
          <g>
            <line x1={X(cur.x)} x2={X(cur.x)} y1={top} y2={base} className="stroke-greige" strokeWidth="1" />
            <circle cx={X(cur.x)} cy={Y(cur.y)} r="5" className="fill-white stroke-sage-deep" strokeWidth="2" />
          </g>
        )}
        {xTicks.map((t, i) => (
          <text key={i} x={X(t.x)} y={H - 5} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="9.5" className="fill-ink-faint">{t.label}</text>
        ))}
      </svg>
      {cur && detail && <div className="mt-2">{detail(cur)}</div>}
    </div>
  )
}

/** 凡例の小さな丸 */
export const Dot = ({ className }: { className: string }) => <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />
