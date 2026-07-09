import MarkdownView from './MarkdownView'
import TagChipInput from './TagChipInput'
import TagToggleList from './TagToggleList'
import type { GeneratedEntry, Word } from '../types'

interface GeneratedEntryCardProps {
  entry: GeneratedEntry
  tags: string[]
  onTagsChange: (tags: string[]) => void
  existingTags: string[]
  /** term が既存 words と一致した場合のその単語（登録/更新の選択 UI に切り替わる） */
  duplicate: Word | null
  saving: boolean
  saveError: string | null
  onRegister: () => void
  onUpdate: () => void
}

/**
 * 生成済みエントリの表示 + タグ編集 + 登録/更新ボタン（docs/DESIGN.md §5.1）。
 * 枠は持たない。初回生成のエントリカードと、継続質問の回答からの登録カードで共用する。
 */
export default function GeneratedEntryCard({
  entry,
  tags,
  onTagsChange,
  existingTags,
  duplicate,
  saving,
  saveError,
  onRegister,
  onUpdate,
}: GeneratedEntryCardProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold break-words">{entry.term}</h2>
        <div className="mt-2 space-y-2">
          <TagChipInput value={tags} onChange={onTagsChange} placeholder="タグ" />
          {existingTags.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-app-text-muted">既存タグから追加</p>
              <TagToggleList
                tags={existingTags}
                selected={tags}
                onToggle={(tag) =>
                  onTagsChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag])
                }
              />
            </div>
          )}
        </div>
      </div>

      <MarkdownView>{entry.definition}</MarkdownView>

      <p className="rounded-lg bg-app-surface-2 px-3 py-2 text-xs text-app-text-muted">
        4択クイズも1問生成済みです（登録時に一緒に保存されます）。
      </p>

      {saveError && <p className="text-sm text-app-danger">{saveError}</p>}

      {duplicate ? (
        <div className="space-y-2">
          <p className="text-sm text-app-text-muted">
            『{duplicate.term}』は登録済みです（{new Date(duplicate.createdAt).toLocaleDateString('ja-JP')} 登録）
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onUpdate}
              disabled={saving}
              className="flex-1 rounded-xl bg-app-accent px-4 py-3 font-semibold text-app-on-accent disabled:opacity-40"
            >
              {saving ? '更新中...' : '既存の単語を更新'}
            </button>
            <button
              type="button"
              onClick={onRegister}
              disabled={saving}
              className="flex-1 rounded-xl border border-app-border px-4 py-3 font-semibold text-app-text disabled:opacity-40"
            >
              {saving ? '登録中...' : '新規として登録'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRegister}
            disabled={saving}
            className="flex-1 rounded-xl bg-app-accent px-4 py-3 font-semibold text-app-on-accent disabled:opacity-40"
          >
            {saving ? '登録中...' : '辞書に登録'}
          </button>
        </div>
      )}
    </div>
  )
}
