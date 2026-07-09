import { type FormEvent, useState } from 'react'
import { Eye, EyeOff, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { clearGeminiApiKey, getGeminiApiKey, setGeminiApiKey } from '../lib/settings'
import { syncFromSupabase } from '../lib/repository'

/**
 * 設定画面（docs/DESIGN.md §5.4）
 * Phase 1: 管理者ログイン（Supabase Auth）、Gemini API キー保存（localStorage）、再同期。
 */
export default function SettingsPage() {
  const { session, isAdmin, loading, signIn, signOut } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

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

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">管理者ログイン</h2>
        {loading ? (
          <p className="text-sm text-slate-400">読み込み中...</p>
        ) : isAdmin ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-600">ログイン中: {session?.user.email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
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
              className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-sky-500"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-sky-500"
            />
            {loginError && <p className="text-sm text-rose-600">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <LogIn className="h-4 w-4" />
              {loggingIn ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Gemini API キー</h2>
        <p className="text-xs text-slate-500">この端末にのみ保存されます（管理者用）。</p>
        <div className="flex items-center gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={geminiKey}
            onChange={(e) => setGeminiKeyState(e.target.value)}
            placeholder="AIza..."
            className="w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="shrink-0 p-2 text-slate-500"
            aria-label={showKey ? 'キーを隠す' : 'キーを表示'}
          >
            {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveKey}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
          >
            保存
          </button>
          <button
            type="button"
            onClick={handleClearKey}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            削除
          </button>
          {keySaved && <span className="text-sm text-emerald-600">保存しました</span>}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">データ同期</h2>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing}
          className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同期中...' : '今すぐ同期'}
        </button>
        {syncMessage && <p className="text-sm text-slate-600">{syncMessage}</p>}
      </section>
    </div>
  )
}
