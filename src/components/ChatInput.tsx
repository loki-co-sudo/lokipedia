import { type KeyboardEvent, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  /** 高さが変わるたびに通知する（会話エリアの padding-bottom 確保に使う） */
  onHeightChange?: (height: number) => void
}

const MAX_ROWS = 6
const LINE_HEIGHT_PX = 20

/**
 * チャット風の下部固定入力欄（docs/DESIGN.md §5.1）。
 * Enter は改行、送信は送信ボタン（デスクトップは Ctrl/Cmd+Enter でも送信可）。
 */
export default function ChatInput({ value, onChange, onSend, disabled, placeholder, onHeightChange }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const maxHeight = LINE_HEIGHT_PX * MAX_ROWS
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  }, [value])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !onHeightChange) return
    const observer = new ResizeObserver(() => onHeightChange(container.offsetHeight))
    observer.observe(container)
    onHeightChange(container.offsetHeight)
    return () => observer.disconnect()
  }, [onHeightChange])

  function handleSend() {
    if (disabled || value.trim() === '') return
    onSend()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 z-40 border-t border-app-border bg-app-bg/95 px-3 pt-2 backdrop-blur"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-app-border bg-app-surface px-3 py-2 pb-3">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="max-h-32 min-h-6 w-full min-w-0 flex-1 resize-none overflow-y-auto border-none bg-transparent py-1 text-sm text-app-text outline-none disabled:opacity-40"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || value.trim() === ''}
          aria-label="送信"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-accent text-app-on-accent disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
