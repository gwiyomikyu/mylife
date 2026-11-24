import { db, saveSettings } from './db'
import { MONTHLY_WEEK, WEEKLY_DAY } from './routineDefaults'
import type { Category, Habit, HabitFrequency, HabitLog, TxType } from './types'
import { addDays, todayKey, weekStart } from '../lib/date'

type SeedHabit = [string, string, HabitFrequency, boolean?]

const HABITS: SeedHabit[] = [
  ['5分間の部屋の片付け', '生活', 'daily'],
  ['使ったものを元に戻す', '生活', 'daily'],
  ['水分を十分に摂る', '健康', 'daily'],
  ['栄養バランスを意識する', '健康', 'daily'],
  ['身体を動かす', '健康', 'daily', true],
  ['スキンケア', '美容', 'daily'],
  ['スマホ時間を意識する', '時間', 'daily'],
  ['睡眠時間を確保する', '睡眠', 'daily'],
  ['部屋全体の掃除', '家事', 'weekly'],
  ['洗濯・寝具の整理', '家事', 'weekly'],
  ['水回りの掃除', '家事', 'weekly'],
  ['1週間の支出確認', 'お金', 'weekly'],
  ['翌週の予定確認', '時間', 'weekly'],
  ['運動回数の確認', '健康', 'weekly'],
  ['食材・日用品の補充', '生活', 'weekly'],
  ['自分のための時間を確保する', '自分', 'weekly'],
  ['月間収支の集計', 'お金', 'monthly'],
  ['貯金額の確認', 'お金', 'monthly'],
  ['体重・身体の変化の確認', '健康', 'monthly'],
  ['部屋の不要品整理', '生活', 'monthly'],
  ['美容・身だしなみのメンテナンス', '美容', 'monthly'],
  ['翌月の目標設定', '自分', 'monthly'],
  ['今月頑張ったことを3つ記録', '自分', 'monthly'],
  ['翌月の予算設定', 'お金', 'monthly'],
]

const CATEGORIES: [TxType, string, string][] = [
  ['expense', '食費', '外食・コンビニ・食材'],
  ['expense', '交通費', '電車・タクシーなど'],
  ['expense', '美容', '化粧品・美容院・ネイル'],
  ['expense', '衣服', '洋服・靴・バッグ'],
  ['expense', '日用品', '消耗品・生活用品'],
  ['expense', '交際費', '友人との食事・プレゼント'],
  ['expense', '趣味', 'ライブ・旅行・娯楽'],
  ['expense', '固定費', '家賃・通信費・サブスク'],
  ['expense', 'その他', '上記以外'],
  ['income', '給与', ''],
  ['income', '副収入', ''],
  ['income', 'その他収入', ''],
  ['saving', '先取り貯金', ''],
  ['saving', '積立・投資', ''],
]

export async function seedIfEmpty() {
  const seeded = await db.kv.get('seeded')
  if (seeded) return
  await db.transaction('rw', [db.habits, db.categories, db.kv, db.habitLogs, db.transactions, db.weights, db.workouts], async () => {
    await seedBase()
    await seedSamples()
    await db.kv.put({ key: 'seeded', value: Date.now() })
  })
}

async function seedBase() {
  const start = todayKey()
  const now = Date.now()
  const habits: Habit[] = HABITS.map(([name, category, frequency, optional], i) => ({
    name, category, frequency, optional: !!optional, weekdays: [], targetCount: 1,
    startDate: addDays(start, -14), memo: '', order: i, archived: false, createdAt: now,
    ...(frequency === 'weekly' ? { dueWeekday: WEEKLY_DAY[name] ?? 0 } : {}),
    ...(frequency === 'monthly' ? { dueWeek: MONTHLY_WEEK[name] ?? 1 } : {}),
  }))
  await db.habits.bulkAdd(habits)
  const cats: Category[] = CATEGORIES.map(([type, name, note], i) => ({ type, name, note, order: i }))
  await db.categories.bulkAdd(cats)
}

/** 動きがわかるように、直近の記録を少しだけサンプルとして入れておく（設定から削除可） */
async function seedSamples() {
  const today = todayKey()
  const habits = await db.habits.toArray()
  const daily = habits.filter((h) => h.frequency === 'daily' && !h.optional)
  const logs: Omit<HabitLog, 'id'>[] = []
  for (let d = 1; d <= 6; d++) {
    const key = addDays(today, -d)
    daily.forEach((h, i) => {
      if ((i + d) % 3 !== 0) logs.push({ habitId: h.id!, periodKey: key, count: 1, updatedAt: Date.now() })
    })
  }
  const ws = weekStart(today)
  const weekly = habits.filter((h) => h.frequency === 'weekly').slice(0, 2)
  weekly.forEach((h) => logs.push({ habitId: h.id!, periodKey: ws, count: 1, updatedAt: Date.now() }))
  await db.habitLogs.bulkAdd(logs)

  const cats = await db.categories.toArray()
  const cid = (name: string) => cats.find((c) => c.name === name)!.id!
  const m = today.slice(0, 7)
  const day = (n: number) => `${m}-${String(Math.min(n, Number(today.slice(8)))).padStart(2, '0')}`
  await db.transactions.bulkAdd([
    { date: day(1), type: 'income', amount: 250000, categoryId: cid('給与'), method: '口座振替', memo: 'サンプル', createdAt: Date.now() },
    { date: day(1), type: 'expense', amount: 78000, categoryId: cid('固定費'), method: '口座振替', memo: '家賃（サンプル）', createdAt: Date.now() },
    { date: day(1), type: 'saving', amount: 30000, categoryId: cid('先取り貯金'), method: '口座振替', memo: 'サンプル', createdAt: Date.now() },
    { date: day(3), type: 'expense', amount: 3280, categoryId: cid('食費'), method: 'クレジット', memo: 'スーパー', createdAt: Date.now() },
    { date: day(5), type: 'expense', amount: 1650, categoryId: cid('日用品'), method: '電子マネー', memo: '', createdAt: Date.now() },
    { date: day(8), type: 'expense', amount: 4800, categoryId: cid('美容'), method: 'クレジット', memo: 'スキンケア', createdAt: Date.now() },
  ])
  await db.weights.bulkAdd([
    { date: addDays(today, -20), weight: 55.2, memo: '' },
    { date: addDays(today, -13), weight: 54.9, memo: '' },
    { date: addDays(today, -6), weight: 54.6, memo: '' },
    { date: addDays(today, -1), weight: 54.4, memo: '' },
  ])
  await db.workouts.bulkAdd([
    { date: addDays(today, -1), type: 'ウォーキング', minutes: 30, distanceKm: 2.5, memo: '' },
    { date: addDays(today, -3), type: 'ストレッチ', minutes: 15, memo: '' },
  ])
  await saveSettings({ initialWeight: 55.2, targetWeight: 52 })
}

export async function deleteSampleRecords() {
  await db.transaction('rw', [db.transactions, db.weights, db.workouts, db.habitLogs], async () => {
    await db.transactions.clear()
    await db.weights.clear()
    await db.workouts.clear()
    await db.habitLogs.clear()
  })
}
