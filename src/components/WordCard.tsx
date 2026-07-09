import { Link } from 'react-router-dom'
import { stripMarkdown } from '../lib/text'
import type { Word } from '../types'

export default function WordCard({ word }: { word: Word }) {
  return (
    <Link
      to={`/dictionary/${word.id}`}
      className="block rounded-xl border border-app-border bg-app-surface p-4 transition hover:border-app-accent/50 hover:shadow-sm"
    >
      <h3 className="font-bold break-words text-app-text">{word.term}</h3>
      {word.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {word.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-app-accent/10 px-2 py-0.5 text-xs font-medium text-app-accent">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 line-clamp-2 break-words text-sm text-app-text-muted">{stripMarkdown(word.definition)}</p>
    </Link>
  )
}
