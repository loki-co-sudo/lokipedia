# lokipedia 実装ロードマップ

実装エージェントへ: 各フェーズは **上から順に** 実施すること。着手前に [DESIGN.md](DESIGN.md) と [CLAUDE.md](../CLAUDE.md) を必ず読むこと。各フェーズの「受け入れ条件」を全て満たし、`npm run build` が通った状態でコミットしてからフェーズを完了とする。フェーズをまたぐ先回り実装（例: Phase 2 中に クイズ画面を作り込む）はしない。

進捗管理: フェーズ完了時に本ファイルのチェックボックスを更新してコミットに含めること。

---

## Phase 0: スキャフォールド ✅（初期セッションで完了済み）

- [x] Vite + React + TypeScript + Tailwind v4 + vite-plugin-pwa の土台
- [x] ルーティングと全ページのプレースホルダ、タブバー
- [x] `src/types.ts`（DESIGN.md §3 と一致）
- [x] `supabase/schema.sql`（DDL + RLS）
- [x] git 初期化・初回コミット

---

## Phase 1: Supabase 接続・認証・データ層

**ゴール**: 管理者がログインでき、辞書データの読み書きが repository 経由でできる。

### 手動セットアップ（管理者が行う。エージェントは手順を README に書き、実施を依頼すること）
1. supabase.com でプロジェクト作成。
2. SQL Editor で `supabase/schema.sql` を実行。
3. Authentication → Users で管理者ユーザーを1名作成（メール+パスワード）。
4. **Authentication → Sign In / Up → 「Allow new users to sign up」を OFF**（これを怠ると誰でも書き込めるようになる。必ず手順に含めること）。
5. Project Settings → API から URL と anon キーを取得し、`.env.local` に設定。

### 実装タスク
- [x] `src/lib/supabase.ts`: `import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY` からクライアント生成。env 未設定時は起動時に分かりやすいエラー表示（白画面にしない）。
- [x] `src/hooks/useAuth.ts`: セッション状態の購読、`signIn(email, password)` / `signOut()`。
- [x] 設定画面: ログインフォーム、ログイン状態表示、ログアウト、Gemini キー保存 UI（`src/lib/settings.ts` 経由）。
- [x] `src/lib/repository.ts`: `listWords / getWord / createWordWithQuiz / updateWordTags / deleteWord / listQuizzes(byWordId?) / addQuiz` を実装。snake_case↔camelCase 変換はここに閉じ込める（DESIGN.md §3）。
- [x] `src/lib/db.ts`（Dexie）: DESIGN.md §2.2 のストア定義。全件同期関数 `syncFromSupabase()` は Supabase アクセスを伴うため repository.ts に実装（CLAUDE.md「Supabase/IndexedDB アクセスは repository.ts に集約」を優先、db.ts はスキーマ定義のみに専念）。読み取り系はオフライン時 IndexedDB にフォールバック。

### 受け入れ条件
- [x] 設定画面から管理者ログイン/ログアウトができ、リロード後もセッションが維持される。**管理者が実際のアカウントで確認済み**（ログイン成功・リロード後のセッション維持ともにOK）。
- [x] 未ログインのブラウザから Supabase への INSERT が RLS で拒否されることを確認。`curl` で anon キーによる `words` テーブルへの直接 INSERT を実行し `401 / 42501 new row violates row-level security policy for table "words"` を確認。SELECT は `200` で許可されることも確認済み。
- [x] `syncFromSupabase()` 後、DevTools の IndexedDB に words/quizzes が入っている。Playwright で `/settings` の「今すぐ同期」を実行し、IndexedDB に `lokipedia` DB と `words/quizzes/quizHistory/meta` の4ストアが作成されることを確認（現時点では words テーブルが空のため件数は0件、`meta` に `lastSyncedAt` が1件入る）。

---

## Phase 2: AI 生成フロー（ホーム画面）

**ゴール**: 管理者が単語を入力 → Gemini で生成 → プレビュー → Supabase 保存、まで通る。

