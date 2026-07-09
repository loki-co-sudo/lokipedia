import ReactMarkdown from 'react-markdown'

// AI 生成テキストの Markdown レンダリング。react-markdown は既定で HTML を無効化する
// （rehype-raw 等を使わない限り dangerouslySetInnerHTML 相当の挙動にならない。CLAUDE.md 絶対ルール4）。
export default function MarkdownView({ children }: { children: string }) {
  return (
    <div
      className="space-y-2 text-sm leading-relaxed text-app-text
        [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:first:mt-0
        [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:first:mt-0
        [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-bold
        [&_p]:mt-1
        [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5
        [&_ol]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5
        [&_li]:mt-0.5
        [&_strong]:font-semibold
        [&_code]:rounded [&_code]:bg-app-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
        [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-app-surface-2 [&_pre]:p-3
        [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap
        [&_img]:max-w-full
        [&_a]:break-words [&_a]:text-app-accent [&_a]:underline
        [&_blockquote]:border-l-4 [&_blockquote]:border-app-border [&_blockquote]:pl-3 [&_blockquote]:text-app-text-muted"
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}
