import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { RefreshCw, Sparkles } from 'lucide-react'
import ChatBubble from '../components/ChatBubble'
import ChatInput from '../components/ChatInput'
import TagChipInput from '../components/TagChipInput'
import TagToggleList from '../components/TagToggleList'
import MarkdownView from '../components/MarkdownView'
import Toast from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { getGeminiApiKey } from '../lib/settings'
import { generateEntry, generateFollowUp } from '../lib/gemini'
import { createWordWithQuiz, findWordByTerm, listWords, updateWordWithQuiz } from '../lib/repository'
import type { ChatMessage, GeneratedEntry, Word } from '../types'

/**
 * ホーム / 検索・生成画面（docs/DESIGN.md §5.1）— チャット風入力・エントリカード・継続質問。
 * /add（共有受け取り）から ?q= ?source_url= で検索ワード・URLが引き継がれる。
 */
export default function HomePage() {
  const [searchParams] = useSearchParams()
  const { isAdmin, loading: authLoading } = useAuth()

  const [input, setInput] = useState(searchParams.get('q') ?? '')
  const [lastQuery, setLastQuery] = useState('')
  const [sourceUrl] = useState(searchParams.get('source_url'))
  const [existingTags, setExistingTags] = useState<string[]>([])

  const [entry, setEntry] = useState<GeneratedEntry | null>(null)
  const [entryTags, setEntryTags] = useState<string[]>([])
  const [duplicate, setDuplicate] = useState<Word | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // 会話履歴（Gemini に渡す全文脈）。index 0 は非表示の初回 definition ターン。
  const [conversation, setConversation] = useState<ChatMessage[]>([])
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [followUpError, setFollowUpError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [chatInputHeight, setChatInputHeight] = useState(0)

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

  async function handleGenerate(query: string) {
    setLastQuery(query)
    setGenerating(true)
    setGenError(null)
    setSaveError(null)
    try {
      const key = getGeminiApiKey()
      if (!key) throw new Error('Gemini APIキーが設定されていません。設定画面で登録してください。')
      const result = await generateEntry(query, key, existingTags)
      setEntry(result)
      setEntryTags(result.tags)
      setConversation([{ role: 'model', text: result.definition }])
      setFollowUpError(null)
      const existing = await findWordByTerm(result.term)
      setDuplicate(existing ?? null)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'AI生成に失敗しました。')
      setEntry(null)
      setDuplicate(null)
    } finally {
      setGenerating(false)
    }
  }

  async function handleFollowUp(question: string) {
    const key = getGeminiApiKey()
    if (!key) {
      setFollowUpError('Gemini APIキーが設定されていません。設定画面で登録してください。')
      return
    }
    const historyWithQuestion: ChatMessage[] = [...conversation, { role: 'user', text: question }]
    setConversation(historyWithQuestion)
    setFollowUpLoading(true)
    setFollowUpError(null)
    try {
      const answer = await generateFollowUp(historyWithQuestion, key)
      setConversation((prev) => [...prev, { role: 'model', text: answer }])
    } catch (e) {
      setFollowUpError(e instanceof Error ? e.message : '追加質問に失敗しました。')
    } finally {
      setFollowUpLoading(false)
    }
  }

  async function handleSend() {
    const trimmed = input.trim()
    if (trimmed === '') return
    setInput('')
    if (!entry) {
      await handleGenerate(trimmed)
    } else {
      await handleFollowUp(trimmed)
    }
  }

  async function handleRegenerate() {
    if (lastQuery.trim() === '' || generating) return
    setConversation([])
    setFollowUpError(null)
    setDuplicate(null)
    await handleGenerate(lastQuery)
  }

  function handleReset() {
    setEntry(null)
    setEntryTags([])
    setDuplicate(null)
    setConversation([])
    setInput('')
    setLastQuery('')
    setGenError(null)
    setSaveError(null)
    setFollowUpError(null)
  }

  async function handleRegister() {
    if (!entry) return
    setSaving(true)
    setSaveError(null)
    try {
      const word = await createWordWithQuiz({
        term: entry.term,
        reading: entry.reading,
        definition: entry.definition,
        tags: entryTags,
        sourceUrl,
        quiz: entry.quiz,
      })
      setToast('辞書に登録しました')
      // 遷移せずスレッドを継続する。以降の再登録は「更新」扱いにする。
      setDuplicate(word)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '登録に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!entry || !duplicate) return
    setSaving(true)
    setSaveError(null)
    try {
      const word = await updateWordWithQuiz(duplicate.id, {
        term: entry.term,
        reading: entry.reading,
        definition: entry.definition,
        tags: entryTags,
        sourceUrl,
        quiz: entry.quiz,
      })
      setToast('更新しました')
      setDuplicate(word)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '更新に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  const handleChatInputHeightChange = useCallback((height: number) => setChatInputHeight(height), [])

  // 継続質問の吹き出しが追加されたら最下部（最新のやりとり）まで自動スクロールする。
  useEffect(() => {
    if (conversation.length <= 1 && !followUpLoading) return
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }, [conversation.length, followUpLoading])

  const geminiDisabledReason = authLoading
    ? null
    : !isAdmin
      ? '管理者のみ利用できます。設定画面からログインしてください。'
      : !geminiKey
        ? 'Gemini APIキーが未設定です。'
        : null

  const inputDisabled = authLoading || !isAdmin || !geminiKey || generating || followUpLoading

  return (
    <div className="space-y-4" style={{ paddingBottom: chatInputHeight + 8 }}>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <h1 className="text-2xl font-bold">lokipedia</h1>
      <p className="text-sm text-app-text-muted">
        調べたい単語や「〜について教えて」を入力すると、AIが解説と4択クイズを生成します（管理者のみ）。
      </p>

      {geminiDisabledReason && (
        <p className="text-sm text-app-warning">
          {geminiDisabledReason}
          {!authLoading && isAdmin && !geminiKey && (
            <>
              {' '}
              <Link to="/settings" className="underline">
                設定画面
              </Link>
              で登録してください。
            </>
          )}
        </p>
      )}

      {lastQuery !== '' && <ChatBubble role="user" text={lastQuery} />}

      {genError && <p className="text-sm text-app-danger">{genError}</p>}

      {entry && (
        <div className="space-y-4 rounded-xl border border-app-border bg-app-surface p-4">
          <div>
            <h2 className="text-xl font-bold break-words">{entry.term}</h2>
            <div className="mt-2 space-y-2">
              <TagChipInput value={entryTags} onChange={setEntryTags} placeholder="タグ" />
              {existingTags.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-app-text-muted">既存タグから追加</p>
                  <TagToggleList
                    tags={existingTags}
                    selected={entryTags}
                    onToggle={(tag) =>
                      setEntryTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
                    }
                  />
                </div>
              )}
            </div>
          </div>

          <MarkdownView>{entry.definition}</MarkdownView>

          <p className="rounded-lg bg-app-surface-2 px-3 py-2 text-xs text-app-text-muted">
            4択クイズも1問生成済みです（登録時に一緒に保存されます）。
          </p>

          {saveError && <p className="text-sm text-app-danger">{saveError}</p>}

          {duplicate ? (
            <div className="space-y-2">
              <p className="text-sm text-app-text-muted">
                『{duplicate.term}』は登録済みです（{new Date(duplicate.createdAt).toLocaleDateString('ja-JP')} 登録）
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleUpdate()}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-app-accent px-4 py-3 font-semibold text-app-on-accent disabled:opacity-40"
                >
                  {saving ? '更新中...' : '既存の単語を更新'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRegister()}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-app-border px-4 py-3 font-semibold text-app-text disabled:opacity-40"
                >
                  {saving ? '登録中...' : '新規として登録'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleRegister()}
                disabled={saving}
                className="flex-1 rounded-xl bg-app-accent px-4 py-3 font-semibold text-app-on-accent disabled:opacity-40"
              >
                {saving ? '登録中...' : '辞書に登録'}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={generating}
              title="継続質問の会話は破棄されます"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-app-border px-4 py-3 text-sm font-semibold text-app-text disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              再生成
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-app-border px-4 py-3 text-sm font-semibold text-app-text"
            >
              <Sparkles className="h-4 w-4" />
              新しく調べる
            </button>
          </div>

          {conversation.length > 1 && (
            <div className="space-y-3 border-t border-app-border pt-4">
              {conversation.slice(1).map((msg, i) => (
                <ChatBubble key={i} role={msg.role} text={msg.text} />
              ))}
            </div>
          )}

          {followUpLoading && <ChatBubble role="model" text="考え中..." muted />}
          {followUpError && <p className="text-sm text-app-danger">{followUpError}</p>}
        </div>
      )}

      {generating && !entry && <ChatBubble role="model" text="考え中..." muted />}

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => void handleSend()}
        disabled={inputDisabled}
        placeholder={entry ? '追加で質問する...' : '例: PWA / PWAについて教えて'}
        onHeightChange={handleChatInputHeightChange}
      />
    </div>
  )
}
