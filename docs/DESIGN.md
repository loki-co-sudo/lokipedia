# lokipedia 設計書

> AI が検索ワードを検出・解説し、4択クイズ付きの「共有辞書」として蓄積する PWA。
> 管理者（1名）が単語を登録し、友達（一般ユーザー）はログイン不要で閲覧・クイズ挑戦できる。

本書は**唯一の正とする設計ドキュメント**である。実装エージェントは、本書と矛盾する実装を行う前に必ず本書を更新すること（[CLAUDE.md](../CLAUDE.md) の開発ルール参照）。

---

## 1. 全体アーキテクチャ

```
┌─────────────────────────────────────────────┐
│  ブラウザ (PWA / Vercel でホスティング)         │
│                                             │
│  React SPA (Vite + TypeScript)              │
│   ├─ UI: Tailwind CSS v4 + lucide-react     │
│   ├─ ルーティング: react-router-dom          │
│   ├─ ローカルDB: Dexie.js (IndexedDB)        │
│   │    ・words/quizzes のオフラインキャッシュ  │
│   │    ・クイズ解答履歴（この端末のみ）         │
│   └─ localStorage                           │
│        ・Gemini API キー（管理者の端末のみ）   │
│        ・Supabase Auth セッション(自動管理)    │
└──────────┬──────────────────┬───────────────┘
           │                  │ (管理者のみ)
           ▼                  ▼
┌──────────────────┐  ┌─────────────────────┐
│ Supabase          │  │ Google Gemini API    │
│  ・Postgres       │  │  gemini-2.5-flash    │
│  ・RLS で保護      │  │  JSON モードで        │
│  ・Auth(管理者1名) │  │  解説+クイズを生成     │
└──────────────────┘  └─────────────────────┘
```

### 設計上の決定事項（確定済み・変更には管理者の承認が必要）

| 項目 | 決定 | 理由 |
|---|---|---|
| 管理者認証 | **Supabase Auth**（メール+パスワード、アカウントは管理者1つのみ） | anon キーは公開されるため、クライアント側のパスワード検証では書き込みを保護できない。RLS + Auth が唯一まともな防御。 |
| 書き込み保護 | RLS: SELECT は誰でも可、INSERT/UPDATE/DELETE は `authenticated` ロールのみ | Supabase ダッシュボードで**新規サインアップを無効化**するため、authenticated = 管理者。 |
| クイズ構造 | `words` : `quizzes` = 1:N の別テーブル | 管理者が同じ単語にクイズを追加生成でき、出題バリエーションが増える。 |
| クイズ解答履歴 | 端末ローカル（IndexedDB）のみ | 友達は Supabase に書き込めない設計を貫くため。完全無料・RLS がシンプル。端末を変えると履歴は引き継がれない（許容済み）。 |
| Gemini API 呼び出し | ブラウザから直接（キーは管理者の localStorage） | 使うのは管理者だけ。サーバーレス関数を挟まないことで無料・シンプルに。ソースコードにキーは絶対に書かない。 |
| ホスティング | Vercel（GitHub 連携で自動デプロイ） | HTTPS 必須（PWA / share_target 要件）。無料枠で十分。 |

---

## 2. データモデル

### 2.1 Supabase (Postgres)

DDL と RLS ポリシーは [supabase/schema.sql](../supabase/schema.sql) が正。ここでは意図を説明する。

