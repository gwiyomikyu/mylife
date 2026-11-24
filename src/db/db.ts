import Dexie, { type EntityTable } from 'dexie'
import type {
  BucketItem, Category, Habit, Task, Wish, Recurring, LifeGoal, HabitLog, HealthLog, Journal, RestDay, SavingsGoal, Settings, Transaction, WeightLog, Workout,
} from './types'
import { DEFAULT_SETTINGS } from './types'
import { MONTHLY_WEEK, WEEKLY_DAY } from './routineDefaults'

export class MyLifeDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  restDays!: EntityTable<RestDay, 'date'>
  categories!: EntityTable<Category, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  weights!: EntityTable<WeightLog, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  health!: EntityTable<HealthLog, 'date'>
  journals!: EntityTable<Journal, 'id'>
  savingsGoals!: EntityTable<SavingsGoal, 'id'>
  tasks!: EntityTable<Task, 'id'>
  wishes!: EntityTable<Wish, 'id'>
  recurring!: EntityTable<Recurring, 'id'>
  lifeGoals!: EntityTable<LifeGoal, 'id'>
  bucket!: EntityTable<BucketItem, 'id'>
  kv!: EntityTable<{ key: string; value: unknown }, 'key'>

  constructor() {
    super('mylife')
    this.version(1).stores({
      habits: '++id, frequency, order, archived',
      habitLogs: '++id, &[habitId+periodKey], habitId, periodKey',
      restDays: 'date',
      categories: '++id, type, order',
      transactions: '++id, date, type, categoryId',
      weights: '++id, date',
      workouts: '++id, date, type',
      health: 'date',
      journals: '++id, &[kind+periodKey], kind',
      savingsGoals: '++id',
      kv: 'key',
    })
    this.version(2).stores({ tasks: '++id, dueDate, done' })
    // v3：週次・月次の習慣に「実行する曜日・週」を追加。初期習慣には決まった値を入れる
    this.version(3).stores({}).upgrade((tx) =>
      tx.table('habits').toCollection().modify((h: Habit) => {
        if (h.frequency === 'weekly' && h.dueWeekday == null) h.dueWeekday = WEEKLY_DAY[h.name] ?? 0
        if (h.frequency === 'monthly' && h.dueWeek == null) h.dueWeek = MONTHLY_WEEK[h.name] ?? 1
      }))
    this.version(4).stores({ wishes: '++id, group, order' })
    this.version(5).stores({ recurring: '++id', transactions: '++id, date, type, categoryId, recurringId, goalId' })
    this.version(6).stores({ lifeGoals: '++id, horizon, parentId' })
    this.version(7).stores({ bucket: '++id, year, order' })
  }
}

export const db = new MyLifeDB()

export const TABLES = [
  'habits', 'habitLogs', 'restDays', 'categories', 'transactions', 'weights', 'workouts', 'health', 'journals', 'savingsGoals', 'tasks', 'wishes', 'recurring', 'lifeGoals', 'bucket', 'kv',
] as const

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) }
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings()
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } })
}

// 保存領域をブラウザに「永続」としてリクエスト（Safari の自動削除リスクを下げる）
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch { /* 対応していない環境では何もしない */ }
}
