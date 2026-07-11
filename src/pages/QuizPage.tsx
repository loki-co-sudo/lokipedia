import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import lokiPortrait from '../assets/loki-portrait.webp'
import Confetti from '../components/Confetti'
import MarkdownView from '../components/MarkdownView'
import Skeleton from '../components/Skeleton'
import TagToggleList from '../components/TagToggleList'
import { addQuizHistoryEntry, listQuizzes, listWords } from '../lib/repository'
import { shuffleArray, shuffleQuizChoices, type ShuffledChoices } from '../lib/quizShuffle'
import type { Quiz, Word } from '../types'

type CountOption = 5 | 10 | 'all'

/** 満点時にロキから贈られる祝福メッセージ（DESIGN.md §4.2 のロキ人格＝馴れ馴れしいが憎めないトリックスター）。 */
const PERFECT_SCORE_MESSAGES = [
  '……お見事。全問正解とはね。俺の悪知恵をもってしても、これは称賛するしかないな。',
  'ほう、満点か。仕込んだ罠を涼しい顔で潜り抜けるとは、なかなかやるじゃないか。',
  '全問正解、乾杯だ。……妬ましいから、これは内緒にしといてやるよ。',
  'やるじゃないか、相棒。次はもっと厄介な謎を用意しておくとしよう。',
  '見事なもんだ。俺の企みを丸ごと打ち破るとは、大した知恵者だよ、お前は。',
]

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
  const [perfectMessage, setPerfectMessage] = useState<string | null>(null)

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
      // タグは OR 検索: 選択したタグのいずれかを持つ単語のクイズを出題対象にする
      return word ? selectedTags.some((t) => word.tags.includes(t)) : false
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
    setPerfectMessage(null)
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
      if (wrongEntries.length === 0) {
        setPerfectMessage(PERFECT_SCORE_MESSAGES[Math.floor(Math.random() * PERFECT_SCORE_MESSAGES.length)])
      }
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
    return <p className="text-sm text-app-danger">{loadError}</p>
  }

  if (stage === 'setup') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">クイズ</h1>

        {allTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-app-text-muted">タグで絞り込み（未選択なら全件）</p>
            <TagToggleList tags={allTags} selected={selectedTags} onToggle={toggleTag} onBulkChange={setSelectedTags} />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-app-text-muted">出題数</p>
          <div className="flex gap-2">
            {([5, 10, 'all'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setCountOption(opt)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  countOption === opt ? 'bg-app-accent text-app-on-accent' : 'bg-app-surface-2 text-app-text-muted'
                }`}
              >
                {opt === 'all' ? '全部' : `${opt}問`}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-app-text-muted">対象クイズ: {eligibleQuizzes.length}問</p>

        {eligibleQuizzes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-app-border p-8 text-center text-sm text-app-text-muted">
            対象のクイズがありません。
          </p>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-xl bg-app-accent px-4 py-3 font-semibold text-app-on-accent"
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
        <p className="text-sm text-app-text-muted">
          {currentIndex + 1} / {session.length} 問
        </p>
        <div className="rounded-xl border border-app-border bg-app-surface p-4">
          <p className="break-words font-semibold">{current.quiz.question}</p>
          <ul className="mt-3 space-y-2">
            {current.shuffled.choices.map((choice, i) => {
              let style = 'bg-app-surface-2 text-app-text'
              if (answered) {
                if (i === current.shuffled.correctIndex) style = 'bg-app-success/15 text-app-success font-semibold'
                else if (i === selectedChoice) style = 'bg-app-danger/15 text-app-danger'
              }
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={answered}
                    onClick={() => handleSelectChoice(i)}
                    className={`flex w-full gap-2 rounded-lg px-3 py-2 text-left text-sm ${style} disabled:cursor-default`}
                  >
                    <span className="shrink-0 font-semibold">{i + 1}.</span>
                    <span className="break-words">{choice}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {answered && (
            <div className="mt-4 space-y-3">
              <p
                className={`text-sm font-semibold ${
                  selectedChoice === current.shuffled.correctIndex ? 'text-app-success' : 'text-app-danger'
                }`}
              >
                {selectedChoice === current.shuffled.correctIndex
                  ? '正解！'
                  : `不正解（正解: ${current.shuffled.correctIndex + 1}）`}
              </p>
              <div>
                <p className="text-xs font-semibold text-app-text-muted">解説</p>
                <MarkdownView>{current.quiz.explanation}</MarkdownView>
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="w-full rounded-xl bg-app-accent px-4 py-3 font-semibold text-app-on-accent"
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

      {perfectMessage !== null && (
        <>
          <Confetti />
          <div className="flex animate-pop-in flex-col items-center gap-3 rounded-xl border border-app-accent bg-app-surface p-6 text-center motion-reduce:animate-none">
            <div className="relative flex animate-float-slow items-center justify-center motion-reduce:animate-none">
              <div className="absolute -inset-3 -z-10 animate-glow-slow rounded-full bg-app-accent/40 blur-xl motion-reduce:animate-none" />
              <div className="h-32 w-32 overflow-hidden rounded-full border-2 border-app-accent/70 shadow-lg">
                <img src={lokiPortrait} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
            <p className="font-semibold text-app-accent">満点達成！</p>
            <p className="break-words text-sm text-app-text-muted">{perfectMessage}</p>
          </div>
        </>
      )}

      <p className="rounded-xl border border-app-border bg-app-surface p-4 text-center text-lg font-semibold">
        {session.length}問中 {score}問正解
      </p>

      {wrongEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-app-text-muted">間違えた問題</p>
          <ul className="space-y-2">
            {wrongEntries.map((entry, i) => (
              <li key={`${entry.quiz.id}-${i}`} className="rounded-xl border border-app-border bg-app-surface p-3">
                <Link
                  to={`/dictionary/${entry.word.id}`}
                  className="break-words text-sm font-semibold text-app-accent underline"
                >
                  {entry.word.term}
                </Link>
                <p className="mt-1 break-words text-sm text-app-text-muted">{entry.quiz.question}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleRestart}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-app-border px-4 py-3 font-semibold text-app-text"
      >
        <RotateCcw className="h-4 w-4" />
        もう一度
      </button>
    </div>
  )
}
