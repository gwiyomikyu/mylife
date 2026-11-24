// 色のカスタマイズ。背景・カード・アクセント・文字の4色から、アプリで使う全色を計算する
export interface Palette { bg: string; card: string; accent: string; text: string }
export type PaletteKey = keyof Palette

export const DEFAULT_PALETTE: Palette = { bg: '#F7EEEC', card: '#FDFBF7', accent: '#A68A73', text: '#5C4A3E' }

export interface Swatch { hex: string; name: string }

export const SWATCHES: Record<PaletteKey, Swatch[]> = {
  bg: [
    { hex: '#F7EEEC', name: 'ペールピンク' }, { hex: '#F8ECEE', name: 'ローズ' }, { hex: '#FBF0EA', name: 'ピーチ' },
    { hex: '#FAF0E4', name: 'アプリコット' }, { hex: '#F3ECE4', name: 'ミルクティー' }, { hex: '#F2EBDF', name: 'ベージュ' },
    { hex: '#EFE8DC', name: 'サンド' }, { hex: '#FAF8F3', name: 'アイボリー' }, { hex: '#F8F7F4', name: 'オフホワイト' },
    { hex: '#FAF7E8', name: 'レモン' }, { hex: '#F1F3EC', name: 'セージ' }, { hex: '#EFF5F0', name: 'ミント' },
    { hex: '#EEF3F6', name: 'ペールブルー' }, { hex: '#EDF0F7', name: 'スカイ' }, { hex: '#F2EFF5', name: 'ラベンダー' },
    { hex: '#F4EEF4', name: 'ライラック' }, { hex: '#F1EFEC', name: 'グレージュ' }, { hex: '#F2F2F1', name: 'ライトグレー' },
  ],
  card: [
    { hex: '#FDFBF7', name: 'ミルク' }, { hex: '#FFFFFF', name: 'ホワイト' }, { hex: '#FFFBF2', name: 'クリーム' },
    { hex: '#FEFAEE', name: 'バニラ' }, { hex: '#FBF7F1', name: 'ペールベージュ' }, { hex: '#FFF7F6', name: 'ペールピンク' },
    { hex: '#FBF9FD', name: 'ラベンダー' }, { hex: '#F9FBFD', name: 'ペールブルー' }, { hex: '#F8FCF9', name: 'ペールミント' },
    { hex: '#FAFAF9', name: 'ライトグレー' },
  ],
  accent: [
    { hex: '#A68A73', name: 'モカ' }, { hex: '#94735A', name: 'ブラウン' }, { hex: '#8C7262', name: 'ココア' },
    { hex: '#C4A27A', name: 'キャメル' }, { hex: '#D4B483', name: 'ハニー' }, { hex: '#C9AE6A', name: 'マスタード' },
    { hex: '#D99A84', name: 'コーラル' }, { hex: '#C08068', name: 'テラコッタ' }, { hex: '#D8AEA8', name: 'ローズ' },
    { hex: '#C99A9A', name: 'ダスティローズ' }, { hex: '#9E6B74', name: 'ワイン' }, { hex: '#B497A8', name: 'モーブ' },
    { hex: '#A79BBF', name: 'ラベンダー' }, { hex: '#6F7F99', name: 'ネイビー' }, { hex: '#8C9DAD', name: 'ブルーグレー' },
    { hex: '#A2B8C2', name: 'ダスティブルー' }, { hex: '#7FA3A0', name: 'ティール' }, { hex: '#8FB8A8', name: 'ミント' },
    { hex: '#A3B394', name: 'セージ' }, { hex: '#B3BE8E', name: 'ピスタチオ' }, { hex: '#9A9A6E', name: 'オリーブ' },
    { hex: '#A89F94', name: 'グレージュ' }, { hex: '#9AA2A0', name: 'スモーク' }, { hex: '#7A7672', name: 'チャコール' },
  ],
  text: [
    { hex: '#5C4A3E', name: 'ココア' }, { hex: '#4E3F35', name: 'ブラウン' }, { hex: '#5A524C', name: 'グレーブラウン' },
    { hex: '#4D3B45', name: 'プラム' }, { hex: '#3A4150', name: 'ネイビー' }, { hex: '#33484A', name: 'ディープティール' },
    { hex: '#434634', name: 'ダークオリーブ' }, { hex: '#3B3935', name: 'チャコール' }, { hex: '#444444', name: 'ダークグレー' },
    { hex: '#2B2B2B', name: 'ブラック' },
  ],
}

