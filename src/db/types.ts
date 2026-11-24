// データモデル定義。日付はすべてローカル時刻の 'YYYY-MM-DD' 文字列で保存する。

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Habit {
  id?: number
  name: string
  category: string // 生活 / 健康 / 美容 / 時間 / 睡眠 / 家事 / お金 / 自分 など自由入力
  frequency: HabitFrequency
  weekdays: number[] // frequency = 'weekdays' のとき対象曜日（0=日〜6=土）
  optional: boolean // 「任意の日」：やった日だけ達成に加算（未実施でも達成率は下がらない）
  targetCount: number // 1期間あたりの目標回数（通常 1）
  dueWeekday?: number // weekly：実行する曜日（0=日〜6=土、未設定は日曜）
  plannedDates?: Record<string, string> // monthly：月ごとに決めた実行日 { 'YYYY-MM': 'YYYY-MM-DD' }（その月だけ有効）
  dueWeek?: number // monthly：実行する週（1=1〜7日, 2=8〜14日, 3=15〜21日, 4=22日〜月末、未設定は第1週）
  startDate: string
  memo: string
  order: number
  archived: boolean
  createdAt: number
}

// 習慣のチェック記録。periodKey は daily/weekdays='YYYY-MM-DD'、weekly=その週の月曜日の日付、monthly='YYYY-MM'
export interface HabitLog {
  id?: number
  habitId: number
  periodKey: string
  count: number
  updatedAt: number
}

export interface RestDay {
  date: string // 休息日（その日の日次習慣は達成率の計算から除外）
}

export type TxType = 'expense' | 'income' | 'saving'

export interface Category {
  id?: number
  type: TxType
  name: string
  note: string
  order: number
  budget?: number // Phase 2: カテゴリ別予算
}

export interface Transaction {
  id?: number
  date: string
  type: TxType
  amount: number // 円（整数）
  categoryId: number
  method: string
  memo: string
  recurringId?: number // 固定費から自動記録されたもの
  goalId?: number // 貯金のとき、紐づけた貯金目標
  createdAt: number
}

export interface WeightLog {
  id?: number
  date: string
  weight: number
  bodyFat?: number
  memo: string
}

export type WorkoutType = 'ランニング' | 'ウォーキング' | '筋トレ' | 'ストレッチ' | 'その他'

export interface Workout {
  id?: number
  date: string
  type: WorkoutType
  minutes: number
  distanceKm?: number
  memo: string
}

// 単発のタスク（ToDo）。dueDate は空文字なら期日なし
export interface Task {
  id?: number
  title: string
  dueDate: string
  memo: string
  done: boolean
  doneAt?: number
  createdAt: number
}

export type WishGroup = 'now' | 'next' | 'watch' | 'later'

// 欲しいものリスト。order は区分内の優先順位（小さいほど上）
export interface Wish {
  id?: number
  name: string
  price?: number
  group: WishGroup
  order: number
  memo: string
  bought: boolean
  boughtAt?: number
  createdAt: number
}

/** 1年のやりたいことリスト */
export interface BucketItem {
  id?: number
  year: number
  text: string
  memo: string
  done: boolean
  doneAt?: number
  order: number
  createdAt: number
}

// ---- Phase 2 以降で使うテーブル（スキーマだけ先に用意） ----
export interface HealthLog {
  date: string
  sleepHours?: number
  meal?: number // 1-5
  water?: number // 1-5
  condition?: number // 1-5
  fatigue?: number // 1-5
}

export interface Journal {
  id?: number
  kind: 'daily' | 'weekly' | 'monthly'
  periodKey: string
  fields: Record<string, string>
  mood?: number
  updatedAt: number
}

// 貯金目標。現在額 = initialAmount ＋ この目標に紐づけた「貯金」の記録の合計
export interface SavingsGoal {
  id?: number
  name: string
  targetAmount: number
  deadline?: string
  initialAmount?: number // 登録時点ですでに貯まっている額
  memo?: string
  order?: number
  achievedAt?: number
  createdAt: number
}

// 固定費など、毎月決まった日に自動で家計簿へ記録するもの
export interface Recurring {
  id?: number
  name: string
  type: TxType
  amount: number
  categoryId: number
  day: number // 毎月この日に記録（月末より大きければ月末）
  method: string
  memo: string
  goalId?: number // 貯金のとき、紐づける貯金目標
  active: boolean
  startMonth: string // 'YYYY-MM' この月から記録
  appliedMonths: string[] // 記録済みの月（記録を消しても再作成しないため）
  createdAt: number
}

export type GoalHorizon = '5y' | '3y' | '1y' | '6m' | '3m' | '1m'

// 長期・短期の目標（REFLECT タブ）
export interface LifeGoal {
  id?: number
  horizon: GoalHorizon
  title: string
  why: string // なぜ・なりたい姿
  deadline?: string // 'YYYY-MM-DD'
  progress: number // 0-100（自分で決める進み具合）
  now: string // 現在地
  next: string // これからどうする
  steps: { text: string; done: boolean }[] // 次のステップ
  parentId?: number // つながる長期目標
  habitIds: number[] // つながる習慣
  checkins: { date: string; progress: number; note: string }[] // 見直しの記録
  achievedAt?: number
  order: number
  createdAt: number
  updatedAt: number
}

export interface Settings {
  nickname: string
  monthlyGoal: string
  monthlyBudget: number
  savingsTarget: number // 毎月の貯金目標
  initialWeight: number | null
  targetWeight: number | null
  weeklyWorkoutGoal: number
  sleepGoal: number
  paymentMethods: string[]
  reminders?: { daily: boolean; dailyTime: string; routine: boolean; routineTime: string; journal: boolean; journalTime: string }
  navPosition?: 'side' | 'bottom' // タブの位置（左横 / 下）
  theme?: string // 旧：色のテーマ名（sage / mocha / rose / blue / milk）
  palette?: { bg: string; card: string; accent: string; text: string } // 色のカスタマイズ（背景・カード・アクセント・文字）
}

export const DEFAULT_SETTINGS: Settings = {
  nickname: '',
  monthlyGoal: '自分との約束を、ひとつずつ守る',
  monthlyBudget: 150000,
  savingsTarget: 30000,
  initialWeight: null,
  targetWeight: null,
  weeklyWorkoutGoal: 3,
  sleepGoal: 7,
  paymentMethods: ['現金', 'クレジット', '電子マネー', 'QR決済', '口座振替'],
}
