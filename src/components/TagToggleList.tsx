interface TagToggleListProps {
  tags: string[]
  selected: string[]
  onToggle: (tag: string) => void
  /** 指定時は一括選択/解除ボタンを表示し、押下で選択状態をまとめて差し替える */
  onBulkChange?: (tags: string[]) => void
}

export default function TagToggleList({ tags, selected, onToggle, onBulkChange }: TagToggleListProps) {
  const allSelected = tags.length > 0 && tags.every((tag) => selected.includes(tag))

  return (
    <div className="flex flex-wrap gap-2">
      {onBulkChange && (
        <button
          type="button"
          onClick={() => onBulkChange(allSelected ? [] : [...tags])}
          className="rounded-full border border-app-border px-3 py-1 text-xs font-medium text-app-text-muted hover:bg-app-surface-2"
        >
          {allSelected ? 'すべて解除' : 'すべて選択'}
        </button>
      )}
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onToggle(tag)}
          className={`max-w-full rounded-full px-3 py-1 text-xs font-medium break-words ${
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
