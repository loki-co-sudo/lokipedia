// IndexedDB スキーマ（Dexie.js）。docs/DESIGN.md §2.2 が仕様の正。
// Supabase へのアクセスは行わない（それは repository.ts の責務）。ここはローカルキャッシュの定義のみ。

import Dexie, { type EntityTable } from 'dexie'
import type { Quiz, QuizHistoryEntry, Word } from '../types'

interface MetaEntry {
  key: string
  value: string
}

class LokipediaDB extends Dexie {
  words!: EntityTable<Word, 'id'>
  quizzes!: EntityTable<Quiz, 'id'>
  quizHistory!: EntityTable<QuizHistoryEntry, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor() {
    super('lokipedia')
    this.version(1).stores({
      words: 'id, updatedAt',
      quizzes: 'id, wordId',
      quizHistory: '++id, quizId, wordId, answeredAt',
      meta: 'key',
    })
  }
}

export const db = new LokipediaDB()

export const LAST_SYNCED_AT_KEY = 'lastSyncedAt'
