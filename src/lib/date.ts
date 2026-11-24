// ローカル日付ユーティリティ（'YYYY-MM-DD' 文字列ベース）

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** 週の開始日（月曜日）を返す */
export function weekStart(key: string): string {
  const d = fromKey(key)
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return toKey(d)
}

export function weekDays(key: string): string[] {
  const s = weekStart(key)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

export function monthKey(key: string): string {
  return key.slice(0, 7)
}

export function addMonths(mKey: string, n: number): string {
  const [y, m] = mKey.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthRange(mKey: string): [string, string] {
  const [y, m] = mKey.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return [`${mKey}-01`, `${mKey}-${pad(last)}`]
}

export const WD_JA = ['日', '月', '火', '水', '木', '金', '土']
export const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
export const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function formatJa(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日（${WD_JA[d.getDay()]}）`
}

export function formatMonthJa(mKey: string): string {
  const [y, m] = mKey.split('-').map(Number)
  return `${y}年${m}月`
}

export function formatWeekJa(startKey: string): string {
  const s = fromKey(startKey)
  const e = fromKey(addDays(startKey, 6))
  return `${s.getMonth() + 1}/${s.getDate()} – ${e.getMonth() + 1}/${e.getDate()}`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Good night'
  if (h < 11) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** 日付から決まる日替わりメッセージ */
const MESSAGES = [
  '今日も自分を大切にする1日にしよう。',
  '小さな一歩も、ちゃんと前進。',
  'できたことに目を向けてみよう。',
  '深呼吸して、自分のペースで。',
  '整った部屋は、整った心をつくる。',
  'がんばりすぎない日があってもいい。',
  '昨日の自分より、ほんの少しやさしく。',
  'お水を一杯。それだけでも素敵なスタート。',
  '自分との約束は、自分へのプレゼント。',
  '今日の「できた」を、ひとつ見つけよう。',
  '休むことも、立派なセルフケア。',
  'ていねいな暮らしは、ちいさな習慣から。',
  'いつからでも、何度でも、また始められる。',
  '心と身体の声に、耳をすませて。',
]
export function dailyMessage(key: string): string {
  const n = key.split('-').reduce((a, b) => a * 31 + Number(b), 7)
  return MESSAGES[Math.abs(n) % MESSAGES.length]
}