/** おすすめの組み合わせ */
export const PRESETS: { name: string; p: Palette }[] = [
  { name: 'ミルク×モカ', p: DEFAULT_PALETTE },
  { name: 'アイボリー×セージ', p: { bg: '#FAF8F3', card: '#FFFFFF', accent: '#A3B394', text: '#3B3935' } },
  { name: 'ミルクティー', p: { bg: '#F3ECE4', card: '#FFFBF2', accent: '#C4A27A', text: '#4E3F35' } },
  { name: 'ローズ', p: { bg: '#F8ECEE', card: '#FFF7F6', accent: '#C99A9A', text: '#4D3B45' } },
  { name: 'ラベンダー', p: { bg: '#F2EFF5', card: '#FBF9FD', accent: '#A79BBF', text: '#3A4150' } },
  { name: 'ダスティブルー', p: { bg: '#EEF3F6', card: '#FFFFFF', accent: '#8C9DAD', text: '#3A4150' } },
  { name: 'ミント', p: { bg: '#EFF5F0', card: '#F8FCF9', accent: '#7FA3A0', text: '#33484A' } },
  { name: 'ハニー', p: { bg: '#FAF7E8', card: '#FFFFFF', accent: '#C9AE6A', text: '#434634' } },
]

/** 以前の「テーマ名」（sage など）を4色に置き換える */
export const LEGACY: Record<string, Palette> = {
  milk: DEFAULT_PALETTE,
  sage: PRESETS[1].p,
  mocha: { bg: '#F8F5F0', card: '#FFFFFF', accent: '#BFA68D', text: '#3D3631' },
  rose: { bg: '#FCF8F6', card: '#FFFFFF', accent: '#D8AEA8', text: '#3F3634' },
  blue: { bg: '#F7F8F7', card: '#FFFFFF', accent: '#A2B8C2', text: '#343A3D' },
}

type RGB = [number, number, number]
const toRgb = (hex: string): RGB => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t)) as RGB
const lum = (c: RGB) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
export const contrast = (a: RGB, b: RGB) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const BLACK: RGB = [0, 0, 0]

/** 背景色に対して必要なコントラストが出るまで少しずつ濃くする */
function darkenUntil(base: RGB, toward: RGB, start: number, against: RGB, min: number): RGB {
  let t = start
  let c = mix(base, toward, t)
  while (contrast(c, against) < min && t < 0.9) { t += 0.03; c = mix(base, toward, t) }
  return c
}
function lightenUntil(text: RGB, bg: RGB, start: number, against: RGB, min: number): RGB {
  let t = start
  let c = mix(text, bg, t)
  while (contrast(c, against) < min && t > 0) { t -= 0.03; c = mix(text, bg, Math.max(0, t)) }
  return c
}

/** 4色 → CSS変数（R G B） */
export function paletteVars(p: Palette): Record<string, string> {
  const bg = toRgb(p.bg), card = toRgb(p.card), accent = toRgb(p.accent), text = toRgb(p.text)
  const dark = darkenUntil(accent, BLACK, 0.17, card, 4)
  const deep = darkenUntil(accent, BLACK, 0.35, card, 5.5)
  const v: Record<string, RGB> = {
    ivory: bg,
    cream: mix(bg, text, 0.05),
    beige: mix(bg, text, 0.1),
    greige: mix(bg, text, 0.22),
    stone: mix(bg, text, 0.5),
    stonedark: mix(bg, text, 0.75),
    sagelight: mix(card, accent, 0.2),
    sage: accent,
    sagedark: dark,
    sagedeep: deep,
    ink: text,
    inksoft: lightenUntil(text, bg, 0.2, bg, 5),
    inkfaint: lightenUntil(text, bg, 0.42, bg, 3),
    clay: mix(accent, [201, 153, 139], 0.5),
    card,
  }
  return Object.fromEntries(Object.entries(v).map(([k, c]) => [`--c-${k}`, c.join(' ')]))
}

export function applyPalette(p: Palette) {
  const root = document.documentElement
  Object.entries(paletteVars(p)).forEach(([k, val]) => root.style.setProperty(k, val))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg)
}

export const samePalette = (a: Palette, b: Palette) => (Object.keys(a) as PaletteKey[]).every((k) => a[k].toLowerCase() === b[k].toLowerCase())
export const swatchName = (k: PaletteKey, hex: string) => SWATCHES[k].find((s) => s.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex
