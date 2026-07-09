import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

/**
 * ホーム / 検索・生成画面（docs/DESIGN.md §5.1）
 * Phase 2 で実装: タグチップ入力、Gemini 生成、プレビュー、辞書登録。
 * /add（共有受け取り）から ?q= で検索ワードが引き継がれる。
 */
export default function HomePage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  return (
    <div className="space-y-4">
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

      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
        title="Phase 2 で実装します"
      >
        <Sparkles className="h-5 w-5" />
        AIで生成（Phase 2 で実装）
      </button>
    </div>
  )
}
