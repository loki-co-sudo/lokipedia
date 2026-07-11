import { type ChangeEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { ImagePlus, Send, X } from 'lucide-react'
import { fileToChatImage, MAX_IMAGES_PER_MESSAGE } from '../lib/image'
import type { ChatImage } from '../types'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  images: ChatImage[]
  onImagesChange: (images: ChatImage[]) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  /** 高さが変わるたびに通知する（会話エリアの padding-bottom 確保に使う） */
  onHeightChange?: (height: number) => void
  /** 入力欄の上に表示する付属UI（回答モード選択チップ等） */
  children?: ReactNode
}

const MAX_ROWS = 6
// text-base(16px) の行高。iOS Safari は 16px 未満の入力欄にフォーカスすると
// 自動ズームして横幅が崩れるため、textarea のフォントは text-base 未満にしないこと。
const LINE_HEIGHT_PX = 24

/**
 * チャット風の下部固定入力欄（docs/DESIGN.md §5.1）。
 * Enter は改行、送信は送信ボタン（デスクトップは Ctrl/Cmd+Enter でも送信可）。
 * 画像添付（docs/DESIGN.md §4.4）: 最大 MAX_IMAGES_PER_MESSAGE 枚、送信情報の補助として使う。
 */
export default function ChatInput({
  value,
  onChange,
  images,
  onImagesChange,
  onSend,
  disabled,
  placeholder,
  onHeightChange,
  children,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachError, setAttachError] = useState<string | null>(null)

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
  }, [onHeightChange, images.length])

  function handleSend() {
    if (disabled || (value.trim() === '' && images.length === 0)) return
    onSend()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setAttachError(null)

    const capacity = MAX_IMAGES_PER_MESSAGE - images.length
    if (capacity <= 0) {
      setAttachError(`画像は最大${MAX_IMAGES_PER_MESSAGE}枚までです。`)
      return
    }
    const accepted = files.slice(0, capacity)
    if (files.length > accepted.length) {
      setAttachError(`画像は最大${MAX_IMAGES_PER_MESSAGE}枚までです。先頭${accepted.length}枚のみ追加しました。`)
    }

    try {
      const converted = await Promise.all(accepted.map(fileToChatImage))
      onImagesChange([...images, ...converted])
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : '画像の読み込みに失敗しました。')
    }
  }

  function removeImage(index: number) {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 z-40 border-t border-app-border bg-app-bg/95 px-3 pt-2 backdrop-blur"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
    >
      {children}
      <div className="mx-auto max-w-2xl">
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label="画像を削除"
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-app-danger text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {attachError && <p className="mb-2 text-xs text-app-danger">{attachError}</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-app-border bg-app-surface px-3 py-2 pb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFilesSelected(e)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || images.length >= MAX_IMAGES_PER_MESSAGE}
            aria-label="画像を添付"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-app-text-muted disabled:opacity-40"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className="max-h-36 min-h-6 w-full min-w-0 flex-1 resize-none overflow-y-auto border-none bg-transparent py-1 text-base text-app-text outline-none disabled:opacity-40"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || (value.trim() === '' && images.length === 0)}
            aria-label="送信"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-accent text-app-on-accent disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
