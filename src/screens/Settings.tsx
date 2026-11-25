import { useEffect, useRef, useState } from 'react'
import type { Go } from '../App'
import { db, saveSettings } from '../db/db'
import type { Category, Settings, TxType } from '../db/types'
import { Button, Card, Field, IconButton, inputCls, SectionTitle, Segmented, toast } from '../components/ui'
import { Icon } from '../components/Icon'
import { useCategories, useSettings } from '../lib/store'
import { backupName, exportJSON, exportMoneyCSV, importJSON, saveFile } from '../lib/backup'
import { deleteSampleRecords, resetAll } from '../db/seed'
import { parseNum } from '../lib/format'
import { buildReminderICS, DEFAULT_REMINDERS, type Reminders } from '../lib/ics'
import { useHabits } from '../lib/store'
import { DEFAULT_PALETTE, LEGACY, PRESETS, samePalette, SWATCHES, swatchName, type Palette, type PaletteKey } from '../lib/palette'

type Draft = Record<Exclude<keyof Settings, 'theme' | 'palette' | 'navPosition' | 'reminders' | 'monthlyBudget' | 'savingsTarget'>, string>

const toDraft = (s: Settings): Draft => ({
  nickname: s.nickname, monthlyGoal: s.monthlyGoal,
  initialWeight: s.initialWeight == null ? '' : String(s.initialWeight), targetWeight: s.targetWeight == null ? '' : String(s.targetWeight),
  weeklyWorkoutGoal: String(s.weeklyWorkoutGoal), sleepGoal: String(s.sleepGoal), paymentMethods: s.paymentMethods.join('、'),
})

export default function SettingsScreen({ go }: { go: Go }) {
  const settings = useSettings()
  const [d, setD] = useState<Draft>(toDraft(settings))
  const loaded = useRef(false)
  useEffect(() => {
    // 最初の読み込み時だけ反映（入力中に上書きしない）
    if (!loaded.current && settings !== undefined) { setD(toDraft(settings)); }
  }, [settings])
  useEffect(() => { const t = setTimeout(() => { loaded.current = true }, 400); return () => clearTimeout(t) }, [])

  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })
  const num = (s: string, fallback: number | null) => { const n = parseNum(s); return s.trim() === '' || Number.isNaN(n) ? fallback : n }

  const save = async () => {
    await saveSettings({
      nickname: d.nickname.trim(), monthlyGoal: d.monthlyGoal.trim(),
      initialWeight: num(d.initialWeight, null), targetWeight: num(d.targetWeight, null),
      weeklyWorkoutGoal: Math.max(0, Math.round(num(d.weeklyWorkoutGoal, 3) ?? 3)), sleepGoal: num(d.sleepGoal, 7) ?? 7,
      paymentMethods: d.paymentMethods.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean),
    })
    toast('設定を保存しました')
  }

  return (
    <div>
      <header className="flex items-center gap-1 px-2 pt-3 pb-2">
        <IconButton name="chevL" label="戻る" onClick={() => go('home')} />
        <h1 className="label-en text-[22px] font-semibold">Settings</h1>
        <span className="ml-2 text-[11px] text-ink-faint">設定</span>
      </header>
      <div className="space-y-4 px-4">
        <Card>
          <SectionTitle en="Layout" ja="タブの位置" />
          <Segmented value={settings.navPosition ?? 'side'} onChange={(v) => { saveSettings({ navPosition: v }); toast(v === 'side' ? 'タブを左横にしました' : 'タブを下にしました') }}
            options={[{ value: 'side', label: '左横' }, { value: 'bottom', label: '下' }]} />
          <p className="mt-2 text-[11px] text-ink-faint">タップするとすぐに切り替わります。</p>
        </Card>
        <ColorCustomizer />
        <Card>
          <SectionTitle en="Profile" ja="わたし" />
          <Field label="ニックネーム（HOMEのあいさつに表示）"><input className={inputCls} value={d.nickname} onChange={set('nickname')} placeholder="例：Shiori" /></Field>
          <Field label="今月の目標"><input className={inputCls} value={d.monthlyGoal} onChange={set('monthlyGoal')} /></Field>
        </Card>
        <Card>
          <SectionTitle en="Money" ja="お金" />
          <Field label="支払い方法（、区切り）" hint="予算は MONEY の「カテゴリ別の予算を設定」から、カテゴリごとに決められます"><input className={inputCls} value={d.paymentMethods} onChange={set('paymentMethods')} /></Field>
        </Card>
        <Card>
          <SectionTitle en="Body" ja="からだ" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="初期体重（kg）"><input inputMode="decimal" className={inputCls} value={d.initialWeight} onChange={set('initialWeight')} /></Field>
            <Field label="目標体重（kg）"><input inputMode="decimal" className={inputCls} value={d.targetWeight} onChange={set('targetWeight')} /></Field>
            <Field label="週の運動目標（回）"><input inputMode="numeric" className={inputCls} value={d.weeklyWorkoutGoal} onChange={set('weeklyWorkoutGoal')} /></Field>
            <Field label="睡眠時間の目標（時間）"><input inputMode="decimal" className={inputCls} value={d.sleepGoal} onChange={set('sleepGoal')} /></Field>
          </div>
        </Card>
        <Button onClick={save} className="w-full">設定を保存</Button>

        <ReminderSettings />
        <CategoryManager />
        <DataManager />
        <p className="pb-4 text-center text-[11px] text-ink-faint">MY LIFE · Take care of yourself, every day.<br />データはこの端末のブラウザ内にだけ保存され、外部には送信されません。</p>
      </div>
    </div>
  )
}

