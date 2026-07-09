import { type KeyboardEvent, useState } from 'react'
import { X } from 'lucide-react'

interface TagChipInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export default function TagChipInput({ value, onChange, placeholder }: TagChipInputProps) {
  const [draft, setDraft] = useState('')

  function commitDraft() {
    const tag = draft.trim()
    if (tag !== '' && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setDraft('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitDraft()
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2 focus-within:border-app-accent">
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-app-accent/10 px-3 py-1 text-xs font-medium text-app-accent"
        >
          {tag}
          <button type="button" onClick={() => removeTag(tag)} aria-label={`${tag}を削除`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-24 flex-1 border-none py-1 text-sm outline-none"
      />
    </div>
  )
}