#### `words` テーブル

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` | |
| `term` | `text` | NOT NULL | 見出し語（AI が正規化した表記） |
| `definition` | `text` | NOT NULL | 詳細な定義・解説。**Markdown**。 |
| `tags` | `text[]` | NOT NULL DEFAULT `'{}'` | ジャンルタグ。生成時に AI が3つ付与、管理者が辞書画面から追加・削除可能。 |
| `source_url` | `text` | NULL可 | Web Share Target 経由で URL が渡された場合に保存 |
| `created_at` | `timestamptz` | DEFAULT `now()` | |
| `updated_at` | `timestamptz` | DEFAULT `now()` | 更新時にアプリ側でセット |

#### `quizzes` テーブル

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `word_id` | `uuid` | FK → `words.id`, `ON DELETE CASCADE` | |
| `question` | `text` | NOT NULL | 応用情報技術者試験・午前試験風の問題文 |
| `choices` | `text[]` | NOT NULL（必ず4要素） | 選択肢。**シャッフルは出題時にクライアントで行う**（DB には AI 生成順で保存） |
| `correct_index` | `smallint` | NOT NULL, 0〜3 | `choices` 内の正解の添字 |
| `explanation` | `text` | NOT NULL | 正解の詳しい解説（Markdown） |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

#### RLS ポリシー（両テーブル共通）

- RLS を **有効化** する。
- `SELECT`: `anon`, `authenticated` に許可（`USING (true)`）→ 友達はログイン不要で閲覧可。
- `INSERT` / `UPDATE` / `DELETE`: `authenticated` のみ許可。
- **運用上の必須設定**: Supabase ダッシュボード → Authentication → Sign In / Up で **「Allow new users to sign up」を OFF** にする。これを忘れると誰でもアカウントを作って書き込めてしまう。セットアップ手順は [ROADMAP.md](ROADMAP.md) Phase 1 に記載。

### 2.2 IndexedDB (Dexie.js) — [src/lib/db.ts](../src/lib/db.ts)

| ストア | キー | 用途 |
|---|---|---|
| `words` | `id` | Supabase の words のキャッシュ（オフライン閲覧用） |
| `quizzes` | `id`, index: `wordId` | Supabase の quizzes のキャッシュ |
| `quizHistory` | `++id`, index: `quizId`, `wordId`, `answeredAt` | この端末での解答履歴 `{ quizId, wordId, selectedIndex, isCorrect, answeredAt }` |
| `meta` | `key` | 最終同期時刻などのメタ情報 |

**同期方針（単純化のため以下で固定）**: アプリ起動時とオンライン復帰時に Supabase から全件フェッチして IndexedDB を丸ごと置き換える（`bulkPut` + 消えた id の削除）。データ量は個人辞書レベル（数百〜数千件）なので差分同期はしない。オフライン時は IndexedDB から読む。**書き込み系（管理者機能）はオンライン必須**とし、オフライン書き込みキューは作らない。

### 2.3 localStorage

| キー | 内容 |
|---|---|
| `lokipedia:gemini-api-key` | 管理者の Gemini API キー。設定画面から保存。**コードやリポジトリに含めない。** |
| （supabase-js が自動管理） | Auth セッショントークン |

---

## 3. 型定義（正は [src/types.ts](../src/types.ts)）

```ts
interface Word {
  id: string;
  term: string;
  definition: string;      // Markdown
  tags: string[];
  sourceUrl: string | null;
  createdAt: string;       // ISO 8601
  updatedAt: string;
}

interface Quiz {
  id: string;
  wordId: string;
  question: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;     // Markdown
  createdAt: string;
}

interface QuizHistoryEntry {
  id?: number;             // Dexie auto-increment
  quizId: string;
  wordId: string;
  selectedIndex: number;
  isCorrect: boolean;
  answeredAt: string;
}