const PARTS: { value: PaletteKey; label: string }[] = [
  { value: 'bg', label: '背景' }, { value: 'card', label: 'カード' }, { value: 'accent', label: 'アクセント' }, { value: 'text', label: '文字' },
]

function ColorCustomizer() {
  const settings = useSettings()
  const current: Palette = settings.palette ?? (settings.theme && LEGACY[settings.theme]) ?? DEFAULT_PALETTE
  const [part, setPart] = useState<PaletteKey>('bg')
  const [history, setHistory] = useState<Palette[]>([])

  const apply = async (p: Palette) => {
    if (samePalette(p, current)) return
    setHistory((h) => [...h.slice(-19), current])
    await saveSettings({ palette: p })
  }
  const undo = async () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    await saveSettings({ palette: prev })
  }
  const reset = async () => { await apply(DEFAULT_PALETTE); toast('最初の色に戻しました') }
  const isDefault = samePalette(current, DEFAULT_PALETTE)

  return (
    <Card className="!p-0 overflow-visible">
      <div className="p-5 pb-3">
        <SectionTitle en="Color" ja="色のカスタマイズ" />
        <p className="text-[12px] leading-relaxed text-ink-soft">色をタップすると、すぐにアプリ全体へ反映・保存されます。</p>
      </div>

      {/* プレビュー（色はアプリ全体にもすぐ反映される） */}
      <div className="px-5 pb-3 pt-2" aria-label="プレビュー">
        <div className="rounded-2xl bg-ivory p-3 ring-1 ring-beige">
          <p className="label-en text-[13px] font-semibold text-ink">Today</p>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-beige/70">
            <div className="relative h-11 w-11 shrink-0">
              <svg width="44" height="44" className="-rotate-90"><circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" className="stroke-ivory" /><circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-sage" strokeDasharray="113" strokeDashoffset="45" /></svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-ink">60%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink">朝の白湯を飲む</p>
              <p className="text-[11px] text-ink-faint">健康 · 3日継続</p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-ivory"><div className="h-full w-3/5 rounded-full bg-sage" /></div>
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-white"><Icon name="check" size={14} strokeWidth={2.2} /></span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-xl bg-sage-dark px-3 py-1.5 text-[12px] font-medium text-white">保存する</span>
            <span className="rounded-full bg-sage-light px-3 py-1.5 text-[12px] font-medium text-sage-deep">選択中のタブ</span>
            <span className="ml-auto text-[11px] text-ink-soft">¥12,800</span>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-soft">
          {swatchName('bg', current.bg)} ／ {swatchName('card', current.card)} ／ {swatchName('accent', current.accent)} ／ {swatchName('text', current.text)}
        </p>
      </div>

      <div className="px-5 pb-5">
        <p className="mb-2 mt-1 text-[12px] text-ink-soft">おすすめの組み合わせ</p>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {PRESETS.map((pr) => {
            const on = samePalette(pr.p, current)
            return (
              <button key={pr.name} type="button" onClick={() => apply(pr.p)} aria-pressed={on} aria-label={`組み合わせ「${pr.name}」`}
                className={`shrink-0 rounded-2xl p-1.5 ring-1 transition ${on ? 'ring-2 ring-sage-dark' : 'ring-beige'}`} style={{ background: pr.p.bg }}>
                <span className="flex h-9 w-16 items-center justify-center gap-1 rounded-xl" style={{ background: pr.p.card }}>
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: pr.p.accent }} />
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: pr.p.text }} />
                </span>
                <span className="mt-1 block text-[10px]" style={{ color: pr.p.text }}>{pr.name}</span>
              </button>
            )
          })}
        </div>

        <p className="mb-2 mt-4 text-[12px] text-ink-soft">1色ずつ選ぶ</p>
        <Segmented value={part} onChange={setPart} options={PARTS} className="mb-3" />
        <div className="grid grid-cols-5 gap-x-1 gap-y-3" role="radiogroup" aria-label={`${PARTS.find((x) => x.value === part)!.label}の色`}>
          {SWATCHES[part].map((sw) => {
            const on = current[part].toLowerCase() === sw.hex.toLowerCase()
            return (
              <button key={sw.hex} type="button" role="radio" aria-checked={on} aria-label={sw.name} onClick={() => apply({ ...current, [part]: sw.hex })}
                className="flex flex-col items-center gap-1">
                <span className={`flex h-11 w-11 items-center justify-center rounded-full transition ${on ? 'ring-2 ring-sage-dark ring-offset-2 ring-offset-white' : 'ring-1 ring-ink/15'}`} style={{ background: sw.hex }}>
                  {on && <Icon name="check" size={16} strokeWidth={2.4} className={part === 'text' || part === 'accent' ? 'text-[#fff]' : 'text-ink'} />}
                </span>
                <span className={`w-full whitespace-nowrap text-center text-[9px] tracking-tighter ${on ? 'font-medium text-ink' : 'text-ink-soft'}`}>{sw.name}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="soft" className="flex-1 !py-3 text-[14px]" onClick={undo} disabled={history.length === 0}>ひとつ前に戻す</Button>
          <Button variant="soft" className="flex-1 !py-3 text-[14px]" onClick={reset} disabled={isDefault}>最初の色に戻す</Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-faint">最初の色：ペールピンク／ミルク／モカ／ココア</p>
      </div>
    </Card>
  )
}

function ReminderRow({ on, onToggle, title, sub, time, onTime }: { on: boolean; onToggle: () => void; title: string; sub: string; time: string; onTime: (v: string) => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button type="button" role="switch" aria-checked={on} aria-label={title} onClick={onToggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-sage-dark' : 'bg-greige'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-ink">{title}</span>
        <span className="block text-[11px] text-ink-faint">{sub}</span>
      </span>
      <input type="time" aria-label={`${title}の時刻`} value={time} disabled={!on} onChange={(e) => e.target.value && onTime(e.target.value)}
        className="w-[92px] rounded-xl bg-cream/70 px-2 py-2 text-center text-[16px] tabular-nums outline-none disabled:opacity-40" />
    </li>
  )
}

function ReminderSettings() {
  const settings = useSettings()
  const habits = useHabits()
  const r: Reminders = { ...DEFAULT_REMINDERS, ...(settings.reminders ?? {}) }
  const set = (p: Partial<Reminders>) => saveSettings({ reminders: { ...r, ...p } })
  const [howto, setHowto] = useState(false)
  const exportICS = async () => {
    const { text, count } = buildReminderICS(habits, r)
    if (!count) { toast('登録するリマインダーがありません'); return }
    try {
      await saveFile(text, 'mylife-reminders.ics', 'text/calendar')
      setHowto(true)
    } catch { toast('書き出しに失敗しました') }
  }
  return (
    <Card>
      <SectionTitle en="Reminder" ja="リマインダー" />
      <p className="mb-1 text-[12px] leading-relaxed text-ink-soft">iPhone のカレンダーに、通知つきの予定として登録できます。サーバーを使わないので、記録が外に送られることはありません。</p>
      <ul className="divide-y divide-cream">
        <ReminderRow on={r.daily} onToggle={() => set({ daily: !r.daily })} title="今日の習慣チェック" sub="毎日" time={r.dailyTime} onTime={(v) => set({ dailyTime: v })} />
        <ReminderRow on={r.routine} onToggle={() => set({ routine: !r.routine })} title="週次・月次の習慣" sub="決めた曜日・週の初日" time={r.routineTime} onTime={(v) => set({ routineTime: v })} />
        <ReminderRow on={r.journal} onToggle={() => set({ journal: !r.journal })} title="ふりかえり" sub="毎日・日曜・月末" time={r.journalTime} onTime={(v) => set({ journalTime: v })} />
      </ul>
      <Button onClick={exportICS} className="mt-3 w-full">カレンダーに登録するファイルを書き出す</Button>
      {howto && (
        <div className="mt-3 rounded-2xl bg-sage-light/60 p-4 text-[12px] leading-relaxed text-ink">
          <p className="mb-1 font-medium">iPhone での登録のしかた</p>
          <ol className="list-decimal space-y-0.5 pl-4 text-ink-soft">
            <li>書き出した「mylife-reminders.ics」を「ファイル」アプリに保存</li>
            <li>「ファイル」アプリでそのファイルをタップ</li>
            <li>「すべてを追加」→ 追加するカレンダーを選ぶ</li>
          </ol>
          <p className="mt-2 text-ink-faint">時刻や習慣を変えて登録し直すときは、カレンダーで前の「MY LIFE｜…」の予定を削除してから追加してください。</p>
        </div>
      )}
      <p className="mt-2 text-[11px] text-ink-faint">アプリを開いたときにも、{r.dailyTime} を過ぎてまだの習慣があれば HOME でお知らせします。</p>
    </Card>
  )
}

function CategoryManager() {
  const cats = useCategories()
  const [type, setType] = useState<TxType>('expense')
  const [name, setName] = useState('')
  const list = cats.filter((c) => c.type === type)

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (list.some((c) => c.name === n)) { toast('同じ名前のカテゴリがあります'); return }
    await db.categories.add({ type, name: n, note: '', order: Date.now() })
    setName('')
    toast('カテゴリを追加しました')
  }
  const rename = async (c: Category, v: string) => {
    const n = v.trim()
    if (n && n !== c.name) { await db.categories.update(c.id!, { name: n }); toast('変更しました') }
  }
  const remove = async (c: Category) => {
    const used = await db.transactions.where('categoryId').equals(c.id!).count()
    if (used) { toast(`${used}件の記録で使われているため削除できません`); return }
    await db.categories.delete(c.id!)
    toast('削除しました')
  }

  return (
    <Card>
      <SectionTitle en="Categories" ja="家計簿のカテゴリ" />
      <Segmented value={type} onChange={setType} className="mb-3" options={[{ value: 'expense', label: '支出' }, { value: 'income', label: '収入' }, { value: 'saving', label: '貯金' }]} />
      <ul className="divide-y divide-cream">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-1.5">
            <input aria-label="カテゴリ名" defaultValue={c.name} onBlur={(e) => rename(c, e.target.value)} className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-2 text-[16px] outline-none focus:bg-white focus:ring-1 focus:ring-sage" />
            <span className="hidden text-[11px] text-ink-faint sm:inline">{c.note}</span>
            <IconButton name="trash" label={`${c.name}を削除`} onClick={() => remove(c)} />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input className={`${inputCls} !py-2.5`} value={name} onChange={(e) => setName(e.target.value)} placeholder="新しいカテゴリ" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button variant="soft" onClick={add} className="shrink-0 !px-4 !py-2.5">追加</Button>
      </div>
    </Card>
  )
}

function DataManager() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<null | 'restore' | 'samples' | 'reset'>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)) }, [])

  const backup = async () => {
    try {
      await saveFile(await exportJSON(), backupName('json'), 'application/json')
      toast('バックアップを書き出しました')
    } catch { toast('書き出しに失敗しました') }
  }
  const csv = async () => {
    try {
      await saveFile(await exportMoneyCSV(), backupName('csv', 'mylife-money'), 'text/csv')
      toast('CSVを書き出しました')
    } catch { toast('書き出しに失敗しました') }
  }
  const pick = async (f: File | undefined) => {
    if (!f) return
    setPending(await f.text())
    setConfirm('restore')
    if (fileRef.current) fileRef.current.value = ''
  }
  const restore = async () => {
    try {
      await importJSON(pending!)
      toast('復元しました')
    } catch (e) { toast((e as Error).message || '復元に失敗しました') }
    setPending(null); setConfirm(null)
  }

  return (
    <Card>
      <SectionTitle en="Data" ja="データ管理" />
      <p className="mb-3 text-[12px] leading-relaxed text-ink-soft">
        記録はこの端末のブラウザに保存されています。ブラウザのデータ消去や機種変更に備えて、ときどきバックアップを書き出しておきましょう。
        {persisted === true && <span className="mt-1 block text-sage-deep">✓ 保存領域は「永続」に設定されています</span>}
      </p>
      <div className="space-y-2">
        <DataButton icon="download" title="バックアップを書き出す" sub="すべての記録を JSON ファイルで保存" onClick={backup} />
        <DataButton icon="upload" title="バックアップから復元" sub="JSON ファイルを読み込み（現在のデータは置き換え）" onClick={() => fileRef.current?.click()} />
        <DataButton icon="money" title="家計簿を CSV で書き出す" sub="Excel・Numbers で開けます" onClick={csv} />
        <DataButton icon="trash" title="記録だけ消す" sub="家計簿・体重・運動・チェック記録を空にします（習慣とカテゴリは残ります）" onClick={() => setConfirm('samples')} />
        <DataButton icon="trash" title="すべて消して、まっさらにする" sub="習慣・目標・リストもすべて消します。開き直してもサンプルは戻りません（色の設定は残ります）" onClick={() => setConfirm('reset')} />
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

      {confirm && (
        <div className="mt-4 rounded-2xl bg-cream p-4">
          <p className="text-[13px] text-ink">{confirm === 'restore' ? '現在のデータをバックアップの内容で置き換えます。よろしいですか？' : confirm === 'reset' ? 'すべてのデータを消して、まっさらな状態にします。元に戻せないので、必要なら先にバックアップを書き出してください。よろしいですか？' : '家計簿・体重・運動・習慣チェックの記録をすべて消します。よろしいですか？'}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => { setConfirm(null); setPending(null) }}>やめる</Button>
            <Button className="flex-1" onClick={confirm === 'restore' ? restore : confirm === 'reset' ? async () => { await resetAll(); setConfirm(null); toast('まっさらにしました') } : async () => { await deleteSampleRecords(); setConfirm(null); toast('記録を消しました') }}>
              {confirm === 'restore' ? '復元する' : confirm === 'reset' ? 'すべて消す' : '消す'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function DataButton({ icon, title, sub, onClick }: { icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-beige active:bg-cream">
      <Icon name={icon} className="shrink-0 text-sage-dark" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-ink">{title}</span>
        <span className="block text-[11px] text-ink-faint">{sub}</span>
      </span>
      <Icon name="chevR" size={16} className="text-ink-faint" />
    </button>
  )
}
