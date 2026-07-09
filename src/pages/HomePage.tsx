import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { RefreshCw, Sparkles } from 'lucide-react'
import TagChipInput from '../components/TagChipInput'
import MarkdownView from '../components/MarkdownView'
import Toast from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { getGeminiApiKey } from '../lib/settings'
import { generateEntry } from '../lib/gemini'
import { createWordWithQuiz, listWords } from '../lib/repository'
import type { GeneratedEntry } from '../types'

/**
 * ホーム / 検索・生成画面（docs/DESIGN.md §5.1）
 * /add（共有受け取り）から ?q= で検索ワードが引き継がれる。
 */
export default function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAdmin, loading: authLoading } = useAuth()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [manualTags, setManualTags] = useState<string[]>([])
  const [existingTags, setExistingTags] = useState<string[]>([])

  const [preview, setPreview] = useState<GeneratedEntry | null>(null)
  const [previewTags, setPreviewTags] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const geminiKey = getGeminiApiKey()

  useEffect(() => {
    listWords()
      .then((words) => {
        const tagSet = new Set<string>()
        for (const w of words) for (const t of w.tags) tagSet.add(t)
        setExistingTags(Array.from(tagSet))
      })
      .catch((e) => console.error('[HomePage] 既存タグの取得に失敗しました', e))
  }, [])

  async function handleGenerate() {
    if (query.trim() === '') return
    setGenerating(true)
    setGenError(null)
    setSaveError(null)
    try {
      const key = getGeminiApiKey()
      if (!key) throw new Error('Gemini APIキーが設定されていません。設定画面で登録してください。')
      const result = await generateEntry(query.trim(), key, existingTags)
      setPreview(result)
      setPreviewTags(manualTags.length > 0 ? manualTags : result.tags)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'AI生成に失敗しました。')
      setPreview(null)
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegister() {
    if (!preview) return
    setSaving(true)
    setSaveError(null)
    try {
      const word = await createWordWithQuiz({
        term: preview.term,
        definition: preview.definition,
        tags: previewTags,
        sourceUrl: null,
        quiz: preview.quiz,
      })
      setToast('辞書に登録しました')
      setTimeout(() => navigate(`/dictionary/${word.id}`), 900)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '登録に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  const generateDisabled = authLoading || !isAdmin || !geminiKey || query.trim() === '' || generating

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} />}

      <h1 className="text-2xl font-bold">lokipedia</h1>
      <p className="text-sm text-slate-500">
        調べたい単語を入力すると、AIが解説と4択クイズを生成します（管理者のみ）。
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="例: PWA / PWAについて教えて"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-sky-500"
      />

      <TagChipInput value={manualTags} onChange={setManualTags} placeholder="タグ（任意・手入力優先）" />

      {!authLoading && !isAdmin && (
        <p className="text-sm text-amber-600">管理者のみ利用できます。設定画面からログインしてください。</p>
      )}
      {!authLoading && isAdmin && !geminiKey && (
        <p className="text-sm text-amber-600">
          Gemini APIキーが未設定です。
          <Link to="/settings" className="underline">
            設定画面
          </Link>
          で登録してください。
        </p>
      )}

      <button
        type="button"
        disabled={generateDisabled}
        onClick={() => void handleGenerate()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
      >
        <Sparkles className="h-5 w-5" />
        {generating ? '生成中...' : 'AIで生成'}
      </button>

      {genError && <p className="text-sm text-rose-600">{genError}</p>}

      {preview && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-xl font-bold">{preview.term}</h2>
            <div className="mt-2">
              <TagChipInput value={previewTags} onChange={setPreviewTags} placeholder="タグ" />
            </div>
          </div>

          <MarkdownView>{preview.definition}</MarkdownView>

          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="font-semibold">{preview.quiz.question}</p>
            <ul className="space-y-1">
              {preview.quiz.choices.map((choice, i) => (
                <li
                  key={i}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    i === preview.quiz.correctIndex
                      ? 'bg-emerald-100 font-semibold text-emerald-800'
                      : 'bg-white text-slate-700'
                  }`}
                >
                  {choice}
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <p className="text-xs font-semibold text-slate-500">解説</p>
              <MarkdownView>{preview.quiz.explanation}</MarkdownView>
            </div>
          </div>

          {saveError && <p className="text-sm text-rose-600">{saveError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleRegister()}
              disabled={saving}
              className="flex-1 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              {saving ? '登録中...' : '辞書に登録'}
            </button>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              再生成
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
