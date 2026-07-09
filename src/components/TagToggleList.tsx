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
            selected.includes(tag)
              ? 'bg-app-accent text-app-on-accent'
              : 'bg-app-surface-2 text-app-text-muted hover:bg-app-border'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
