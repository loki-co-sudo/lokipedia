import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { BookPlus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import ChatBubble from '../components/ChatBubble'
import ChatInput from '../components/ChatInput'
import GeneratedEntryCard from '../components/GeneratedEntryCard'
import Toast from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { useChatSession } from '../hooks/useChatSession'
import { getAnswerMode, getGeminiApiKey } from '../lib/settings'
import { ANSWER_MODE_LABELS } from '../lib/answerMode'
import { generateEntry, generateEntryFromConversation, generateFollowUp } from '../lib/gemini'
import { createWordWithQuiz, findWordByTerm, listWords, updateWordWithQuiz } from '../lib/repository'
import type { ChatMessage, GeneratedEntry, Word } from '../types'

/** 継続質問の回答から作成中の辞書エントリ（登録カードの状態） */
interface FollowUpDraft {
  /** 対象の model 回答の conversation 内 index */
  messageIndex: number
  entry: GeneratedEntry
  tags: string[]
  duplicate: Word | null
}

/**
 * ホーム / 検索・生成画面（docs/DESIGN.md §5.1）— チャット風入力・エントリカード・継続質問。
 * /add（共有受け取り）から ?q= ?source_url= で検索ワード・URLが引き継がれる。
 * 会話の状態は ChatSessionProvider が保持し、ページ遷移をまたいで維持される。
 */
export default function HomePage() {
  const [searchParams] = useSearchParams()
  const { isAdmin, loading: authLoading } = useAuth()

  const {
    lastQuery,
    setLastQuery,
    sourceUrl,
    setSourceUrl,
    entry,
    setEntry,
    entryTags,
    setEntryTags,
    duplicate,
    setDuplicate,
    conversation,
    setConversation,
    conversationMode,
    setConversationMode,
    reset: resetSession,
  } = useChatSession()

  const [input, setInput] = useState(searchParams.get('q') ?? '')
  const [existingTags, setExistingTags] = useState<string[]>([])

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [followUpError, setFollowUpError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // 継続質問の回答からの辞書登録（同時に開けるカードは1つ）
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpDraft | null>(null)
  const [draftLoadingIndex, setDraftLoadingIndex] = useState<number | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null)

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

  // /add からの出典URLをセッションに引き継ぐ（クエリなしの再訪問では既存値を保持）
  const sourceUrlParam = searchParams.get('source_url')
  useEffect(() => {
    if (sourceUrlParam) setSourceUrl(sourceUrlParam)
  }, [sourceUrlParam, setSourceUrl])

  async function handleGenerate(query: string) {
    setLastQuery(query)
    setGenerating(true)
    setGenError(null)
    setSaveError(null)
    try {
      const key = getGeminiApiKey()
      if (!key) throw new Error('Gemini APIキーが設定されていません。設定画面で登録してください。')
      // 回答モードは生成開始時の設定値を会話に固定する（docs/DESIGN.md §4.2）
      const mode = getAnswerMode()
      setConversationMode(mode)
      const result = await generateEntry(query, key, existingTags, mode)
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
      const answer = await generateFollowUp(historyWithQuestion, key, conversationMode ?? getAnswerMode())
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
    closeDraft()
    await handleGenerate(lastQuery)
  }

  function handleReset() {
    resetSession()
    setInput('')
    setGenError(null)
    setSaveError(null)
    setFollowUpError(null)
    closeDraft()
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

  /** 継続質問の回答（messageIndex）から辞書エントリを生成して登録カードを開く */
  async function handleOpenDraft(messageIndex: number) {
    const key = getGeminiApiKey()
    if (!key) {
      setDraftError('Gemini APIキーが設定されていません。設定画面で登録してください。')
      return
    }
    setDraftLoadingIndex(messageIndex)
    setDraftError(null)
    setFollowUpDraft(null)
    try {
      const history = conversation.slice(0, messageIndex + 1)
      const result = await generateEntryFromConversation(history, key, existingTags, conversationMode ?? getAnswerMode())
      const existing = await findWordByTerm(result.term)
      setFollowUpDraft({ messageIndex, entry: result, tags: result.tags, duplicate: existing ?? null })
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'エントリの生成に失敗しました。')
    } finally {
      setDraftLoadingIndex(null)
    }
  }

  function closeDraft() {
    setFollowUpDraft(null)
    setDraftError(null)
    setDraftSaveError(null)
  }

  async function handleDraftSave(asUpdate: boolean) {
    if (!followUpDraft) return
    setDraftSaving(true)
    setDraftSaveError(null)
    try {
      const inputData = {
        term: followUpDraft.entry.term,
        reading: followUpDraft.entry.reading,
        definition: followUpDraft.entry.definition,
        tags: followUpDraft.tags,
        sourceUrl: null,
        quiz: followUpDraft.entry.quiz,
      }
      const word =
        asUpdate && followUpDraft.duplicate
          ? await updateWordWithQuiz(followUpDraft.duplicate.id, inputData)
          : await createWordWithQuiz(inputData)
      setToast(asUpdate ? '更新しました' : '辞書に登録しました')
      setFollowUpDraft({ ...followUpDraft, duplicate: word })
    } catch (e) {
      setDraftSaveError(e instanceof Error ? e.message : '登録に失敗しました。')
    } finally {
      setDraftSaving(false)
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

      <div className="flex flex-col items-center gap-3 pt-6 pb-2">
        <img
          src="/icon-192.png"
          alt=""
          className="h-16 w-16 animate-glow-slow rounded-2xl motion-reduce:animate-none"
        />
        <h1 className="font-logo -rotate-2 text-4xl text-app-text">lokipedia</h1>
      </div>

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
          <GeneratedEntryCard
            entry={entry}
            tags={entryTags}
            onTagsChange={setEntryTags}
            existingTags={existingTags}
            duplicate={duplicate}
            saving={saving}
            saveError={saveError}
            onRegister={() => void handleRegister()}
            onUpdate={() => void handleUpdate()}
          />

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
              {conversation.slice(1).map((msg, i) => {
                const messageIndex = i + 1
                return (
                  <div key={messageIndex} className="space-y-2">
                    <ChatBubble role={msg.role} text={msg.text} />
                    {msg.role === 'model' &&
                      isAdmin &&
                      geminiKey &&
                      (followUpDraft?.messageIndex === messageIndex ? (
                        <div className="space-y-4 rounded-xl border border-app-border bg-app-bg p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-app-text-muted">この回答から辞書エントリを作成</p>
                            <button
                              type="button"
                              onClick={closeDraft}
                              aria-label="登録カードを閉じる"
                              className="shrink-0 p-1 text-app-text-muted"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <GeneratedEntryCard
                            entry={followUpDraft.entry}
                            tags={followUpDraft.tags}
                            onTagsChange={(tags) => setFollowUpDraft((d) => (d ? { ...d, tags } : d))}
                            existingTags={existingTags}
                            duplicate={followUpDraft.duplicate}
                            saving={draftSaving}
                            saveError={draftSaveError}
                            onRegister={() => void handleDraftSave(false)}
                            onUpdate={() => void handleDraftSave(true)}
                          />
                        </div>
                      ) : (
                        <div className="flex justify-start">
                          <button
                            type="button"
                            onClick={() => void handleOpenDraft(messageIndex)}
                            disabled={draftLoadingIndex !== null}
                            className="flex items-center gap-1 rounded-full border border-app-border px-3 py-1 text-xs font-medium text-app-text-muted disabled:opacity-40"
                          >
                            <BookPlus className="h-3.5 w-3.5" />
                            {draftLoadingIndex === messageIndex ? 'エントリ生成中...' : 'この回答を辞書に登録'}
                          </button>
                        </div>
                      ))}
                  </div>
                )
              })}
              {draftError && <p className="text-sm text-app-danger">{draftError}</p>}
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
        placeholder={entry ? '追加で質問する...' : 'lokipediaで検索'}
        onHeightChange={handleChatInputHeightChange}
      >
        {entry && (
          <div className="mx-auto mb-2 flex max-w-2xl items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-app-text-muted">
              回答モード「{ANSWER_MODE_LABELS[conversationMode ?? 'standard']}」で会話中
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="flex shrink-0 items-center gap-1 rounded-full border border-app-border px-3 py-1 text-xs font-medium text-app-text-muted"
            >
              <Trash2 className="h-3.5 w-3.5" />
              会話をリセット
            </button>
          </div>
        )}
      </ChatInput>
    </div>
  )
}
