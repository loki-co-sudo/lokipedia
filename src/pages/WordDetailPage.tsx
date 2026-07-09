import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sparkles, Trash2 } from 'lucide-react'
import MarkdownView from '../components/MarkdownView'
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
  updateWordTags,
} from '../lib/repository'
import { generateEntry } from '../lib/gemini'
import { getGeminiApiKey } from '../lib/settings'
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
      const result = await generateEntry(word.term, key, Array.from(tagSet))
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
    return <p className="text-sm text-slate-400">読み込み中...</p>
  }

  if (word === null) {
    return <p className="text-sm text-rose-600">単語が見つかりませんでした。</p>
  }

  const correctCount = history.filter((h) => h.isCorrect).length
  const accuracy = history.length > 0 ? Math.round((correctCount / history.length) * 100) : null

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} />}

      <div>
        <h1 className="text-2xl font-bold">{word.term}</h1>

        {editingTags === null ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {word.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                {tag}
              </span>
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditingTags(word.tags)}
                className="ml-1 text-xs text-slate-400 underline"
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
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {savingTags ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setEditingTags(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <MarkdownView>{word.definition}</MarkdownView>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">クイズ（{quizzes.length}問）</h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => void handleAddQuiz()}
              disabled={addingQuiz}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {addingQuiz ? '生成中...' : 'クイズを追加生成'}
            </button>
          )}
        </div>
        {addQuizError && <p className="text-sm text-rose-600">{addQuizError}</p>}
        {quizzes.length === 0 ? (
          <p className="text-sm text-slate-400">まだクイズがありません。</p>
        ) : (
          <ul className="space-y-2">
            {quizzes.map((quiz, i) => (
              <li key={quiz.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                問{i + 1}: {quiz.question}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">この端末での解答履歴</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">まだこの単語のクイズに解答していません。</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-slate-600">
              正答率: {accuracy}%（{correctCount} / {history.length} 問）
            </p>
            <ul className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <li key={h.id ?? i} className="flex items-center justify-between text-slate-500">
                  <span>{new Date(h.answeredAt).toLocaleString('ja-JP')}</span>
                  <span className={h.isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
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
          className="flex items-center gap-2 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? '削除中...' : 'この単語を削除'}
        </button>
      )}
    </div>
  )
}
