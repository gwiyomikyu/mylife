export const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`
export const yenSigned = (n: number) => `${n < 0 ? '−' : '+'}¥${Math.abs(Math.round(n)).toLocaleString('ja-JP')}`
export const pct = (r: number) => `${Math.round(r * 100)}%`
export const kg = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}`)

/** 全角数字・カンマ混じりの入力を数値に */
export function parseNum(s: string): number {
  const half = s.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，\s¥円]/g, '')
  const n = Number(half)
  return Number.isFinite(n) ? n : NaN
}
