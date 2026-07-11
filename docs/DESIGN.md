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
| `reading` | `text` | NULL可 | 見出し語のよみがな（**ひらがな**）。50音順ソート（§5.2）に使用。生成時に AI が付与。Phase 7 より前に登録された行は NULL（ソート時は `term` にフォールバック）。 |
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
| `lokipedia:theme` | テーマ選択 `'light' \| 'dark' \| 'loki'`（§5.5）。未設定時のデフォルトは `'loki'`。 |
| `lokipedia:dictionary-sort` | 辞書一覧の並び順 `'latest' \| 'kana'`（§5.2）。未設定時は `'latest'`。 |
| `lokipedia:answer-mode` | 回答モード `'standard' \| 'loki' \| 'gentle' \| 'kansai' \| 'expert'`（§4.2 / §5.1）。未設定時は `'standard'`。 |
| （supabase-js が自動管理） | Auth セッショントークン |

localStorage の読み書きはすべて `src/lib/settings.ts` に集約する（キーごとに get/set 関数を追加）。

---

## 3. 型定義（正は [src/types.ts](../src/types.ts)）

```ts
interface Word {
  id: string;
  term: string;
  reading: string | null;  // よみがな（ひらがな）。50音順ソート用。旧データは null
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
  reading: string;         // よみがな（ひらがな）
  definition: string;
  tags: string[];          // ちょうど3つ
  quiz: {
    question: string;
    choices: [string, string, string, string];
    correctIndex: 0 | 1 | 2 | 3;
    explanation: string;
  };
}

// 継続質問（§4.1 / §5.1）の会話履歴。メモリ上のみで永続化しない
interface ChatMessage {
  role: 'user' | 'model';
  text: string;            // Markdown
  images?: ChatImage[];    // ユーザーメッセージへの添付画像（§4.4）。model には付かない
}

// チャット入力に添付する画像（§4.4）。メモリ上のみで永続化しない
interface ChatImage {
  mimeType: string;
  data: string;             // base64エンコード（data: プレフィックスなし）
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
  - `reading`: `term` のよみがなを**ひらがな**で（例: term「冪等性」→「べきとうせい」、英字語は日本語での読み「PWA」→「ぴーだぶりゅーえー」）。
  - `definition`: 日本語、Markdown、見出し・箇条書きを活用した詳細な解説。
  - `tags`: そのジャンルを表す日本語タグをちょうど3つ（例: 情報セキュリティ, ネットワーク, 国内, 芸能）。**既存タグとの表記揺れを防ぐため、生成リクエスト時に既存タグ一覧をプロンプトに含めて「該当があれば再利用せよ」と指示する。**
  - `quiz`: 応用情報技術者試験・午前試験風。問題文は知識の理解を問うもの、選択肢4つはもっともらしい誤答を含む、`explanation` は正解の根拠と誤答が誤りである理由まで述べる。
    - **選択肢は出題時にシャッフルされるため、位置参照を禁止する**: `choices` の各要素にラベル（「A.」「1.」「ア」「①」等）を付けさせない。`explanation` では選択肢を番号・記号で参照せず、必ず内容の引用（「『〜』が正解」）で言及させる。
- エラー処理: HTTP エラー・スキーマ不一致（choices が4つでない等）は例外を投げ、UI 側でメッセージ表示。**リトライは自動で行わない**（ユーザーが再実行）。

### 4.1 継続質問（マルチターン・Phase 9）

エントリ生成後、ユーザーは同じ入力欄から追加質問できる（§5.1）。このための関数を `gemini.ts` に追加する。

- `generateFollowUp(history: ChatMessage[], apiKey: string, mode: AnswerMode): Promise<string>`
  - `history` は user / model が交互に並ぶ会話履歴で、**末尾は必ず role: 'user'（今回の質問）**。
  - リクエストの `contents` に `role` 付きで履歴をそのまま渡す（Gemini API のマルチターン形式）。
  - 会話の最初の model ターンには、初回生成の JSON 全体ではなく **`definition` の Markdown テキスト**を入れる（トークン節約のため。クイズやタグは会話文脈に不要）。
  - **`responseSchema` は使わない**。応答は自由な日本語 Markdown テキストで、`candidates[0].content.parts[0].text` を取り出してそのまま返す。
  - システム指示（プロンプト先頭 or systemInstruction）: 「直前までの解説の文脈を踏まえ、日本語の Markdown で簡潔に回答せよ」。
  - エラー処理は `generateEntry` と同方針（日本語メッセージ、**自動リトライしない**）。
- 会話はメモリ上のみ（リロードで消える）が、**ページ遷移をまたいで保持する**（§5.1 の ChatSessionProvider）。

### 4.2 回答モード（文体切り替え）

回答の文体・深さを「標準 / ロキ / 優しく / 関西弁 / エキスパート」の5モードから選択できる。定義は [src/lib/answerMode.ts](../src/lib/answerMode.ts) に集約する。

| モード | 文体 |
|---|---|
| `standard`（標準） | 中立で丁寧。初学者にもわかりやすく |
| `loki`（ロキ） | 北欧神話のロキ風の狡猾なトリックスター。馴れ馴れしい「相棒」のノリで調子が良くて憎めないが、皮肉や悪知恵の匂いをにじませる |
| `gentle`（優しく） | お姉さんが子どもに語りかけるような優しい口調。例え話を交えてかみ砕く |
| `kansai`（関西弁） | 元気でハキハキした関西弁のお兄さん風 |
| `expert`（エキスパート） | その道のエキスパート向け。入門的説明は最小限にし、内部の仕組みや周辺知識まで踏み込むマニア向け解説 |

- `generateEntry(input, apiKey, existingTags, mode)`: 文体指示をプロンプトに含める。**適用対象は `definition` と `quiz.explanation` のみ**（term / reading / tags / question / choices は中立のまま）。
- `generateFollowUp(history, apiKey, mode)`: systemInstruction に文体指示を追記する。
- 選択 UI は設定画面（§5.4）。選択は `lokipedia:answer-mode`（§2.3）に保存し、次回以降も維持する。
- **モードは会話ごとに固定する**: 初回生成時の設定値を会話に紐付け、継続質問はすべてそのモードで回答する（履歴に旧モードの回答が残った状態で文体指示だけ変えると口調が混ざるため）。設定変更が反映されるのは次の会話（「新しく調べる」/「会話をリセット」後）または「再生成」から。

### 4.3 継続質問の回答からの辞書登録

- `generateEntryFromConversation(history: ChatMessage[], apiKey: string, existingTags: string[], mode: AnswerMode): Promise<GeneratedEntry>`
  - `history` は会話の先頭から対象の model 回答まで（末尾が対象の回答）。
  - 会話の**最後の質問とその回答**の主題から辞書エントリ1件を構造化生成する。definition は会話を読んでいない人でも単体で理解できるよう再構成させる。
  - 出力要件・`responseSchema`・エラー処理は `generateEntry` と共通（§4）。回答モードは会話に固定されたものを使う。

### 4.4 画像添付（チャット入力の補助情報）

チャット入力欄（初回の調べる入力・継続質問の両方）から画像を添付し、`generateEntry` / `generateFollowUp` へのマルチモーダル入力として渡せる。テキストの補助情報という位置づけであり、画像だけの送信（テキスト空）も許可する。

- **枚数**: 1メッセージにつき最大 `MAX_IMAGES_PER_MESSAGE`（= 4）枚。`src/lib/image.ts` に定数を置く。
- **前処理**（`src/lib/image.ts` の `fileToChatImage`）: 選択されたファイルは `image/*` であることを確認した上で、`<canvas>` で長辺 1600px に縮小 + JPEG（品質 0.85）に再エンコードしてから base64 化する。Gemini への送信データ量を抑えるため、元ファイルの形式（HEIC 等）に関わらず常に `image/jpeg` として送る。読み込み失敗・非画像ファイルは日本語エラーメッセージを返す。
- **Gemini リクエスト**: `contents[].parts` の先頭に画像の数だけ `inlineData: { mimeType, data }` を並べ、末尾にテキストの `text` パートを置く（`generateEntry` は `requestGeneratedEntry` 内、`generateFollowUp` は履歴の各ターンで同様に組み立てる）。
  - テキストが空で画像のみの場合、`generateEntry` は入力欄に「（添付画像から調べたい主題を特定してください）」を、`generateFollowUp` の該当ターンは「添付した画像について教えてください。」を代わりに送る（表示上の吹き出しは空のまま。画像のみのフォールバックはリクエスト構築時にのみ適用する）。
- **会話履歴には持ち回さない**: 初回送信の添付画像は `lastQueryImages`（ChatSessionProvider）として表示専用に保持し、`generateFollowUp` の `history` には含めない（初回の `definition` に画像から得た情報が反映されているため、履歴側で画像を再送する必要はない）。継続質問で添付した画像は、その `ChatMessage.images` としてのみ会話に乗る。
- **`generateEntryFromConversation`（§4.3）は画像を扱わない**（対象外。テキストの transcript のみで再構成する）。

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

### 5.1 ホーム / 検索・生成画面 (`/`) — チャット形式（Phase 8–9 で刷新）

チャットボット（ChatGPT 等）ライクな1カラム構成。会話エリア + 下部固定のプロンプト入力欄。

**入力欄（`src/components/ChatInput.tsx`）**
- 自動リサイズする textarea（1行〜最大6行。それ以上は textarea 内スクロール）。角丸の枠内右下に送信ボタン（lucide `Send`）。
- Enter は改行。送信は送信ボタン（デスクトップでは Ctrl/Cmd+Enter でも送信可）。
- タブバーの上に固定配置（`position: fixed` + タブバー高さ分の bottom オフセット。会話エリア側に入力欄の高さ分の padding-bottom を確保）。
- 未ログイン時・Gemini キー未設定時は入力欄を無効化し、理由と設定画面への導線を表示（従来仕様を踏襲）。
- **生成前のタグ入力欄は廃止**（タグは生成結果の表示後に編集する。下記）。
- **回答モード**（§4.2）の選択 UI は設定画面（§5.4）に置く。会話中は入力欄の上に「回答モード「◯◯」で会話中」の表示と**会話をリセット**ボタン（会話を破棄して初期状態へ）を出す。
- textarea のフォントは **16px（`text-base`）以上**とする。iOS Safari は 16px 未満の入力欄にフォーカスすると自動ズームしてレイアウトが崩れるため（入力系要素全般の最低 16px は `index.css` の base ルールで保証）。
- **画像添付**（§4.4）: textarea の左に添付ボタン（lucide `ImagePlus`）。`<input type="file" accept="image/*" multiple>` で選択（iOS Safari では写真ライブラリ/カメラ撮影の選択肢が自動的に出る）。選択した画像は入力欄上部にサムネイル（各画像に×で個別削除）として並べ、最大4枚。テキストが空でも画像があれば送信できる。送信後は画像もクリアする。

**初回送信 → エントリカード**
- 送信した検索ワードは user の吹き出し（`src/components/ChatBubble.tsx`）として会話エリアに表示し、その下に回答（エントリカード）を続ける。ローディング中は「考え中...」の吹き出しを表示する。
- 最初の送信で `generateEntry()` を呼び、ローディング後、結果を**エントリカード**として会話エリアに表示する:
  - `term`（見出し）+ タグ編集 UI + `definition` の Markdown レンダリング。
  - **クイズは表示しない**。「4択クイズも1問生成済み（登録時に一緒に保存されます）」という注記のみ置く。
  - タグ編集 UI: AI 生成タグを初期値としてチップ表示（× で削除）。**既存タグ一覧からタップで追加** + 自由入力（TagChipInput）の両方を提供。
- 「再生成」ボタンはエントリカード上に置く（同じ入力で引き直し。継続質問中の会話は破棄される旨を注記）。

**登録 / 更新の選択（Phase 8）**
- 生成結果の `term` を正規化して既存 words と照合する（`src/lib/text.ts` の純粋関数 `normalizeTerm`: NFKC 正規化 + trim + 小文字化）。
  - **一致なし** → 「辞書に登録」ボタン（従来どおり `createWordWithQuiz()`）。
  - **一致あり** → 「『X』は登録済みです（YYYY/MM/DD 登録）」と表示し、2つのボタンを出す:
    - **「既存の単語を更新」**: `updateWordWithQuiz(id, input)` — term / reading / definition / tags / updated_at を上書き。source_url は新しい値がある場合のみ上書き（null なら既存値を維持）。クイズは**追加**（既存クイズは削除しない。words:quizzes = 1:N の設計を活かす）。
    - **「新規として登録」**: `createWordWithQuiz()`（同名の別項目として許容する）。
  - 成功時はトースト（「登録しました」/「更新しました」）を表示するのみで、**画面遷移しない**（そのまま継続質問を続けられる）。登録成功後は既存一致扱いに切り替わり、以降の保存は「既存の単語を更新 / 新規として登録」の選択になる。

**継続質問（Phase 9）**
- エントリカード表示後も入力欄は有効なまま。追加送信は `generateFollowUp()`（§4.1）を呼び、user の吹き出し / model の Markdown 吹き出しとして会話エリアに追記する。
- 登録・更新ボタンはエントリカード上に残り続ける（継続質問後でも登録できる）。
- **継続質問の回答からの辞書登録**: 各 model 回答の吹き出しの下に「この回答を辞書に登録」ボタン（管理者のみ）。押すと `generateEntryFromConversation()`（§4.3）で構造化エントリを生成し、初回と同じ登録カード（GeneratedEntryCard: タグ編集・重複チェック・登録/更新）を吹き出しの直下に開く（×で閉じる。同時に開けるカードは1つ）。
- **会話はページ遷移をまたいで保持する**（ChatSessionProvider が App 直下で state を保持）。「新しく調べる」/「会話をリセット」で破棄され、リロードでは消える（メモリ上のみ）。
- `/add`（共有受け取り）からの `?q=` `?source_url=` の引き継ぎは従来どおり（入力欄に初期値として投入）。

### 5.2 辞書画面 (`/dictionary`, `/dictionary/:id`)
- カードグリッド一覧（term, タグチップ, definition 冒頭の抜粋）。
- 上部にタグフィルタ（登録済みタグ一覧から複数選択、AND 絞り込み）+ フリーテキスト絞り込み。
- **並び替えトグル（Phase 10）**: セグメントコントロール「新着順（デフォルト） / 50音順」。
  - 新着順: `createdAt` 降順（従来どおり）。
  - 50音順: `Intl.Collator('ja')` で `reading ?? term` を比較して昇順。比較ロジックは `src/lib/wordSort.ts` の純粋関数に切り出す（vitest 対象）。
  - 選択は `lokipedia:dictionary-sort`（§2.3）に保存し、次回訪問時も維持する。
- 詳細画面: definition を Markdown レンダリング、タグ編集（管理者のみ表示）、この単語のクイズ一覧、**この端末での解答履歴**（正答率、直近の解答）。
- 管理者のみ: 単語の削除、クイズの追加生成ボタン、**reading（よみがな）の表示・編集**（Phase 10。reading が NULL の旧データをバックフィルする手段を兼ねる）。

### 5.3 クイズモード画面 (`/quiz`)
- 開始前設定: タグ絞り込み（未選択なら全件）、出題数（5 / 10 / 全部）。
- 出題: 対象クイズをシャッフルして順に表示。**選択肢の表示順も毎回シャッフル**（correct_index はシャッフル後に写像）。
  - 選択肢は**シャッフル後の並びで 1〜4 の番号を付けて表示**する。旧データの選択肢に含まれるラベル接頭辞（「A.」「1.」「ア」「①」等）は表示時に除去する（`stripChoiceLabel`）。新規生成分はプロンプト側でラベル・位置参照を禁止（§4）。
- 解答後: 即座に正解/不正解（不正解時はシャッフル後の正解番号も表示）+ explanation（Markdown）を表示、「次へ」で進む。解答は quizHistory に記録。
- 終了後: スコアサマリ（n問中m問正解、間違えた単語へのリンク）。

### 5.4 設定画面 (`/settings`)
- 管理者ログイン（メール + パスワード）/ ログアウト。ログイン状態を明示。
- Gemini API キーの保存・削除（localStorage）。キーは伏字表示、「表示」トグル付き。
- データ再同期ボタン（Supabase → IndexedDB の強制リフレッシュ）。
- **回答モード選択（§4.2）**: 「標準 / ロキ / 優しく / 関西弁 / エキスパート」のチップ。即時 `lokipedia:answer-mode`（§2.3）に保存されるが、進行中の会話には影響しない（会話ごと固定）。
- **テーマ選択（Phase 11）**: 「ライト / ダーク / ロキ」の3択（スウォッチ付きボタン）。選択は即時反映され、`lokipedia:theme`（§2.3）に保存される。全ユーザーが利用可（ログイン不要）。

### 5.5 テーマシステム（Phase 11）

[design/README.md](../design/README.md) のコンセプト「トリックスター(Loki)×知性」= **藍色（知性）× 琥珀色（悪戯・閃き）** をサイト全体に展開する。

**仕組み**
- `<html>` の `data-theme` 属性（`light` / `dark` / `loki`）で切り替える。デフォルトは **`loki`**。
- `index.html` の `<head>` に、バンドル読み込み前に localStorage を読んで `data-theme` を設定するインラインスクリプトを置く（初期描画のテーマちらつき = FOUC を防ぐ）。
- `src/hooks/useTheme.ts`: 現在テーマの取得・変更（`settings.ts` 経由で永続化 + `data-theme` 反映 + `<meta name="theme-color">` の更新）。
- `src/index.css` にセマンティックトークンを CSS 変数で定義し、Tailwind v4 の `@theme inline` で utility 化する。**ページ・コンポーネントでは `slate-*` / `sky-*` 等の生パレット直書きを禁止**し、トークン utility のみ使う:

```css
:root[data-theme="light"] { --app-bg: #f8fafc; /* …下表… */ }
:root[data-theme="dark"]  { --app-bg: #0f172a; }
:root[data-theme="loki"]  { --app-bg: #1e1b4b; }

@theme inline {
  --color-app-bg: var(--app-bg);
  --color-app-surface: var(--app-surface);
  /* … トークンごとに1行 … */
}
/* 使用例: bg-app-bg text-app-text border-app-border bg-app-accent */
```

**トークンと各テーマの色値（この表が正。変更には管理者の承認が必要）**

| トークン | 用途 | light | dark | loki |
|---|---|---|---|---|
| `app-bg` | ページ背景 | `#f8fafc` | `#0f172a` | `#1e1b4b` |
| `app-surface` | カード・入力欄の背景 | `#ffffff` | `#1e293b` | `#312e81` |
| `app-surface-2` | 一段沈んだ面（コードブロック背景等） | `#f1f5f9` | `#0f172a` | `#272364` |
| `app-border` | 枠線 | `#e2e8f0` | `#334155` | `#4338ca` |
| `app-text` | 本文 | `#0f172a` | `#f1f5f9` | `#eef2ff` |
| `app-text-muted` | 補足テキスト | `#64748b` | `#94a3b8` | `#a5b4fc` |
| `app-accent` | 主ボタン・アクティブタブ・リンク | `#4338ca` | `#818cf8` | `#f59e0b` |
| `app-accent-hover` | accent のホバー/押下 | `#3730a3` | `#a5b4fc` | `#fbbf24` |
| `app-on-accent` | accent 上の文字色 | `#ffffff` | `#1e1b4b` | `#1e1b4b` |
| `app-success` | 正解・成功 | `#059669` | `#34d399` | `#34d399` |
| `app-danger` | エラー・削除 | `#e11d48` | `#fb7185` | `#fb7185` |
| `app-warning` | 注意・未設定警告 | `#d97706` | `#fbbf24` | `#fbbf24` |

- PWA manifest（vite.config.ts）の `theme_color` / `background_color` はロキテーマ基調（`#1e1b4b`）に更新する。

### UI 共通
- 下部固定のタブバー（モバイル前提）: ホーム / 辞書 / クイズ / 設定（lucide-react アイコン）。
- 言語は日本語。テーマは §5.5 の3テーマ（設定画面で切替。デフォルトはロキ。`prefers-color-scheme` には追従しない）。
- **モバイル表示（Phase 12）**: 全ページで**横スクロールを発生させない**（横スライドする UI は作らない）。はみ出しうる要素（Markdown 内のコードブロック・表・長い URL・長い見出し語）は、その要素自身を `overflow-x-auto`（カード内で閉じる）や `break-words` で処理する。**ルート要素への `overflow-x: hidden` で症状を隠すことは禁止**（原因を除去する）。基準ビューポート幅は 320px〜430px。

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
│   │   ├── gemini.ts      # Gemini 呼び出し（§4, §4.1）
│   │   ├── settings.ts    # localStorage アクセス集約（§2.3）
│   │   ├── text.ts        # テキスト系純粋関数（normalizeTerm 等）
│   │   ├── wordSort.ts    # 辞書ソートの純粋関数（§5.2, Phase 10）
│   │   └── image.ts       # チャット添付画像の読み込み・縮小（§4.4）
│   ├── hooks/             # useAuth, useTheme 等
│   ├── components/        # 再利用 UI（TagChipInput, WordCard, MarkdownView, ChatInput 等）
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
