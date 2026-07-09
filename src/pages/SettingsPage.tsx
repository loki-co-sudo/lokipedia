import { type FormEvent, useState } from 'react'
import { Eye, EyeOff, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import {
  clearGeminiApiKey,
  getAnswerMode,
  getGeminiApiKey,
  setAnswerMode,
  setGeminiApiKey,
  type Theme,
} from '../lib/settings'
import { ANSWER_MODE_LABELS, ANSWER_MODES, type AnswerMode } from '../lib/answerMode'
import { syncFromSupabase } from '../lib/repository'

const THEME_OPTIONS: { value: Theme; label: string; swatch: string }[] = [
  { value: 'light', label: 'ライト', swatch: '#4338ca' },
  { value: 'dark', label: 'ダーク', swatch: '#818cf8' },
  { value: 'loki', label: 'ロキ', swatch: '#f59e0b' },
]

/**
 * 設定画面（docs/DESIGN.md §5.4）
 * 管理者ログイン（Supabase Auth）、Gemini API キー保存（localStorage）、再同期、テーマ選択（§5.5・ログイン不要）。
 */
export default function SettingsPage() {
  const { session, isAdmin, loading, signIn, signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  const [answerMode, setAnswerModeState] = useState<AnswerMode>(() => getAnswerMode())

  const [geminiKey, setGeminiKeyState] = useState(() => getGeminiApiKey() ?? '')
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setLoggingIn(true)
    try {
      await signIn(email, password)
      setPassword('')
    } catch (err) {
      setLoginError('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
      console.error(err)
    } finally {
      setLoggingIn(false)
    }
  }

  function handleSaveKey() {
    if (geminiKey.trim() === '') {
      clearGeminiApiKey()
    } else {
      setGeminiApiKey(geminiKey.trim())
    }
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  function handleClearKey() {
    clearGeminiApiKey()
    setGeminiKeyState('')
  }

  function handleAnswerModeChange(mode: AnswerMode) {
    setAnswerModeState(mode)
    setAnswerMode(mode)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      await syncFromSupabase()
      setSyncMessage('同期が完了しました')
    } catch (err) {
      setSyncMessage('同期に失敗しました。ネットワーク接続を確認してください。')
      console.error(err)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      <section className="space-y-3 rounded-xl border border-app-border bg-app-surface p-4">
        <h2 className="font-semibold">テーマ</h2>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold ${
                theme === opt.value ? 'border-app-accent text-app-accent' : 'border-app-border text-app-text-muted'
              }`}
            >
              <span
                aria-hidden
                className="h-6 w-6 rounded-full border border-app-border"
                style={{ backgroundColor: opt.swatch }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-app-border bg-app-surface p-4">
        <h2 className="font-semibold">回答モード</h2>
        <p className="text-xs text-app-text-muted">
          AI回答の口調を選べます。会話の開始時に適用され、進行中の会話の口調は変わりません（管理者の生成機能用）。
        </p>
        <div className="flex flex-wrap gap-2">
          {ANSWER_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleAnswerModeChange(mode)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                answerMode === mode
                  ? 'bg-app-accent text-app-on-accent'
                  : 'bg-app-surface-2 text-app-text-muted hover:bg-app-border'
              }`}
            >
              {ANSWER_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-app-border bg-app-surface p-4">
        <h2 className="font-semibold">管理者ログイン</h2>
        {loading ? (
          <p className="text-sm text-app-text-muted">読み込み中...</p>
        ) : isAdmin ? (
          <div className="space-y-3">
            <p className="break-words text-sm text-app-success">ログイン中: {session?.user.email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-2 rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="w-full rounded-xl border border-app-border px-4 py-2 outline-none focus:border-app-accent"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="w-full rounded-xl border border-app-border px-4 py-2 outline-none focus:border-app-accent"
            />
            {loginError && <p className="text-sm text-app-danger">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="flex items-center gap-2 rounded-xl bg-app-accent px-4 py-2 text-sm font-semibold text-app-on-accent disabled:opacity-40"
            >
              <LogIn className="h-4 w-4" />
              {loggingIn ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-app-border bg-app-surface p-4">
        <h2 className="font-semibold">Gemini API キー</h2>
        <p className="text-xs text-app-text-muted">この端末にのみ保存されます（管理者用）。</p>
        <div className="flex items-center gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={geminiKey}
            onChange={(e) => setGeminiKeyState(e.target.value)}
            placeholder="AIza..."
            className="w-full rounded-xl border border-app-border px-4 py-2 outline-none focus:border-app-accent"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="shrink-0 p-2 text-app-text-muted"
            aria-label={showKey ? 'キーを隠す' : 'キーを表示'}
          >
            {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveKey}
            className="rounded-xl bg-app-accent px-4 py-2 text-sm font-semibold text-app-on-accent"
          >
            保存
          </button>
          <button
            type="button"
            onClick={handleClearKey}
            className="rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text"
          >
            削除
          </button>
          {keySaved && <span className="text-sm text-app-success">保存しました</span>}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-app-border bg-app-surface p-4">
        <h2 className="font-semibold">データ同期</h2>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing}
          className="flex items-center gap-2 rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同期中...' : '今すぐ同期'}
        </button>
        {syncMessage && <p className="text-sm text-app-text-muted">{syncMessage}</p>}
      </section>
    </div>
  )
}
