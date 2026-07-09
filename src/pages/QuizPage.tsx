import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import MarkdownView from '../components/MarkdownView'
import Skeleton from '../components/Skeleton'
import TagToggleList from '../components/TagToggleList'
import { addQuizHistoryEntry, listQuizzes, listWords } from '../lib/repository'
import { shuffleArray, shuffleQuizChoices, type ShuffledChoices } from '../lib/quizShuffle'
import type { Quiz, Word } from '../types'

type CountOption = 5 | 10 | 'all'

interface SessionQuiz {
  quiz: Quiz
  word: Word
  shuffled: ShuffledChoices
}

type Stage = 'setup' | 'playing' | 'result'

/**
 * クイズモード画面（docs/DESIGN.md §5.3）
 */
export default function QuizPage() {
  const [words, setWords] = useState<Word[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [countOption, setCountOption] = useState<CountOption>(10)

  const [stage, setStage] = useState<Stage>('setup')
  const [session, setSession] = useState<SessionQuiz[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [wrongEntries, setWrongEntries] = useState<SessionQuiz[]>([])

  useEffect(() => {
    Promise.all([listWords(), listQuizzes()])
      .then(([w, q]) => {
        setWords(w)
        setQuizzes(q)
      })
      .catch((e: unknown) => {
        console.error('[QuizPage] データ取得に失敗しました', e)
        setLoadError('データの取得に失敗しました。')
      })
      .finally(() => setLoading(false))
  }, [])

  const wordById = useMemo(() => {
    const map = new Map<string, Word>()
    for (const w of words) map.set(w.id, w)
    return map
  }, [words])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const w of words) for (const t of w.tags) tagSet.add(t)
    return Array.from(tagSet).sort()
  }, [words])

  const eligibleQuizzes = useMemo(() => {
    if (selectedTags.length === 0) return quizzes
    return quizzes.filter((q) => {
      const word = wordById.get(q.wordId)
      return word ? selectedTags.every((t) => word.tags.includes(t)) : false
    })
  }, [quizzes, selectedTags, wordById])

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function handleStart() {
    const shuffledOrder = shuffleArray(eligibleQuizzes)
    const count = countOption === 'all' ? shuffledOrder.length : Math.min(countOption, shuffledOrder.length)
    const picked = shuffledOrder.slice(0, count)
    const newSession: SessionQuiz[] = picked
      .map((quiz) => {
        const word = wordById.get(quiz.wordId)
        if (!word) return null
        return { quiz, word, shuffled: shuffleQuizChoices(quiz) }
      })
      .filter((s): s is SessionQuiz => s !== null)

    setSession(newSession)
    setCurrentIndex(0)
    setSelectedChoice(null)
    setAnswered(false)
    setWrongEntries([])
    setStage('playing')
  }

  function handleSelectChoice(choiceIndex: number) {
    if (answered) return
    const current = session[currentIndex]
    const isCorrect = choiceIndex === current.shuffled.correctIndex
    setSelectedChoice(choiceIndex)
    setAnswered(true)
    if (!isCorrect) setWrongEntries((prev) => [...prev, current])

    addQuizHistoryEntry({
      quizId: current.quiz.id,
      wordId: current.word.id,
      selectedIndex: choiceIndex,
      isCorrect,
      answeredAt: new Date().toISOString(),
    }).catch((e: unknown) => console.error('[QuizPage] 解答履歴の保存に失敗しました', e))
  }

  function handleNext() {
    if (currentIndex + 1 >= session.length) {
      setStage('result')
      return
    }
    setCurrentIndex((i) => i + 1)
    setSelectedChoice(null)
    setAnswered(false)
  }

  function handleRestart() {
    setStage('setup')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (loadError) {
    return <p className="text-sm text-rose-600">{loadError}</p>
  }

  if (stage === 'setup') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">クイズ</h1>

        {allTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-600">タグで絞り込み（未選択なら全件）</p>
            <TagToggleList tags={allTags} selected={selectedTags} onToggle={toggleTag} />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-600">出題数</p>
          <div className="flex gap-2">
            {([5, 10, 'all'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setCountOption(opt)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  countOption === opt ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {opt === 'all' ? '全部' : `${opt}問`}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-500">対象クイズ: {eligibleQuizzes.length}問</p>

        {eligibleQuizzes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            対象のクイズがありません。
          </p>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white"
          >
            クイズを始める
          </button>
        )}
      </div>
    )
  }

  if (stage === 'playing') {
    const current = session[currentIndex]
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {currentIndex + 1} / {session.length} 問
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold">{current.quiz.question}</p>
          <ul className="mt-3 space-y-2">
            {current.shuffled.choices.map((choice, i) => {
              let style = 'bg-slate-50 text-slate-700'
              if (answered) {
                if (i === current.shuffled.correctIndex) style = 'bg-emerald-100 text-emerald-800 font-semibold'
                else if (i === selectedChoice) style = 'bg-rose-100 text-rose-800'
              }
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={answered}
                    onClick={() => handleSelectChoice(i)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${style} disabled:cursor-default`}
                  >
                    {choice}
                  </button>
                </li>
              )
            })}
          </ul>

          {answered && (
            <div className="mt-4 space-y-3">
              <p
                className={`text-sm font-semibold ${
                  selectedChoice === current.shuffled.correctIndex ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {selectedChoice === current.shuffled.correctIndex ? '正解！' : '不正解'}
              </p>
              <div>
                <p className="text-xs font-semibold text-slate-500">解説</p>
                <MarkdownView>{current.quiz.explanation}</MarkdownView>
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white"
              >
                {currentIndex + 1 >= session.length ? '結果を見る' : '次へ'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // stage === 'result'
  const score = session.length - wrongEntries.length
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">結果</h1>
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-center text-lg font-semibold">
        {session.length}問中 {score}問正解
      </p>

      {wrongEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-600">間違えた問題</p>
          <ul className="space-y-2">
            {wrongEntries.map((entry, i) => (
              <li key={`${entry.quiz.id}-${i}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <Link to={`/dictionary/${entry.word.id}`} className="text-sm font-semibold text-sky-600 underline">
                  {entry.word.term}
                </Link>
                <p className="mt-1 text-sm text-slate-600">{entry.quiz.question}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleRestart}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700"
      >
        <RotateCcw className="h-4 w-4" />
        もう一度
      </button>
    </div>
  )
}
