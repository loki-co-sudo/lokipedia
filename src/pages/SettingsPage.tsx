/**
 * 設定画面（docs/DESIGN.md §5.4）
 * Phase 1 で実装: 管理者ログイン（Supabase Auth）、Gemini API キー保存（localStorage）、再同期。
 */
export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">設定</h1>
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
        管理者ログインと Gemini API キー設定は Phase 1 で実装します
      </p>
    </div>
  )
}