// Gemini からの生成結果（保存前のプレビューに使う）
interface GeneratedEntry {
  term: string;
  definition: string;
  tags: string[];          // ちょうど3つ
  quiz: {
    question: string;
    choices: [string, string, string, string];
    correctIndex: 0 | 1 | 2 | 3;
    explanation: string;
  };
}
```

**命名規約**: DB（Postgres）は snake_case、アプリ内は camelCase。変換はデータ層（`src/lib/repository.ts`）に閉じ込め、UI 層に snake_case を漏らさない。

---

## 4. Gemini API 連携 — [src/lib/gemini.ts](../src/lib/gemini.ts)

- モデル: `gemini-2.5-flash`
- エンドポイント: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}`
- `generationConfig.responseMimeType: "application/json"` と `responseSchema` を指定し、**構造化 JSON で受け取る**（フリーテキストの JSON パースに頼らない）。
- `responseSchema` は §3 の `GeneratedEntry` と一致させる。
- プロンプト要件:
  - 入力は「単語」「〜について教えて」のような文、または共有された URL/テキストのいずれもあり得る。**まず調べたい主題を特定して `term` に正規化**させる。
  - `definition`: 日本語、Markdown、見出し・箇条書きを活用した詳細な解説。
  - `tags`: そのジャンルを表す日本語タグをちょうど3つ（例: 情報セキュリティ, ネットワーク, 国内, 芸能）。**既存タグとの表記揺れを防ぐため、生成リクエスト時に既存タグ一覧をプロンプトに含めて「該当があれば再利用せよ」と指示する。**
  - `quiz`: 応用情報技術者試験・午前試験風。問題文は知識の理解を問うもの、選択肢4つはもっともらしい誤答を含む、`explanation` は正解の根拠と誤答が誤りである理由まで述べる。
- エラー処理: HTTP エラー・スキーマ不一致（choices が4つでない等）は例外を投げ、UI 側でメッセージ表示。**リトライは自動で行わない**（ユーザーが再実行）。

---

## 5. 画面設計

ルーティング（react-router-dom）:

| パス | 画面 | アクセス |
|---|---|---|
| `/` | ホーム / 検索・生成 | 検索実行は管理者ログイン時のみ有効。未ログイン時は辞書への導線と「管理者ログイン」への案内を表示 |
| `/add` | 共有受け取り（Web Share Target の飛び先） | クエリ `?title=&text=&url=` を解釈しホームの入力欄へ引き継ぎリダイレクト |
| `/dictionary` | 辞書一覧 | 全員 |
| `/dictionary/:id` | 単語詳細 | 全員 |
| `/quiz` | クイズモード | 全員 |
| `/settings` | 設定（管理者ログイン、Gemini キー保存） | 全員表示可（ログインフォームがあるため）|

### 5.1 ホーム / 検索画面 (`/`)
- 検索ワード入力欄 + タグ入力欄（チップ形式：Enter/カンマで確定、×で削除）。タグを手入力した場合は AI 生成タグより優先。
- 「AIで生成」ボタン → ローディング表示 → **プレビューカード**（definition の Markdown レンダリング + クイズの全文）を表示。
- プレビューで管理者は definition の再生成・タグ編集ができ、「辞書に登録」で Supabase へ保存。
- 未ログイン時は生成ボタンを無効化し、理由を表示。

### 5.2 辞書画面 (`/dictionary`, `/dictionary/:id`)
- カードグリッド一覧（term, タグチップ, definition 冒頭の抜粋）。
- 上部にタグフィルタ（登録済みタグ一覧から複数選択、AND 絞り込み）+ フリーテキスト絞り込み。
- 詳細画面: definition を Markdown レンダリング、タグ編集（管理者のみ表示）、この単語のクイズ一覧、**この端末での解答履歴**（正答率、直近の解答）。
- 管理者のみ: 単語の削除、クイズの追加生成ボタン。

### 5.3 クイズモード画面 (`/quiz`)
- 開始前設定: タグ絞り込み（未選択なら全件）、出題数（5 / 10 / 全部）。
- 出題: 対象クイズをシャッフルして順に表示。**選択肢の表示順も毎回シャッフル**（correct_index はシャッフル後に写像）。
- 解答後: 即座に正解/不正解 + explanation（Markdown）を表示、「次へ」で進む。解答は quizHistory に記録。
- 終了後: スコアサマリ（n問中m問正解、間違えた単語へのリンク）。

