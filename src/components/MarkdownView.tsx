import ReactMarkdown from 'react-markdown'

// AI 生成テキストの Markdown レンダリング。react-markdown は既定で HTML を無効化する
// （rehype-raw 等を使わない限り dangerouslySetInnerHTML 相当の挙動にならない。CLAUDE.md 絶対ルール4）。
export default function MarkdownView({ children }: { children: string }) {
  return (
    <div
      className="space-y-2 text-sm leading-relaxed text-slate-800
        [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:first:mt-0
        [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:first:mt-0
        [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-bold
        [&_p]:mt-1
        [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5
        [&_ol]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5
        [&_li]:mt-0.5
        [&_strong]:font-semibold
        [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
        [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-3
        [&_a]:text-sky-600 [&_a]:underline
        [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500"
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}