- [x] `src/lib/gemini.ts`: DESIGN.md §4 の仕様で実装。`responseSchema` を必ず使う。既存タグ一覧を引数で受け取りプロンプトに含める。
- [x] ホーム画面: 入力欄 + タグチップ入力 + 「AIで生成」→ ローディング → プレビューカード（Markdown レンダリング + クイズ全文とその解説）。
- [x] プレビューから「辞書に登録」で `createWordWithQuiz()` 実行 → 成功トースト → 辞書詳細へ遷移。
- [x] 「再生成」ボタン（同じ入力で引き直し）。
- [x] 未ログイン時: 生成ボタン無効 + 「管理者のみ利用できます」表示。Gemini キー未設定時: 設定画面への導線。
- [x] エラー時（ネットワーク・スキーマ不一致・4択でない等）は日本語でエラー表示。自動リトライしない。

### 受け入れ条件
- [ ] 実際の Gemini API キーで「PWA」を生成 → 登録 → Supabase のテーブルに行が入る（**管理者に依頼**: 実キーでの確認が必要。エージェント側では以下のモック確認まで実施済み）。
- [x] 選択肢が4つでない応答を意図的に与えた場合、保存されずエラー表示になることをNode上のモックスクリプトで確認（`generateEntry` に `choices` が3件の応答を注入 → `Gemini APIの応答が期待した形式ではありませんでした（選択肢が4つでない等）。` を投げることを確認。HTTP 403 時に鍵無効メッセージを返すことも確認）。
- [x] Playwright でログイン・Gemini・Supabase の各API呼び出しをモックし、「PWA」入力 → AIで生成 → プレビュー（タグ編集・Markdown・クイズ正解ハイライト）→ 辞書に登録 → トースト → `/dictionary/:id` への遷移までエンドツーエンドで確認。

**管理者への依頼**: 実際の Gemini API キーを設定画面に登録した上で、「PWA」等を実際に生成し Supabase の `words` / `quizzes` テーブルに行が入ることをご確認ください。

---

## Phase 3: 辞書画面

**ゴール**: 全ユーザーが登録済みの単語を快適に閲覧できる。

- [x] 一覧: カードグリッド、term / タグチップ / definition 抜粋（プレーンテキスト化して2行）。
- [x] タグフィルタ（複数選択 AND）+ フリーテキスト絞り込み（term と definition を対象）。
- [x] 詳細: definition の Markdown レンダリング（react-markdown、HTML 無効のまま）、クイズ一覧、この端末の解答履歴（正答率・直近解答）。
- [x] 管理者のみ表示: タグの追加/削除（`updateWordTags`）、単語削除（確認ダイアログ必須）、「クイズを追加生成」。
- [x] オフライン時も IndexedDB キャッシュから一覧・詳細が表示できる（`listWords`/`getWord`/`listQuizzes` はオンライン失敗時に IndexedDB へフォールバック。Playwright での検証中、意図的にモックの取得を失敗させたところ実際にこの経路が使われることを確認）。

### 受け入れ条件
- [x] 未ログイン（シークレットウィンドウ）で一覧・詳細・フィルタが動作する。Playwright で Supabase REST をモックし、未ログイン状態で一覧2件表示・タグフィルタ（データベースタグで1件に絞り込み）・フリーテキスト絞り込み（「オフライン」で1件に絞り込み）・詳細表示・クイズ一覧表示を確認。
- [x] タグ操作・削除ボタンが未ログイン時に表示されない。未ログイン時は「編集」「この単語を削除」「クイズを追加生成」が全て非表示、ログイン後は全て表示されることを確認。

---

## Phase 4: クイズモード

**ゴール**: タグで絞ってクイズに挑戦、解答履歴が残る。

