import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sparkles, Trash2 } from 'lucide-react'
import MarkdownView from '../components/MarkdownView'
import Skeleton from '../components/Skeleton'
import TagChipInput from '../components/TagChipInput'
import Toast from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import {
  addQuiz,
  deleteWord,
  getWord,
  listQuizHistoryForWord,
  listQuizzes,
  listWords,
  updateWordReading,
  updateWordTags,
} from '../lib/repository'
import { generateEntry } from '../lib/gemini'
import { getAnswerMode, getGeminiApiKey } from '../lib/settings'
import type { Quiz, QuizHistoryEntry, Word } from '../types'

/**
 * 単語詳細画面（docs/DESIGN.md §5.2）
 */
export default function WordDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [word, setWord] = useState<Word | null | undefined>(undefined)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [history, setHistory] = useState<QuizHistoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editingTags, setEditingTags] = useState<string[] | null>(null)
  const [savingTags, setSavingTags] = useState(false)

  const [editingReading, setEditingReading] = useState<string | null>(null)
  const [savingReading, setSavingReading] = useState(false)

  const [deleting, setDeleting] = useState(false)
  const [addingQuiz, setAddingQuiz] = useState(false)
  const [addQuizError, setAddQuizError] = useState<string | null>(null)

  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getWord(id), listQuizzes(id), listQuizHistoryForWord(id)])
      .then(([w, qs, h]) => {
        setWord(w ?? null)
        setQuizzes(qs)
        setHistory(h)
      })
      .catch((e: unknown) => {
        console.error('[WordDetailPage] データ取得に失敗しました', e)
        setError('データの取得に失敗しました。')
      })
  }, [id])

  async function handleSaveTags() {
    if (!id || !editingTags) return
    setSavingTags(true)
    try {
      await updateWordTags(id, editingTags)
      setWord((w) => (w ? { ...w, tags: editingTags } : w))
      setEditingTags(null)
    } catch (e) {
      console.error('[WordDetailPage] タグの更新に失敗しました', e)
      setError('タグの更新に失敗しました。')
    } finally {
      setSavingTags(false)
    }
  }

  async function handleSaveReading() {
    if (!id || editingReading === null) return
    setSavingReading(true)
    try {
      const reading = editingReading.trim()
      await updateWordReading(id, reading)
      setWord((w) => (w ? { ...w, reading } : w))
      setEditingReading(null)
    } catch (e) {
      console.error('[WordDetailPage] よみがなの更新に失敗しました', e)
      setError('よみがなの更新に失敗しました。')
    } finally {
      setSavingReading(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!window.confirm('この単語を削除しますか？関連するクイズもすべて削除されます。')) return
    setDeleting(true)
    try {
      await deleteWord(id)
      navigate('/dictionary')
    } catch (e) {
      console.error('[WordDetailPage] 削除に失敗しました', e)
      setError('削除に失敗しました。')
      setDeleting(false)
    }
  }

  async function handleAddQuiz() {
    if (!word) return
    setAddingQuiz(true)
    setAddQuizError(null)
    try {
      const key = getGeminiApiKey()
      if (!key) throw new Error('Gemini APIキーが設定されていません。設定画面で登録してください。')
      const allWords = await listWords()
      const tagSet = new Set<string>()
      for (const w of allWords) for (const t of w.tags) tagSet.add(t)
      const result = await generateEntry(word.term, key, Array.from(tagSet), getAnswerMode())
      const created = await addQuiz(word.id, result.quiz)
      setQuizzes((prev) => [...prev, created])
      setToast('クイズを追加しました')
    } catch (e) {
      setAddQuizError(e instanceof Error ? e.message : 'クイズの追加生成に失敗しました。')
    } finally {
      setAddingQuiz(false)
    }
  }

  if (word === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }

  if (word === null) {
    return <p className="text-sm text-app-danger">単語が見つかりませんでした。</p>
  }

  const correctCount = history.filter((h) => h.isCorrect).length
  const accuracy = history.length > 0 ? Math.round((correctCount / history.length) * 100) : null

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold break-words">{word.term}</h1>

        {isAdmin && (
          <div className="mt-1 flex items-center gap-2 text-sm text-app-text-muted">
            {editingReading === null ? (
              <>
                <span>よみがな: {word.reading ?? '未設定'}</span>
                <button
                  type="button"
                  onClick={() => setEditingReading(word.reading ?? '')}
                  className="text-xs text-app-text-muted underline"
                >
                  編集
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={editingReading}
                  onChange={(e) => setEditingReading(e.target.value)}
                  placeholder="ひらがな"
                  className="rounded-lg border border-app-border px-2 py-1 text-base outline-none focus:border-app-accent"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveReading()}
                  disabled={savingReading}
                  className="rounded-lg bg-app-accent px-3 py-1 text-xs font-semibold text-app-on-accent disabled:opacity-40"
                >
                  {savingReading ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingReading(null)}
                  className="rounded-lg border border-app-border px-3 py-1 text-xs font-semibold text-app-text"
                >
                  キャンセル
                </button>
              </>
            )}
          </div>
        )}

        {editingTags === null ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {word.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-app-accent/10 px-2 py-0.5 text-xs font-medium text-app-accent">
                {tag}
              </span>
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditingTags(word.tags)}
                className="ml-1 text-xs text-app-text-muted underline"
              >
                編集
              </button>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <TagChipInput value={editingTags} onChange={setEditingTags} placeholder="タグ" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSaveTags()}
                disabled={savingTags}
                className="rounded-lg bg-app-accent px-3 py-1.5 text-xs font-semibold text-app-on-accent disabled:opacity-40"
              >
                {savingTags ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setEditingTags(null)}
                className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-semibold text-app-text"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-app-danger">{error}</p>}

      <MarkdownView>{word.definition}</MarkdownView>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">クイズ（{quizzes.length}問）</h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => void handleAddQuiz()}
              disabled={addingQuiz}
              className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-1.5 text-xs font-semibold text-app-text disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {addingQuiz ? '生成中...' : 'クイズを追加生成'}
            </button>
          )}
        </div>
        {addQuizError && <p className="text-sm text-app-danger">{addQuizError}</p>}
        {quizzes.length === 0 ? (
          <p className="text-sm text-app-text-muted">まだクイズがありません。</p>
        ) : (
          <ul className="space-y-2">
            {quizzes.map((quiz, i) => (
              <li key={quiz.id} className="break-words rounded-xl border border-app-border bg-app-surface p-3 text-sm">
                問{i + 1}: {quiz.question}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">この端末での解答履歴</h2>
        {history.length === 0 ? (
          <p className="text-sm text-app-text-muted">まだこの単語のクイズに解答していません。</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-app-text-muted">
              正答率: {accuracy}%（{correctCount} / {history.length} 問）
            </p>
            <ul className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <li key={h.id ?? i} className="flex items-center justify-between text-app-text-muted">
                  <span>{new Date(h.answeredAt).toLocaleString('ja-JP')}</span>
                  <span className={h.isCorrect ? 'text-app-success' : 'text-app-danger'}>
                    {h.isCorrect ? '正解' : '不正解'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {isAdmin && (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="flex items-center gap-2 rounded-xl border border-app-danger/40 px-4 py-2 text-sm font-semibold text-app-danger disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? '削除中...' : 'この単語を削除'}
        </button>
      )}
    </div>
  )
}
