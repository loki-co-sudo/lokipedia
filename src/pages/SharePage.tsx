import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * Web Share Target の受け口 (/add?title=&text=&url=)。docs/DESIGN.md §5, §6 参照。
 * 共有された内容を検索ワードとしてホーム画面へ引き継ぐ。
 * Phase 5 で url の保持（source_url）に対応する。
 */
export default function SharePage() {
  const [searchParams] = useSearchParams()
  const shared =
    searchParams.get('text') ?? searchParams.get('title') ?? searchParams.get('url') ?? ''

  return <Navigate to={`/?q=${encodeURIComponent(shared)}`} replace />
}
