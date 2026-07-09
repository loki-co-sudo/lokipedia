import MarkdownView from './MarkdownView'

interface ChatBubbleProps {
  role: 'user' | 'model'
  text: string
  /** 「考え中...」等のローディング表示。控えめな文字色でプレーンテキスト表示する */
  muted?: boolean
}

/** チャットの吹き出し1つ分。user は右寄せ・アクセント色、model は左寄せで Markdown レンダリング。 */
export default function ChatBubble({ role, text, muted }: ChatBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-app-accent px-4 py-2 text-sm text-app-on-accent">
          <p className="whitespace-pre-wrap break-words">{text}</p>
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
