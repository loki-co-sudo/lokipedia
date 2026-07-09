import { useParams } from 'react-router-dom'

/**
 * 単語詳細画面（docs/DESIGN.md §5.2）
 * Phase 3 で実装: Markdown 解説、タグ編集（管理者）、クイズ一覧、解答履歴。
 */
export default function WordDetailPage() {
  const { id } = useParams()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">単語詳細</h1>
      <p className="text-sm text-slate-400">id: {id}（Phase 3 で実装）</p>
    </div>
  )
}
