// iPhone のカレンダーに通知つきで登録できる .ics ファイルを作る（サーバー不要）
import type { Habit } from '../db/types'
import { dueWeekOf, dueWeekdayOf, scopeOf } from './habits'
import { addDays, fromKey, todayKey } from './date'

export interface Reminders {
  daily: boolean
  dailyTime: string // 'HH:MM' 日次の習慣チェック
  routine: boolean
  routineTime: string // 週次・月次の習慣
  journal: boolean
  journalTime: string // ふりかえり
}

export const DEFAULT_REMINDERS: Reminders = { daily: true, dailyTime: '21:00', routine: true, routineTime: '09:00', journal: true, journalTime: '22:00' }

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const WD_JA = ['日', '月', '火', '水', '木', '金', '土']

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

/** 75 バイトごとに折り返す（日本語は 1 文字 3 バイト） */
function fold(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0 }
    cur += ch; bytes += b
  }
  out.push(cur)
  return out.join('\r\n ')
}

interface Ev { uid: string; summary: string; desc: string; time: string; rrule: string; start?: string }

/** 繰り返しの最初の日（今日以降で条件に合う日）。DTSTART は1回目として数えられるため */
function firstDate(rrule: string, today: string): string {
  const wd = rrule.match(/BYDAY=(\w\w)/)?.[1]
  if (wd) { let d = today; while (BYDAY[fromKey(d).getDay()] !== wd) d = addDays(d, 1); return d }
  const md = rrule.match(/BYMONTHDAY=(-?\d+)/)?.[1]
  if (md) {
    const n = Number(md)
    const t = fromKey(today)
    for (let i = 0; i < 2; i++) {
      const y = t.getFullYear(), m = t.getMonth() + i
      const last = new Date(y, m + 1, 0).getDate()
      const day = n < 0 ? last : Math.min(n, last)
      const dt = new Date(y, m, day)
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      if (k >= today) return k
    }
  }
  return today
}

export function buildReminderICS(habits: Habit[], r: Reminders): { text: string; count: number } {
  const today = todayKey()
  const evs: Ev[] = []
  const active = habits.filter((h) => !h.archived)
  const daily = active.filter((h) => scopeOf(h) === 'daily' && !h.optional)

  if (r.daily && daily.length) {
    evs.push({ uid: 'daily-check', summary: 'MY LIFE｜今日の習慣をチェック', desc: daily.map((h) => `・${h.name}`).join('\n'), time: r.dailyTime, rrule: 'FREQ=DAILY' })
  }
  if (r.routine) {
    const weekly = active.filter((h) => h.frequency === 'weekly')
    for (let wd = 0; wd < 7; wd++) {
      const list = weekly.filter((h) => dueWeekdayOf(h) === wd)
      if (!list.length) continue
      evs.push({ uid: `weekly-${wd}`, summary: `MY LIFE｜週次：${list.map((h) => h.name).join('・')}`, desc: `毎週${WD_JA[wd]}曜日の習慣\n${list.map((h) => `・${h.name}`).join('\n')}`, time: r.routineTime, rrule: `FREQ=WEEKLY;BYDAY=${BYDAY[wd]}` })
    }
    const monthly = active.filter((h) => h.frequency === 'monthly')
    for (let w = 1; w <= 4; w++) {
      const list = monthly.filter((h) => dueWeekOf(h) === w)
      if (!list.length) continue
      evs.push({ uid: `monthly-${w}`, summary: `MY LIFE｜月次：${list.map((h) => h.name).join('・')}`, desc: `第${w}週から（今月中に）\n${list.map((h) => `・${h.name}`).join('\n')}`, time: r.routineTime, rrule: `FREQ=MONTHLY;BYMONTHDAY=${1 + 7 * (w - 1)}` })
    }
  }
  if (r.journal) {
    evs.push({ uid: 'journal-daily', summary: 'MY LIFE｜今日の日記', desc: '今日のことを自由に', time: r.journalTime, rrule: 'FREQ=DAILY' })
    evs.push({ uid: 'journal-weekly', summary: 'MY LIFE｜今週のふりかえり', desc: '今週できたこと・改善したいこと・来週の目標', time: r.journalTime, rrule: 'FREQ=WEEKLY;BYDAY=SU' })
    evs.push({ uid: 'journal-monthly', summary: 'MY LIFE｜今月のふりかえり', desc: '今月のベスト3・来月の目標', time: r.journalTime, rrule: 'FREQ=MONTHLY;BYMONTHDAY=-1' })
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MY LIFE//Reminders//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:MY LIFE']
  for (const e of evs) {
    const ymd = firstDate(e.rrule, today).replace(/-/g, '')
    const [hh, mm] = e.time.split(':')
    const start = `${ymd}T${hh.padStart(2, '0')}${mm.padStart(2, '0')}00`
    const end = `${ymd}T${hh.padStart(2, '0')}${String(Math.min(59, Number(mm) + 10)).padStart(2, '0')}00`
    lines.push('BEGIN:VEVENT', `UID:mylife-${e.uid}@mylife.local`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`, `RRULE:${e.rrule}`,
      `SUMMARY:${esc(e.summary)}`, `DESCRIPTION:${esc(e.desc)}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.summary)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return { text: lines.map(fold).join('\r\n') + '\r\n', count: evs.length }
}