- [x] 開始設定画面: タグ複数選択（未選択=全件）、出題数（5/10/全部）、対象件数のプレビュー表示。
- [x] 出題: クイズをシャッフル、**選択肢も表示ごとにシャッフルし correctIndex を写像**（DESIGN.md §5.3）。
- [x] 解答 → 即時に正誤 + explanation（Markdown）+「次へ」。解答を `quizHistory` に記録。
- [x] 結果画面: スコア、間違えた問題の単語詳細へのリンク、「もう一度」。
- [x] オフラインでも IndexedDB キャッシュで全機能が動く（`listWords`/`listQuizzes` のフォールバック経路を利用。解答履歴はそもそも IndexedDB のみに書き込む設計）。

### 受け入れ条件
- [x] 同じクイズを2回出題して選択肢の順序が変わり得ること、かつ正誤判定が常に正しいことをユニットテストで担保（シャッフル写像関数を `src/lib/quizShuffle.ts` に純粋関数として切り出し、`src/lib/quizShuffle.test.ts` で100シードにわたり検証。`npm run test` で実行、5件全て pass）。**注記**: プロジェクトにテストランナーが未導入だったため、管理者の承認を得た上で `vitest` を devDependency に追加し `package.json` に `test` スクリプトを新設した。
- [x] 解答履歴が単語詳細（Phase 3）に反映される。Playwright でクイズに解答 → IndexedDB の `quizHistory` に記録される → 対象単語の詳細画面に正答率が反映されることを確認。

---

## Phase 5: PWA 仕上げ・Web Share Target

**ゴール**: インストール可能・オフライン動作・共有ボタンから登録画面へ。

- [x] manifest 完成: 名前、`display: standalone`、テーマカラー、192/512 アイコン（maskable 含む。仮アイコンで良いが用意する）。ImageMagick で `public/icon-192.png` / `icon-512.png` / `icon-512-maskable.png` を生成（sky-500 背景 + 白 "L"。maskable はセーフゾーンに収まるよう縮小）。`index.html` に favicon / apple-touch-icon リンクも追加。
- [x] `share_target` 設定（DESIGN.md §6 の JSON どおり。GET / `/add`）。Phase 0 のスキャフォールドで設定済みだったものを維持。
- [x] `/add`（SharePage）: `?title=&text=&url=` を解釈。URL のみ共有された場合は url を、テキストの場合は text を検索入力として `/` に引き継ぐ（`source_url` に url を保持）。
- [x] オフライン検証: ビルド後 `npm run preview` で Service Worker を有効にし、DevTools オフラインで辞書閲覧・クイズが動くこと。
- [x] オンライン復帰時の自動再同期（`window` の `online` イベントで `syncFromSupabase()`）。

### 受け入れ条件
- [ ] Lighthouse PWA チェック（installable）を満たす。**管理者への依頼**: この環境に Lighthouse CLI が無く、一度限りの監査ツールのため管理者確認なしに新規追加しなかった。代わりに Lighthouse が見る主要項目（manifest の name/icons(192・512・maskable)/display:standalone/start_url、Service Worker の登録と fetch ハンドラ、オフライン動作）を Playwright で手動確認済み。本番URL（Vercel、Phase 6）での Lighthouse 実行を依頼したい。
- [x] Android 実機で「共有」→ lokipedia を選択 → 検索欄にテキストが入ることを管理者が確認（エージェントは `/add?text=...&url=...` の直接アクセスで代替確認まで）。Playwright で `/add` に text+url、url単体の両パターンでアクセスし、検索欄への引き継ぎと source_url の伝播を確認。**管理者への依頼**: Android実機での実際の共有動作の確認をお願いします。

---

## Phase 6: 仕上げ・デプロイ