### 5.4 設定画面 (`/settings`)
- 管理者ログイン（メール + パスワード）/ ログアウト。ログイン状態を明示。
- Gemini API キーの保存・削除（localStorage）。キーは伏字表示、「表示」トグル付き。
- データ再同期ボタン（Supabase → IndexedDB の強制リフレッシュ）。

### UI 共通
- 下部固定のタブバー（モバイル前提）: ホーム / 辞書 / クイズ / 設定（lucide-react アイコン）。
- 言語は日本語。ダーク/ライトは Tailwind の `prefers-color-scheme` 準拠（v1 ではトグル不要）。

---

## 6. PWA 要件 — [vite.config.ts](../vite.config.ts)

- `vite-plugin-pwa` を使用、`registerType: 'autoUpdate'`。
- manifest: `display: "standalone"`、日本語名 `lokipedia`、テーマカラー、192/512px アイコン（maskable 含む）。
- **Web Share Target**（manifest に以下を設定。GET 方式）:
  ```json
  {
    "share_target": {
      "action": "/add",
      "method": "GET",
      "params": { "title": "title", "text": "text", "url": "url" }
    }
  }
  ```
  ※ share_target は**インストール済み PWA** でのみ機能する。受け側 `/add` は SPA ルートなので、Workbox の `navigateFallback`（デフォルトで index.html）で処理される。
- オフライン: アプリシェルは precache、データは §2.2 の IndexedDB キャッシュで閲覧・クイズが動作すること。Gemini 生成と Supabase 書き込みはオフライン非対応（明示的にエラー表示）。

---

## 7. セキュリティ整理

| 資産 | 保護方法 |
|---|---|
| Supabase anon キー・URL | 公開前提（`.env` → `VITE_` 変数）。保護は RLS が担う。 |
| 書き込み権限 | RLS + Supabase Auth。サインアップ無効化が前提条件。 |
| Gemini API キー | 管理者の localStorage のみ。リポジトリ・ビルド成果物に含めない。設定画面以外で読み書きしない（`src/lib/settings.ts` に集約）。 |
| XSS | definition/explanation は Markdown → react-markdown でレンダリング（`dangerouslySetInnerHTML` 禁止、rehype-raw 等で HTML を有効化しない）。 |

---

## 8. ディレクトリ構成（正）

```
lokipedia/
├── CLAUDE.md              # 開発ルール（エージェント向け）
├── docs/
│   ├── DESIGN.md          # 本書
│   └── ROADMAP.md         # 実装ロードマップ（フェーズ別・受け入れ条件付き）
├── supabase/
│   └── schema.sql         # DDL + RLS（Supabase SQL Editor に貼って実行）
├── public/                # アイコン等の静的ファイル
├── src/
│   ├── main.tsx           # エントリ
│   ├── App.tsx            # ルーティング + レイアウト（タブバー）
│   ├── index.css          # Tailwind エントリ
│   ├── types.ts           # 共有型（§3）
│   ├── lib/
│   │   ├── supabase.ts    # supabase-js クライアント生成（env 読み込みはここだけ）
│   │   ├── repository.ts  # データ層。snake_case↔camelCase 変換、Supabase/IndexedDB の使い分けを隠蔽
│   │   ├── db.ts          # Dexie スキーマ（§2.2）
│   │   ├── gemini.ts      # Gemini 呼び出し（§4）
│   │   └── settings.ts    # localStorage アクセス集約
│   ├── hooks/             # useAuth, useWords 等
│   ├── components/        # 再利用 UI（TagChip, WordCard, QuizCard, MarkdownView 等）
│   └── pages/
│       ├── HomePage.tsx
│       ├── SharePage.tsx      # /add
│       ├── DictionaryPage.tsx
│       ├── WordDetailPage.tsx
│       ├── QuizPage.tsx
│       └── SettingsPage.tsx
├── .env.example           # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
└── vite.config.ts
```
