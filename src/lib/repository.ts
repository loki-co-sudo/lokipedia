// データ層。docs/DESIGN.md §2, §3 が仕様の正。
// Supabase / IndexedDB へのアクセスと snake_case↔camelCase 変換はここに閉じ込める（CLAUDE.md 絶対ルール3）。
// ページ・コンポーネントはこのモジュールの関数のみを呼び出すこと。

import { db, LAST_SYNCED_AT_KEY } from './db'
import { supabase, supabaseConfigError } from './supabase'
import type { ChoiceIndex, Quiz, Word } from '../types'

interface WordRow {
  id: string
  term: string
  definition: string
  tags: string[]
  source_url: string | null
  created_at: string
  updated_at: string
}

interface QuizRow {
  id: string
  word_id: string
  question: string
  choices: string[]
  correct_index: number
  explanation: string
  created_at: string
}

function wordFromRow(row: WordRow): Word {
  return {
    id: row.id,
    term: row.term,
    definition: row.definition,
    tags: row.tags,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function quizFromRow(row: QuizRow): Quiz {
  if (row.choices.length !== 4) {
    throw new Error('クイズの選択肢が4つではありません')
  }
  return {
    id: row.id,
    wordId: row.word_id,
    question: row.question,
    choices: row.choices as [string, string, string, string],
    correctIndex: row.correct_index as ChoiceIndex,
    explanation: row.explanation,
    createdAt: row.created_at,
  }
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabaseが設定されていません')
  }
  return supabase
}

function requireOnline() {
  if (!navigator.onLine) {
    throw new Error('オフラインです。書き込みにはネットワーク接続が必要です。')
  }
}

function canReadFromSupabase() {
  return supabase !== null && navigator.onLine
}

// ---------- 読み取り（オンライン時は Supabase、オフライン時は IndexedDB にフォールバック） ----------

export async function listWords(): Promise<Word[]> {
  if (canReadFromSupabase()) {
    try {
      const { data, error } = await supabase!
        .from('words')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as WordRow[]).map(wordFromRow)
    } catch (e) {
      console.error('[repository] listWords: Supabaseから取得できませんでした。IndexedDBにフォールバックします', e)
    }
  }
  const words = await db.words.toArray()
  return words.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getWord(id: string): Promise<Word | undefined> {
  if (canReadFromSupabase()) {
    try {
      const { data, error } = await supabase!.from('words').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data ? wordFromRow(data as WordRow) : undefined
    } catch (e) {
      console.error('[repository] getWord: Supabaseから取得できませんでした。IndexedDBにフォールバックします', e)
    }
  }
  return db.words.get(id)
}

export async function listQuizzes(wordId?: string): Promise<Quiz[]> {
  if (canReadFromSupabase()) {
    try {
      let query = supabase!.from('quizzes').select('*').order('created_at', { ascending: true })
      if (wordId) query = query.eq('word_id', wordId)
      const { data, error } = await query
      if (error) throw error
      return (data as QuizRow[]).map(quizFromRow)
    } catch (e) {
      console.error('[repository] listQuizzes: Supabaseから取得できませんでした。IndexedDBにフォールバックします', e)
    }
  }
  if (wordId) {
    return db.quizzes.where('wordId').equals(wordId).toArray()
  }
  return db.quizzes.toArray()
}

// ---------- 書き込み（オンライン必須。RLS により未ログイン時は拒否される） ----------

interface QuizInput {
  question: string
  choices: [string, string, string, string]
  correctIndex: ChoiceIndex
  explanation: string
}

export interface CreateWordInput {
  term: string
  definition: string
  tags: string[]
  sourceUrl: string | null
  quiz: QuizInput
}

export async function createWordWithQuiz(input: CreateWordInput): Promise<Word> {
  requireOnline()
  const client = requireSupabase()

  const { data: wordRow, error: wordError } = await client
    .from('words')
    .insert({
      term: input.term,
      definition: input.definition,
      tags: input.tags,
      source_url: input.sourceUrl,
    })
    .select()
    .single()
  if (wordError) throw wordError
  const word = wordFromRow(wordRow as WordRow)

  const { error: quizError } = await client.from('quizzes').insert({
    word_id: word.id,
    question: input.quiz.question,
    choices: input.quiz.choices,
    correct_index: input.quiz.correctIndex,
    explanation: input.quiz.explanation,
  })
  if (quizError) throw quizError

  await db.words.put(word)
  return word
}

export async function updateWordTags(id: string, tags: string[]): Promise<void> {
  requireOnline()
  const client = requireSupabase()
  const { error } = await client
    .from('words')
    .update({ tags, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await db.words.update(id, { tags })
}

export async function deleteWord(id: string): Promise<void> {
  requireOnline()
  const client = requireSupabase()
  const { error } = await client.from('words').delete().eq('id', id)
  if (error) throw error
  await db.words.delete(id)
  await db.quizzes.where('wordId').equals(id).delete()
}

export async function addQuiz(wordId: string, quiz: QuizInput): Promise<Quiz> {
  requireOnline()
  const client = requireSupabase()
  const { data, error } = await client
    .from('quizzes')
    .insert({
      word_id: wordId,
      question: quiz.question,
      choices: quiz.choices,
      correct_index: quiz.correctIndex,
      explanation: quiz.explanation,
    })
    .select()
    .single()
  if (error) throw error
  const created = quizFromRow(data as QuizRow)
  await db.quizzes.put(created)
  return created
}

// ---------- 同期（Supabase → IndexedDB の全件置き換え。docs/DESIGN.md §2.2） ----------

export async function syncFromSupabase(): Promise<void> {
  const client = requireSupabase()

  const [{ data: wordRows, error: wordsError }, { data: quizRows, error: quizzesError }] = await Promise.all([
    client.from('words').select('*'),
    client.from('quizzes').select('*'),
  ])
  if (wordsError) throw wordsError
  if (quizzesError) throw quizzesError

  const words = (wordRows as WordRow[]).map(wordFromRow)
  const quizzes = (quizRows as QuizRow[]).map(quizFromRow)

  await db.transaction('rw', db.words, db.quizzes, db.meta, async () => {
    await db.words.clear()
    await db.quizzes.clear()
    await db.words.bulkPut(words)
    await db.quizzes.bulkPut(quizzes)
    await db.meta.put({ key: LAST_SYNCED_AT_KEY, value: new Date().toISOString() })
  })
}

export async function getLastSyncedAt(): Promise<string | null> {
  const entry = await db.meta.get(LAST_SYNCED_AT_KEY)
  return entry?.value ?? null
}
