import MarkdownView from './MarkdownView'
import type { ChatImage } from '../types'

interface ChatBubbleProps {
  role: 'user' | 'model'
  text: string
  /** ユーザーメッセージへの添付画像（docs/DESIGN.md §4.4） */
  images?: ChatImage[]
  /** 「考え中...」等のローディング表示。控えめな文字色でプレーンテキスト表示する */
  muted?: boolean
}

/** チャットの吹き出し1つ分。user は右寄せ・アクセント色、model は左寄せで Markdown レンダリング。 */
export default function ChatBubble({ role, text, images, muted }: ChatBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2 rounded-2xl bg-app-accent px-4 py-2 text-sm text-app-on-accent">
          {images && images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover"
                />
              ))}
            </div>
          )}
          {text !== '' && <p className="whitespace-pre-wrap break-words">{text}</p>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[85%] rounded-2xl bg-app-surface-2 px-4 py-2 text-sm ${muted ? 'text-app-text-muted' : 'text-app-text'}`}
      >
        {muted ? text : <MarkdownView>{text}</MarkdownView>}
      </div>
    </div>
  )
}
