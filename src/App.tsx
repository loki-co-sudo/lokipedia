import { NavLink, Route, Routes } from 'react-router-dom'
import { BookOpen, Home, ListChecks, Settings } from 'lucide-react'
import HomePage from './pages/HomePage'
import SharePage from './pages/SharePage'
import DictionaryPage from './pages/DictionaryPage'
import WordDetailPage from './pages/WordDetailPage'
import QuizPage from './pages/QuizPage'
import SettingsPage from './pages/SettingsPage'

const tabs = [
  { to: '/', label: 'ホーム', icon: Home },
  { to: '/dictionary', label: '辞書', icon: BookOpen },
  { to: '/quiz', label: 'クイズ', icon: ListChecks },
  { to: '/settings', label: '設定', icon: Settings },
] as const

export default function App() {
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

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
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
