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

Supabase 側のセットアップ（プロジェクト作成、schema.sql の実行、管理者ユーザー作成、**サインアップ無効化**）は [docs/ROADMAP.md](docs/ROADMAP.md) Phase 1 の手順を参照。

## コマンド

```bash
npm run dev      # 開発サーバー
npm run build    # 型チェック + 本番ビルド
npm run preview  # ビルド成果物の確認（PWA 検証用）
npm run lint     # ESLint
```

## 技術スタック

Vite / React 19 / TypeScript / Tailwind CSS v4 / Supabase (Postgres + Auth + RLS) / Dexie.js (IndexedDB) / Gemini API (gemini-2.5-flash) / vite-plugin-pwa