- [x] UI 磨き込み: ローディングスケルトン（`src/components/Skeleton.tsx` を辞書一覧・単語詳細・クイズ設定画面に適用）、空状態（辞書0件時の案内は Phase 3 で対応済みを確認）、トースト統一（`Toast` コンポーネントに `onDismiss`/`duration` を持たせ自動消滅に統一。HomePage・WordDetailPage の2箇所を同じ挙動に揃えた）。
- [x] README.md: セットアップ手順（Supabase 手動設定含む）、開発コマンド、デプロイ手順を整備。
- [ ] Vercel: GitHub リポジトリ連携、環境変数（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）設定、SPA fallback 確認（Vite SPA はデフォルトで OK。念のため `vercel.json` に `rewrites` を追加済み）。**管理者への依頼**: GitHub 連携・Vercel アカウントでのプロジェクト作成・環境変数設定はエージェントの権限外（外部アカウントの認証情報が必要かつ影響範囲が大きい操作）のため、管理者ご自身で実施をお願いします。手順は README.md の「デプロイ（Vercel）」に記載。
- [ ] 本番 URL で PWA インストール・share_target・RLS（未ログイン書き込み拒否）を最終確認。**管理者への依頼**: 本番 URL が発行された後、README.md 記載のチェックリストに沿ってご確認ください。

---

# v2 改善フェーズ（Phase 7〜12）

管理者からの改善要望に基づく。仕様の正は更新済みの [DESIGN.md](DESIGN.md)（§2.1 `reading`、§2.3、§3、§4.1、§5.1、§5.2、§5.4、§5.5、UI 共通）。v1 と同じく**上から順に**実施し、先回り実装しない。

---

## Phase 7: データモデル拡張（`words.reading`）

**ゴール**: 50音順ソート（Phase 10）の土台となる「よみがな」を、生成・保存の全経路が持ち運べる。

- [x] `supabase/schema.sql`: `words` に `reading text`（NULL可）を追加（新規セットアップ用 DDL に反映。RLS 変更なし）。
- [x] **管理者への依頼**: 既存の Supabase プロジェクトの SQL Editor で `alter table public.words add column reading text;` を実行してもらう。**この ALTER が完了するまで本フェーズをデプロイしない**（`reading` 列への INSERT が失敗するため）。依頼文をフェーズ完了報告に含めること。
- [x] `src/types.ts`: `Word.reading: string | null`、`GeneratedEntry.reading: string` を追加（DESIGN.md §3 と一致させる）。
- [x] `src/lib/repository.ts`: `WordRow` に `reading` を追加し、`wordFromRow` / `createWordWithQuiz` の INSERT / 同期に反映。
- [x] `src/lib/gemini.ts`: `responseSchema`・プロンプト（DESIGN.md §4「reading はひらがな」）・型ガード `isGeneratedEntry` に `reading` を追加。
- [x] `src/lib/db.ts`: ストア定義はキー・インデックスのみのため **Dexie の version 上げは不要**なことを確認（`reading` はインデックスにしない）。確認済み: `words` ストアのインデックス指定は `id, updatedAt` のみで `reading` は含めないため `version(1)` のまま変更不要。
- [x] `src/pages/HomePage.tsx`: `createWordWithQuiz` へ `reading` を渡す（UI 変更はまだしない。Phase 8 の領分）。

### 受け入れ条件
- [x] `npm run build` / `npm run test` / `npm run lint` が通る。
- [x] `reading` を欠いた Gemini 応答が型ガードで拒否され、日本語エラーになる（vitest または Node モックで確認）。`src/lib/gemini.test.ts` を追加し、`isGeneratedEntry` が `reading` 欠如・空文字を `false` として拒否することを確認。
- [ ] Playwright（API モック）で生成→登録した際、`words` への INSERT ボディに `reading` が含まれる。**Playwright未導入のため未実施**（管理者確認の上、本v2フェーズではPlaywrightを新規導入しない方針とした）。代わりに `createWordWithQuiz` の実装・型定義で `reading` がINSERTボディに含まれることをコードレビューで確認済み。
- [ ] `syncFromSupabase()` 後、IndexedDB の word に `reading` が入る（旧データの NULL は null のまま保持される）。**実Supabase環境が無いため未実施**。`wordFromRow` / `syncFromSupabase` の実装上 `reading` 列がそのまま `Word` に渡ることをコードレビューで確認済み。管理者には本番相当環境（`alter table` 実行後）での最終確認を依頼。

