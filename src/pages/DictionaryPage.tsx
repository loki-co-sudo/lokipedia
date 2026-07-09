import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import Skeleton from '../components/Skeleton'
import TagToggleList from '../components/TagToggleList'
import WordCard from '../components/WordCard'
import { listWords } from '../lib/repository'
import { getDictionarySort, setDictionarySort, type DictionarySort } from '../lib/settings'
import { sortWordsByKana, sortWordsByLatest } from '../lib/wordSort'
import type { Word } from '../types'

/**
 * 辞書一覧画面（docs/DESIGN.md §5.2）
 */
export default function DictionaryPage() {
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sort, setSort] = useState<DictionarySort>(() => getDictionarySort())

  useEffect(() => {
    listWords()
      .then(setWords)
      .catch((e) => {
        console.error('[DictionaryPage] 単語一覧の取得に失敗しました', e)
        setError('単語一覧の取得に失敗しました。')
      })
      .finally(() => setLoading(false))
  }, [])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const w of words) for (const t of w.tags) tagSet.add(t)
    return Array.from(tagSet).sort()
  }, [words])

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase()
    return words.filter((w) => {
      const matchesTags = selectedTags.every((t) => w.tags.includes(t))
      const matchesQuery =
        query === '' || w.term.toLowerCase().includes(query) || w.definition.toLowerCase().includes(query)
      return matchesTags && matchesQuery
    })
  }, [words, search, selectedTags])

  const sortedWords = useMemo(
    () => (sort === 'kana' ? sortWordsByKana(filteredWords) : sortWordsByLatest(filteredWords)),
    [filteredWords, sort],
  )

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function handleSortChange(next: DictionarySort) {
    setSort(next)
    setDictionarySort(next)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">辞書</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="単語や解説で絞り込み"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 outline-none focus:border-sky-500"
        />
      </div>

      <div className="flex gap-2">
        {(['latest', 'kana'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => handleSortChange(opt)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              sort === opt ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {opt === 'latest' ? '新着順' : '50音順'}
          </button>
        ))}
      </div>

      {allTags.length > 0 && <TagToggleList tags={allTags} selected={selectedTags} onToggle={toggleTag} />}

      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && !error && sortedWords.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          {words.length === 0 ? 'まだ単語が登録されていません' : '条件に一致する単語がありません'}
        </p>
      )}

      {!loading && sortedWords.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sortedWords.map((word) => (
            <WordCard key={word.id} word={word} />
          ))}
        </div>
      )}
    </div>
  )
}
