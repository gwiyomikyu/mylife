import { useRef, useState } from 'react'
import { importJSON } from '../lib/backup'
import { markSeeded, startEmpty, startWithSamples } from '../db/seed'
import { Icon } from '../components/Icon'

/** はじめて開いたときだけ出る画面。どう始めるかを選ぶ */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('')
    try { await fn(); onDone() } catch (e) { setErr((e as Error).message || 'うまくいきませんでした'); setBusy(false) }
  }
  const pick = (f?: File) => { if (f) run(async () => { await importJSON(await f.text()); await markSeeded() }) }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center bg-ivory px-6 pt-safe pb-safe">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22%] bg-sage-dark">
        <span className="label-en text-[34px] font-semibold leading-none text-white">M</span>
      </div>
      <h1 className="label-en text-center text-[30px] font-semibold tracking-[0.12em] text-ink">MY LIFE</h1>
      <p className="mt-2 text-center text-[13px] leading-relaxed text-ink-soft">ようこそ。どうやって始めますか？<br />データはこの端末の中だけに保存されます。</p>

      <div className="mt-8 space-y-3">
        <Choice icon="upload" title="バックアップから復元" sub="書き出しておいた JSON ファイルを読み込む" disabled={busy} onClick={() => fileRef.current?.click()} />
        <Choice icon="leaf" title="まっさらで始める" sub="習慣も記録も空っぽ。家計簿のカテゴリだけ用意します" disabled={busy} onClick={() => run(startEmpty)} />
        <Choice icon="spark" title="サンプル入りで試す" sub="おすすめの習慣と、少しの記録例が入ります（あとで消せます）" disabled={busy} onClick={() => run(startWithSamples)} />
      </div>
      {err && <p className="mt-4 text-center text-[12px] text-ink-soft">{err}</p>}
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

function Choice({ icon, title, sub, onClick, disabled }: { icon: string; title: string; sub: string; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex w-full items-center gap-3 rounded-3xl bg-white px-5 py-4 text-left ring-1 ring-beige transition active:bg-cream disabled:opacity-60">
      <Icon name={icon} className="shrink-0 text-sage-dark" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{title}</span>
        <span className="block text-[11px] leading-relaxed text-ink-faint">{sub}</span>
      </span>
      <Icon name="chevR" size={16} className="text-ink-faint" />
    </button>
  )
}