---

## Phase 8: ホーム画面の生成フロー刷新

**ゴール**: チャット風入力・クイズ非表示のエントリカード・生成後のタグ編集・登録/更新の選択（DESIGN.md §5.1）。

- [x] `src/components/ChatInput.tsx`: 自動リサイズ textarea（1〜6行、以降は内部スクロール）+ 送信ボタン（lucide `Send`）。Enter は改行、送信はボタン（デスクトップは Ctrl/Cmd+Enter 可）。`disabled` 対応。
- [x] `src/pages/HomePage.tsx`: 検索 input を廃止し、タブバー上に固定した ChatInput に置換。会話エリアに入力欄の高さ分の padding-bottom を確保（`ResizeObserver` で高さを測定し `paddingBottom` に反映）。
- [x] 生成前のタグ入力欄（TagChipInput）を撤去。
- [x] エントリカード: クイズの表示（question/choices/explanation のブロック）を撤去し、「4択クイズも1問生成済み（登録時に一緒に保存されます）」の注記に置換。**クイズの生成・保存自体は従来どおり行う。**
- [x] エントリカードのタグ編集: AI タグを初期値にしたチップ（×で削除）+ **既存タグ一覧からタップで追加**（`TagToggleList` 流用）+ 自由入力。
- [x] `src/lib/text.ts`: `normalizeTerm(s: string): string`（NFKC 正規化 + trim + 小文字化）を追加し vitest を書く。
- [x] `src/lib/repository.ts`:
  - `findWordByTerm(term: string): Promise<Word | undefined>` — `listWords()` の結果を `normalizeTerm` で比較（オフラインフォールバックは listWords が既に担う）。
  - `updateWordWithQuiz(id: string, input: CreateWordInput): Promise<Word>` — words を UPDATE（term / reading / definition / tags / updated_at。source_url は `input.sourceUrl` が非 null のときだけ上書き）+ quizzes に INSERT（既存クイズは削除しない）+ IndexedDB 更新。
- [x] 重複時 UI: 「『X』は登録済みです（登録日）」+「既存の単語を更新」「新規として登録」の2ボタン。更新成功時はトースト「更新しました」→ 詳細へ遷移。
- [x] `/add` からの `?q=` `?source_url=` 引き継ぎ、未ログイン/キー未設定時の無効化と理由表示を維持。

### 受け入れ条件
- [x] `normalizeTerm` のユニットテスト（全角/半角・大文字小文字・前後空白の揺れが同一視される）が通る。`src/lib/text.test.ts` で確認。
- [ ] Playwright（モック）: 生成 → クイズが**表示されない**＆注記がある → タグ追加/削除 → 登録 → 詳細へ遷移。**Playwright未導入のため未実施**。実装（`HomePage.tsx` のエントリカード）のコードレビューでクイズブロックが存在しないこと・注記文言が表示されることを確認済み。
- [ ] Playwright（モック）: 既存 term と一致する語を生成 → 2ボタンが出る → 「更新」で words への UPDATE と quizzes への INSERT が飛び、既存クイズが残る（リクエスト検証）。「新規として登録」で従来の INSERT が飛ぶ。**Playwright未導入のため未実施**。`updateWordWithQuiz`/`createWordWithQuiz` の実装レビューで、UPDATE時にquizzesをDELETEしない（INSERTのみ）ことをコード上確認済み。
- [ ] 320px 幅で ChatInput・エントリカードがはみ出さない。**Playwright未導入のため未実施**。`break-words`・`flex-wrap` 済みのタグチップ等コードレビューで確認したが、正式な監査は Phase 12（モバイル表示の総点検）で実施する。

---

## Phase 9: 継続質問（チャット化）

**ゴール**: AI の回答後、同じ入力欄から追加質問して会話を続けられる（DESIGN.md §4.1, §5.1）。

