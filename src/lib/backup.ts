import { db, TABLES } from '../db/db'
import { todayKey } from './date'

const APP = 'MY LIFE'
const FORMAT_VERSION = 1

export async function exportJSON(): Promise<string> {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  return JSON.stringify({ app: APP, format: FORMAT_VERSION, exportedAt: new Date().toISOString(), data }, null, 2)
}

export async function importJSON(text: string) {
  const parsed = JSON.parse(text)
  if (parsed?.app !== APP || typeof parsed.data !== 'object') throw new Error('MY LIFE のバックアップファイルではありません')
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = parsed.data[t]
      if (!Array.isArray(rows)) continue
      await db.table(t).clear()
      await db.table(t).bulkAdd(rows)
    }
  })
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportMoneyCSV(): Promise<string> {
  const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c.name]))
  const rows = await db.transactions.orderBy('date').toArray()
  const TYPE = { expense: '支出', income: '収入', saving: '貯金' } as const
  const lines = [['日付', '区分', 'カテゴリ', '金額', '支払い方法', 'メモ'].join(',')]
  for (const r of rows) lines.push([r.date, TYPE[r.type], cats.get(r.categoryId) ?? '', r.amount, r.method, r.memo].map(csvCell).join(','))
  return '﻿' + lines.join('\r\n') // Excel で文字化けしないよう BOM 付き
}

/** ファイル保存。iPhone では共有シート（「ファイルに保存」）を優先し、使えなければダウンロードする */
type DownloadsNS = { save: (r: { filename: string; data: string | Blob }) => Promise<unknown> }
type ClaudeHost = { use: (name: string) => Promise<unknown> }
let downloadsNS: Promise<DownloadsNS | null> | null = null
/** claude.ai の共有ページ上で開いているときは、ページ側の保存機能を使う */
function hostDownloads(): Promise<DownloadsNS | null> {
  const c = (window as unknown as { claude?: ClaudeHost }).claude
  if (!c?.use) return Promise.resolve(null)
  downloadsNS ??= c.use('downloads').then((d) => (d as DownloadsNS) ?? null).catch(() => null)
  return downloadsNS
}
// 起動時に先読みしておく（保存ボタンのタップ中に待たずに済むように）
setTimeout(() => { hostDownloads() }, 0)

export async function saveFile(text: string, filename: string, mime: string) {
  const host = await hostDownloads()
  if (host) {
    try {
      await host.save({ filename, data: text })
      return
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'declined') return
      if (code !== 'unavailable' && code !== 'not_granted') throw e
    }
  }
  const blob = new Blob([text], { type: mime })
  const file = new File([blob], filename, { type: mime })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const backupName = (ext: string, prefix = 'mylife-backup') => `${prefix}-${todayKey()}.${ext}`
