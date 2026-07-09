import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * Web Share Target の受け口 (/add?title=&text=&url=)。docs/DESIGN.md §5, §6 参照。
 * 共有された内容を検索ワードとしてホーム画面へ引き継ぐ。URL が含まれる場合は
 * source_url としてホームに引き継ぎ、登録時に word.sourceUrl へ渡す。
 */
export default function SharePage() {
  const [searchParams] = useSearchParams()
  const text = searchParams.get('text')?.trim() ?? ''
  const title = searchParams.get('title')?.trim() ?? ''
  const url = searchParams.get('url')?.trim() ?? ''

  const query = text || title || url
  const dest = new URLSearchParams()
  if (query) dest.set('q', query)
  if (url) dest.set('source_url', url)

  return <Navigate to={`/?${dest.toString()}`} replace />
}