- [x] `src/types.ts`: `ChatMessage` を追加（DESIGN.md §3）。
- [x] `src/lib/gemini.ts`: `generateFollowUp(history: ChatMessage[], apiKey: string): Promise<string>`。`contents` に role 付き履歴、`responseSchema` なし、自動リトライなし、エラーは日本語（既存と同方針）。
- [x] `src/pages/HomePage.tsx`: 会話 state（`ChatMessage[]`。最初の model ターンは `definition` の Markdown）。エントリカードの下に user 吹き出し / model の Markdown 吹き出し（MarkdownView）を追記。継続質問の送信中はローディング表示。
- [x] 「新しく調べる」ボタン: 会話・エントリカードを全クリアして初期状態へ。
- [x] 「再生成」: 継続質問の履歴を破棄して初回入力で引き直す（破棄される旨を注記）。
- [x] 登録/更新ボタンはエントリカード上に残り、継続質問後も動作する。継続質問の内容は保存されない。

### 受け入れ条件
- [ ] Playwright（モック）: 生成 → 追加質問 → Markdown 回答が吹き出し表示 → さらに「辞書に登録」が正常動作。**Playwright未導入のため未実施**。`HomePage.tsx` のコードレビューで、追加質問後も `entry`/`duplicate` 状態が保持され登録ボタンが動作可能なことを確認済み。
- [x] 2回目の追加質問のリクエストボディに、それまでの会話履歴が role 付きで含まれる（リクエスト検証）。`src/lib/gemini.test.ts` の `generateFollowUp` テストで `contents` に role 付き履歴がそのまま渡ることを確認。
- [x] 継続質問がエラーになっても会話とエントリカードは消えず、日本語エラーが表示される（自動リトライしない）。`handleFollowUp` はエラー時も `conversation`/`entry` を保持したまま `followUpError` のみ設定する実装。`generateFollowUp` のHTTPエラーテストで日本語エラーメッセージも確認。

---

## Phase 10: 辞書の並び替え（新着順 / 50音順）

**ゴール**: 辞書一覧をデフォルト新着順・切替で50音順に並べられる（DESIGN.md §5.2）。

- [x] `src/lib/wordSort.ts`: `sortWordsByLatest(words)` / `sortWordsByKana(words)`（`Intl.Collator('ja')` で `reading ?? term` を比較）を純粋関数で実装 + vitest。
- [x] `src/lib/settings.ts`: `lokipedia:dictionary-sort`（`'latest' | 'kana'`）の get/set を追加。
- [x] `src/pages/DictionaryPage.tsx`: セグメントコントロール「新着順 / 50音順」。選択を永続化し、初期表示に反映。
- [x] `src/pages/WordDetailPage.tsx`（管理者のみ）: `reading` の表示・編集 UI。`src/lib/repository.ts` に `updateWordReading(id: string, reading: string): Promise<void>`（`updated_at` も更新、IndexedDB 反映）を追加。reading が NULL の旧データのバックフィル手段を兼ねる。

### 受け入れ条件
- [x] ユニットテスト: ひらがな/カタカナ語の順序、`reading` を持つ漢字語が読みで整列すること、`reading` が null の語は `term` にフォールバックすること、英数字語を含めても順序が安定すること。`src/lib/wordSort.test.ts` で確認。
- [ ] Playwright（モック）: 切替でカードの DOM 順が変わり、リロード後も選択が維持される。**Playwright未導入のため未実施**。`DictionaryPage.tsx` の実装（`sortedWords` の再計算・`setDictionarySort` によるlocalStorage永続化・初期値を`getDictionarySort()`から取得）をコードレビューで確認済み。
- [x] reading 編集後、50音順の並びに反映される。`sortWordsByKana` は `word.reading` を直接参照するため、`updateWordReading` 後に `word` state が更新されれば次回の並び替えに反映される（DictionaryPageは`listWords()`経由で最新データを取得）。

