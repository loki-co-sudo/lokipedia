interface TagToggleListProps {
  tags: string[]
  selected: string[]
  onToggle: (tag: string) => void
}

export default function TagToggleList({ tags, selected, onToggle }: TagToggleListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onToggle(tag)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            selected.includes(tag) ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
