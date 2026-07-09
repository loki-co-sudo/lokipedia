import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { BookOpen, Home, ListChecks, Settings } from 'lucide-react'
import HomePage from './pages/HomePage'
import SharePage from './pages/SharePage'
import DictionaryPage from './pages/DictionaryPage'
import WordDetailPage from './pages/WordDetailPage'
import QuizPage from './pages/QuizPage'
import SettingsPage from './pages/SettingsPage'
import { supabaseConfigError } from './lib/supabase'
import { syncFromSupabase } from './lib/repository'

const tabs = [
  { to: '/', label: 'ホーム', icon: Home },
  { to: '/dictionary', label: '辞書', icon: BookOpen },
  { to: '/quiz', label: 'クイズ', icon: ListChecks },
  { to: '/settings', label: '設定', icon: Settings },
] as const

export default function App() {
  // アプリ起動時に Supabase → IndexedDB の全件同期を行う（docs/DESIGN.md §2.2）。
  // オフラインや未設定時は静かに諦め、読み取りは IndexedDB キャッシュにフォールバックする。
  useEffect(() => {
    if (supabaseConfigError) return

    function sync() {
      syncFromSupabase().catch((err) => {
        console.error('[App] 同期に失敗しました', err)
      })
    }

    if (navigator.onLine) sync()

    // オンライン復帰時にも再同期する（docs/DESIGN.md §6）。
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [])

  if (supabaseConfigError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-lg font-bold text-rose-600">設定エラー</p>
          <p className="text-sm text-slate-600">{supabaseConfigError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-24">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<SharePage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/dictionary/:id" element={<WordDetailPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* h-16(=4rem) は ChatInput（src/components/ChatInput.tsx）の bottom オフセット計算の前提になっている */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-16 max-w-2xl">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                  isActive ? 'text-sky-600' : 'text-slate-400'
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