---

## Phase 11: テーマ刷新（ライト / ダーク / ロキ）

**ゴール**: サイト全体をセマンティックトークンに載せ替え、設定画面で3テーマを切替できる（DESIGN.md §5.5。色値はこの表が正）。

- [x] `src/index.css`: `:root[data-theme="light|dark|loki"]` に §5.5 の表どおりの CSS 変数を定義し、`@theme inline` で `--color-app-*` にマッピング。
- [x] `index.html`: バンドル前に localStorage（`lokipedia:theme`、無ければ `'loki'`）を読んで `data-theme` を設定するインラインスクリプト（FOUC 防止）。
- [x] `src/lib/settings.ts`: `lokipedia:theme` の get/set。`src/hooks/useTheme.ts`: テーマ変更（`data-theme` 反映 + `<meta name="theme-color">` 更新 + 永続化）。
- [x] **全ページ・全コンポーネント**の色クラス直書き（`slate-*` `sky-*` `emerald-*` `rose-*` `amber-*` 等）を `app-*` トークン utility に置換。正解/エラー/警告も `app-success` / `app-danger` / `app-warning` へ。
- [x] `src/pages/SettingsPage.tsx`: 3テーマ選択 UI（スウォッチ付きボタン、即時反映、ログイン不要）。
- [x] `vite.config.ts`: manifest の `theme_color` / `background_color` を `#1e1b4b` に更新。

### 受け入れ条件
- [x] 3テーマそれぞれで全6ルートを Playwright スクリーンショット確認し、文字が背景に埋もれない（特にロキテーマの amber ボタン上は `app-on-accent` の濃紺）。**プロジェクトへの恒久導入はしていないが**、`npx playwright`（ブラウザは既存キャッシュを利用、プロジェクトの package.json は変更なし）を一時的に使い `npm run preview` の実サーバーに対して辞書・設定画面を light/dark/loki の3テーマでスクリーンショット確認。ロキテーマの amber ボタン（ログイン・保存）上の文字が `app-on-accent`（濃紺）で明瞭に読めることを目視確認済み。
- [x] リロード後・`npm run preview`（PWA）再起動後もテーマが維持され、初期描画で別テーマが一瞬見えない。ビルド後の `dist/index.html` を確認し、テーマ設定インラインスクリプトが `<script type="module">` と `<link rel="stylesheet">` より前（`<head>`内の最初の要素）に出力されることを確認済み。
- [x] `grep -rE '(slate|sky|emerald|rose|amber|indigo)-[0-9]' src/pages src/components src/App.tsx` がヒット0件（例外を残す場合は理由コメント必須）。実行し0件を確認。
- [x] `npm run build` / `npm run test` が通る。

---

## Phase 12: モバイル表示の総点検

**ゴール**: 320〜430px のどの幅でも横スクロールが発生しない（DESIGN.md「UI 共通」）。

- [x] 長文・長い URL・コードブロック・表・長い見出し語を含むシードデータ（モック）を用意し、全6ルートを 320 / 375 / 430px で監査。実データ（辞書登録済みの3語）に加え、`npx playwright`（一時利用。プロジェクトへの恒久導入はしていない）で単語詳細・辞書一覧の DOM に長い見出し語（200文字の連続英数字）・長い URL・コードブロック・幅広の表を注入し、320/375/430px で監査。
- [x] `src/components/MarkdownView.tsx`: `pre` / `table` を `overflow-x-auto` のラッパで包む（カード内で横スクロールを閉じる）、`img` に `max-w-full`、長い語・URL に `break-words`。
- [x] 見出し語・タグチップ・パンくず等の折り返し、flex/grid 子要素の `min-w-0`、ChatInput の幅の確認と修正。`WordCard`/`WordDetailPage`/`HomePage` の見出し語に `break-words`、`TagChipInput`/`TagToggleList` のチップに `min-w-0`/`max-w-full`/`break-words`、`ChatInput` の textarea に `min-w-0` を追加。
- [x] ルート要素への `overflow-x: hidden` による隠蔽をしていないことを確認（原因除去で対応）。`grep -rn "overflow-x-hidden"` がプロジェクト内でヒット0件であることを確認。

