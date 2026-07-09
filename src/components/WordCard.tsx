import { Link } from 'react-router-dom'
import { stripMarkdown } from '../lib/text'
import type { Word } from '../types'

export default function WordCard({ word }: { word: Word }) {
  return (
    <Link
      to={`/dictionary/${word.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:shadow-sm"
    >
      <h3 className="font-bold text-slate-900">{word.term}</h3>
      {word.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {word.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{stripMarkdown(word.definition)}</p>
    </Link>
  )
}
