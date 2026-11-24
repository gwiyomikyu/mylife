import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <section onClick={onClick} className={`rounded-3xl bg-white/80 shadow-card ring-1 ring-beige/70 p-[clamp(16px,5vw,20px)] ${onClick ? 'active:scale-[0.99] transition cursor-pointer' : ''} ${className}`}>
      {children}
    </section>
  )
}

export function SectionTitle({ en, ja, right }: { en: string; ja?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="label-en min-w-0 truncate text-[15px] font-semibold text-ink">{en}</h2>
        {ja && <span className="truncate text-[11px] text-ink-faint">{ja}</span>}
      </div>
      {right && <div className="shrink-0 whitespace-nowrap">{right}</div>}
    </div>
  )
}

export function PageHeader({ en, ja, right }: { en: string; ja: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between px-5 pt-4 pb-3">
      <div>
        <p className="text-[11px] tracking-widest text-ink-faint">{ja}</p>
        <h1 className="label-en text-[28px] leading-tight font-semibold text-ink">{en}</h1>
      </div>
      {right}
    </header>
  )
}

export function ProgressBar({ value, className = '', tone = 'sage' }: { value: number; className?: string; tone?: 'sage' | 'clay' }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-ivory ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${tone === 'sage' ? 'bg-sage' : 'bg-clay'}`} style={{ width: `${v * 100}%` }} />
    </div>
  )
}

export function Ring({ value, size = 72, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-ivory" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-sage" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function CheckCircle({ checked, onClick, label, count, target }: { checked: boolean; onClick: () => void; label: string; count?: number; target?: number }) {
  const partial = !checked && (count ?? 0) > 0
  return (
    <button type="button" onClick={onClick} aria-pressed={checked} aria-label={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${checked ? 'border-sage bg-sage text-white animate-pop' : partial ? 'border-sage bg-sage-light text-sage-deep' : 'border-greige bg-white text-transparent'}`}>
      {checked ? <Icon name="check" size={16} strokeWidth={2.2} /> : partial ? <span className="text-[10px] font-semibold">{count}/{target}</span> : null}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, className = '' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`flex rounded-full bg-cream p-1 ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`min-w-0 flex-1 whitespace-nowrap rounded-full px-1 py-2 text-[clamp(11px,3.4vw,13px)] transition ${value === o.value ? 'bg-white text-ink shadow-sm font-medium' : 'text-ink-soft'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/25 animate-fade" onClick={onClose} />
      <div className="relative w-full max-w-md animate-sheet rounded-t-[28px] bg-ivory pb-safe shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-9" />
          <div className="h-1 w-10 rounded-full bg-greige absolute left-1/2 -translate-x-1/2 top-2" />
          <h3 className="text-[15px] font-medium text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="閉じる" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft active:bg-cream">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 pt-1">{children}</div>
      </div>
    </div>
  )
}

/** 入力欄のラベル。ボタンや複数の入力を含むときは group を付ける（label の中にボタンがあると誤タップの原因になるため） */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="block mb-4" {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="mb-1.5 block text-[12px] text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </Tag>
  )
}

export const inputCls = 'w-full rounded-2xl border border-beige bg-white px-4 py-3 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:border-sage'

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-[13px] transition ${active ? 'border-sage bg-sage-light text-sage-deep font-medium' : 'border-beige bg-white text-ink-soft'}`}>
      {children}
    </button>
  )
}

export function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'soft'; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  const v = {
    primary: 'bg-sage-dark text-white active:bg-sage-deep',
    soft: 'bg-cream text-ink active:bg-beige',
    ghost: 'bg-transparent text-ink-soft active:bg-cream',
    danger: 'bg-transparent text-[#A8776A] active:bg-cream',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-2xl px-5 py-3.5 text-[15px] font-medium transition disabled:opacity-40 ${v} ${className}`}>
      {children}
    </button>
  )
}

export function IconButton({ name, onClick, label, className = '' }: { name: string; onClick: () => void; label: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-cream ${className}`}>
      <Icon name={name} size={20} />
    </button>
  )
}

export function Stat({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="mt-0.5 truncate text-[clamp(14px,4.3vw,19px)] font-semibold tabular-nums text-ink">
        {value}{unit && <span className="ml-0.5 text-[11px] font-normal text-ink-soft">{unit}</span>}
      </p>
      {sub && <p className="text-[11px] text-ink-soft">{sub}</p>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-ink-faint">{children}</p>
}

/** 画面下にふわっと出る短い通知 */
let toastSetter: ((s: string | null) => void) | null = null
export function toast(msg: string) { toastSetter?.(msg) }
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { toastSetter = setMsg; return () => { toastSetter = null } }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2200)
    return () => clearTimeout(t)
  }, [msg])
  if (!msg) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-6 animate-fade" style={{ bottom: 'calc(var(--fab-bottom, calc(env(safe-area-inset-bottom) + 84px)) + 28px)' }}>
      <div className="rounded-full bg-ink/85 px-5 py-2.5 text-[13px] text-ivory shadow-lg">{msg}</div>
    </div>
  )
}

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-sage-dark text-white shadow-lg active:scale-95 transition"
      style={{ bottom: 'var(--fab-bottom, calc(env(safe-area-inset-bottom) + 84px))' }}>
      <Icon name="plus" size={26} strokeWidth={1.8} />
    </button>
  )
}

/** 全部できたときの小さなお祝い（丸い粒がふわっと広がる） */
export function Burst({ show }: { show: number }) {
  if (!show) return null
  return (
    <span key={show} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className={`burst-dot ${i % 3 === 0 ? 'bg-sage-dark' : i % 3 === 1 ? 'bg-sage' : 'bg-clay'}`}
          style={{ ['--a' as string]: `${i * 30}deg`, ['--d' as string]: `${46 + (i % 2) * 12}px`, animationDelay: `${(i % 4) * 30}ms` }} />
      ))}
    </span>
  )
}