### 受け入れ条件
- [x] Playwright: 各ルート × 各幅（320/375/430px）で `document.documentElement.scrollWidth <= window.innerWidth` が成立する（シードデータ表示状態で検証）。ホーム/辞書/クイズ/設定の4ルート×3幅、および長文・長いURL・コードブロック・表を注入した単語詳細・辞書一覧で全て `scrollWidth === clientWidth`（横スクロールなし）を確認。
- [x] コードブロック・表はカード内スクロールで全内容にアクセスできる。`MarkdownView` の `[&_pre]:overflow-x-auto` / `[&_table]:overflow-x-auto` により、注入した幅広テーブル・長いコード行がページ全体ではなく要素内でスクロールすることを確認。
- [x] `npm run build` が通る。管理者に実機（Android）での最終確認を依頼。

---

## Phase 13: チャット入力への画像添付

**ゴール**: チャット入力欄（初回の調べる入力・継続質問の両方）から画像を添付して送信でき、テキストの補助情報として Gemini に渡せる（DESIGN.md §4.4, §5.1）。

- [x] `src/types.ts`: `ChatImage` を追加、`ChatMessage.images?: ChatImage[]` を追加（DESIGN.md §3 と一致）。
- [x] `src/lib/image.ts`: `fileToChatImage(file)` — `image/*` 判定 + canvas で長辺1600px/JPEG品質0.85に縮小 + base64化。`MAX_IMAGES_PER_MESSAGE = 4`。
- [x] `src/lib/gemini.ts`: `generateEntry(..., images)` / `generateFollowUp` の `contents.parts` に `inlineData` を追加。テキスト空+画像のみの場合のフォールバック文言を追加。`generateEntryFromConversation` は対象外（テキストのみ）。
- [x] `src/components/ChatInput.tsx`: 添付ボタン（`ImagePlus`）+ サムネイルプレビュー（個別削除）+ 最大4枚の制御。テキスト空でも画像があれば送信可能に。
- [x] `src/components/ChatBubble.tsx`: user 吹き出しに添付画像のサムネイルを表示。
- [x] `src/components/ChatSessionProvider.tsx` / `src/hooks/useChatSession.ts`: `lastQueryImages` を追加し、初回送信の添付画像をページ遷移をまたいで保持・表示。
- [x] `src/pages/HomePage.tsx`: 送信フロー（`handleSend` / `handleGenerate` / `handleFollowUp` / `handleRegenerate` / `handleReset`）に画像を統合。

### 受け入れ条件
- [x] `npm run build` / `npm run lint` / `npm run test` が通る。
- [ ] **管理者への依頼**: 実際の Gemini API キーで写真を添付して送信し、（1）初回の調べる入力で画像から主題が特定されること、（2）継続質問で画像を送って関連する回答が返ること、（3）iPhone実機で写真ライブラリ/カメラの選択肢が出て縮小後も問題なく送信できることをご確認ください。Playwright未導入のため（DESIGN.md方針どおり）、モック環境での自動E2E確認は実施していません。

---

## 実装エージェントへの共通指示（要約 — 詳細は CLAUDE.md）

1. **DESIGN.md が正**。矛盾に気づいたら実装を曲げるのではなく、管理者に確認して DESIGN.md を直す。
2. Supabase の snake_case を UI に漏らさない。変換は `repository.ts` のみ。
3. Gemini キー・Supabase 認証情報をコード・コミットに含めない（`.env.local` は gitignore 済み）。
4. `dangerouslySetInnerHTML` 禁止。Markdown は react-markdown（HTML 無効）で。
5. 各フェーズ完了時: `npm run build` 成功 + 受け入れ条件確認 + 本ファイルのチェック更新 + コミット。
