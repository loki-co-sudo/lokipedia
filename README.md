# lokipedia

AI（Gemini）が単語の解説と応用情報・午前試験風の4択クイズを生成し、共有辞書としてストックする PWA。
管理者（1名）が単語を登録し、友達はログイン不要・完全無料で閲覧＆クイズ挑戦できる。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | 設計書（アーキテクチャ、データモデル、画面仕様）— **唯一の正** |
| [docs/ROADMAP.md](docs/ROADMAP.md) | フェーズ別の実装ロードマップと受け入れ条件 |
| [CLAUDE.md](CLAUDE.md) | AI エージェント向け開発ルール |
| [supabase/schema.sql](supabase/schema.sql) | DB スキーマ + RLS ポリシー |

## セットアップ

```bash
npm install
cp .env.example .env.local   # Supabase の URL / anon キーを記入
npm run dev
```

### Supabase 側の手動セットアップ（管理者が実施）

1. [supabase.com](https://supabase.com) でプロジェクトを作成する。
2. SQL Editor で [supabase/schema.sql](supabase/schema.sql) の内容を全文実行する（テーブル + RLS ポリシー）。
3. Authentication → Users で管理者ユーザーを1名作成する（メール + パスワード）。
4. **Authentication → Sign In / Up → 「Allow new users to sign up」を OFF にする。**
   これを忘れると誰でもアカウントを作成でき、書き込み保護（RLS）が機能しなくなる。
5. Project Settings → API から `URL` と `anon` キーを取得し、`.env.local` に設定する。

### Gemini API キー（管理者の端末のみ）

アプリの `/settings` 画面からログイン後、Gemini API キーを登録する（この端末の localStorage にのみ保存され、リポジトリには含まれない）。

## コマンド

```bash
npm run dev      # 開発サーバー
npm run build    # 型チェック + 本番ビルド
npm run preview  # ビルド成果物の確認（Service Worker / PWA 検証用）
npm run lint     # ESLint
npm run test     # vitest（純粋関数のユニットテスト）
```

## デプロイ（Vercel）

1. GitHub にこのリポジトリを push する。
2. [Vercel](https://vercel.com) で GitHub リポジトリを連携し、新規プロジェクトとしてインポートする（Framework Preset は Vite を自動検出）。
3. Project Settings → Environment Variables に以下を設定する。
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. デプロイを実行する。SPA のクライアントサイドルーティング（`/dictionary/:id` や共有受け取り `/add` への直接アクセス）のフォールバックは [vercel.json](vercel.json) の rewrite 設定で対応済み。
5. デプロイ後、本番 URL で以下を確認する。
   - PWA としてインストールできること（Lighthouse の PWA/installable チェック）。
   - Android 実機で「共有」→ lokipedia を選択 → `/add` 経由でホーム画面の検索欄にテキストが引き継がれること。
   - 未ログインのブラウザから辞書への書き込み（タグ編集・削除・登録）が RLS により拒否されること。

## 技術スタック

Vite / React 19 / TypeScript / Tailwind CSS v4 / Supabase (Postgres + Auth + RLS) / Dexie.js (IndexedDB) / Gemini API (gemini-2.5-flash) / vite-plugin-pwa / vitest
