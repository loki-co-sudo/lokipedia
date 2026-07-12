# CLAUDE.md — lokipedia 開発ルール

AI が単語の解説と4択クイズを生成し、共有辞書としてストックする PWA。
管理者（1名）だけが書き込み、友達はログイン不要で閲覧・クイズ挑戦する。

## 必読ドキュメント

- [docs/DESIGN.md](docs/DESIGN.md) — **唯一の正とする設計書**。データモデル、RLS、画面仕様、Gemini 連携仕様はここに従う。
- [docs/ROADMAP.md](docs/ROADMAP.md) — フェーズ別の実装計画と受け入れ条件。**上から順に**進め、先回り実装しない。

設計と実装が食い違いそうなときは、実装を勝手に曲げず**管理者に確認して DESIGN.md を更新してから**実装する。

## エージェントとのやりとり

- **チャット上の回答・進捗報告・説明はすべて日本語で書くこと。** コード内の識別子（変数名・関数名等）やコマンド出力はこの限りではない。

## コマンド

```bash
npm run dev        # 開発サーバー
npm run build      # 型チェック(tsc -b) + 本番ビルド。コミット前に必ず通すこと
npm run preview    # ビルド成果物の確認（Service Worker / PWA の検証はこちらで）
npm run lint       # ESLint
npm run test       # vitest（純粋関数のユニットテスト）
```

## 技術スタック（変更禁止。追加ライブラリは管理者に確認）

Vite + React 19 + TypeScript / Tailwind CSS v4（`@tailwindcss/vite`、tailwind.config は使わない） / react-router-dom / Dexie.js / @supabase/supabase-js / vite-plugin-pwa / lucide-react / react-markdown / vitest（Phase 4 でユニットテストのため管理者承認の上追加）

## アーキテクチャ上の絶対ルール

1. **秘密情報をコードに書かない**: Gemini API キーは管理者の localStorage（`src/lib/settings.ts` 経由でのみ読み書き）。Supabase URL/anon キーは `.env.local`（gitignore 済み、`.env.example` が雛形）。
2. **書き込み保護は RLS + Supabase Auth**。クライアント側の出し分け（ボタン非表示等）は UX であってセキュリティではない。書き込み系 UI を追加するときも「RLS で守られているか」を必ず確認する。
3. **層の責務**: Supabase / IndexedDB へのアクセスは `src/lib/repository.ts` に集約。snake_case↔camelCase 変換もここだけ。ページ・コンポーネントから supabase-js や Dexie を直接呼ばない。
4. **XSS**: `dangerouslySetInnerHTML` 禁止。AI 生成テキストは react-markdown（HTML 無効のまま）でレンダリング。
5. **Gemini 呼び出し**は `src/lib/gemini.ts` のみ。`responseSchema` による構造化出力を使い、応答の手書きパースをしない。自動リトライしない。
6. **オフライン方針**: 読み取りは IndexedDB フォールバック、書き込みはオンライン必須（キューを作らない）。同期は全件置き換え（DESIGN.md §2.2）。

## コーディング規約

- TypeScript strict。`any` を使わない（外部応答は型ガードで検証）。
- UI 文言は日本語。エラーもユーザー向けに日本語で表示（console に生エラーを残すのは可）。
- コンポーネントは関数コンポーネント + hooks。ページは `src/pages/`、再利用部品は `src/components/`、ロジックは `src/lib/` と `src/hooks/`。
- Tailwind ユーティリティ直書きで良い。ただし繰り返す UI はコンポーネント化する。
- モバイルファースト（下部タブバー前提）。デスクトップは崩れなければ良い。

## 作業の進め方

- 各フェーズ完了時: 受け入れ条件を満たす → `npm run build` 成功 → ROADMAP.md のチェックボックス更新 → コミット。
- コミットは日本語 or 英語どちらでも良いが、フェーズ番号を先頭に付ける（例: `Phase 2: AI生成フローを実装`）。ロードマップ外の単発の修正・調査等の場合はフェーズ番号を付けなくてよい。
- **実装が完了し `npm run build` が通ったら、特別な理由がない限りコミット・プッシュまで実施する**（都度の確認待ちをしない）。秘密情報の混入疑いがある、変更が破壊的、意図が確認できない等の理由があるときはプッシュ前に管理者に確認する。
- 管理者しか確認できない項目（実 API キーでの生成、Android 実機の共有）は、代替確認（モック・直接 URL アクセス）まで行い、残作業を明記して管理者に依頼する。
- Supabase 側の手動設定変更（ポリシー、Auth 設定）が必要になったら、`supabase/schema.sql` も同期して更新する。
