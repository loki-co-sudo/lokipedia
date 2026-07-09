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
- [x] 設定画面から管理者ログイン/ログアウトができ、リロード後もセッションが維持される（supabase-js の Auth セッションは localStorage 永続化がデフォルトのため実装済み。実credentials での動作確認は下記メモの通り管理者に依頼）。
- [x] 未ログインのブラウザから Supabase への INSERT が RLS で拒否されることを確認。`curl` で anon キーによる `words` テーブルへの直接 INSERT を実行し `401 / 42501 new row violates row-level security policy for table "words"` を確認。SELECT は `200` で許可されることも確認済み。
- [x] `syncFromSupabase()` 後、DevTools の IndexedDB に words/quizzes が入っている。Playwright で `/settings` の「今すぐ同期」を実行し、IndexedDB に `lokipedia` DB と `words/quizzes/quizHistory/meta` の4ストアが作成されることを確認（現時点では words テーブルが空のため件数は0件、`meta` に `lastSyncedAt` が1件入る）。

**管理者への依頼**: 実際の管理者アカウント（メール+パスワード）でのログイン成功、リロード後のセッション維持は実credentials がないと確認できません。設定画面からログイン → リロードしてログイン状態が保たれるかご確認ください。

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

- [ ] 開始設定画面: タグ複数選択（未選択=全件）、出題数（5/10/全部）、対象件数のプレビュー表示。
- [ ] 出題: クイズをシャッフル、**選択肢も表示ごとにシャッフルし correctIndex を写像**（DESIGN.md §5.3）。
- [ ] 解答 → 即時に正誤 + explanation（Markdown）+「次へ」。解答を `quizHistory` に記録。
- [ ] 結果画面: スコア、間違えた問題の単語詳細へのリンク、「もう一度」。
- [ ] オフラインでも IndexedDB キャッシュで全機能が動く。

### 受け入れ条件
- 同じクイズを2回出題して選択肢の順序が変わり得ること、かつ正誤判定が常に正しいことをユニットテストで担保（シャッフル写像関数を純粋関数に切り出してテスト）。
- 解答履歴が単語詳細（Phase 3）に反映される。

---

## Phase 5: PWA 仕上げ・Web Share Target

**ゴール**: インストール可能・オフライン動作・共有ボタンから登録画面へ。

- [ ] manifest 完成: 名前、`display: standalone`、テーマカラー、192/512 アイコン（maskable 含む。仮アイコンで良いが用意する）。
- [ ] `share_target` 設定（DESIGN.md §6 の JSON どおり。GET / `/add`）。
- [ ] `/add`（SharePage）: `?title=&text=&url=` を解釈。URL のみ共有された場合は url を、テキストの場合は text を検索入力として `/` に引き継ぐ（`source_url` に url を保持）。
- [ ] オフライン検証: ビルド後 `npm run preview` で Service Worker を有効にし、DevTools オフラインで辞書閲覧・クイズが動くこと。
- [ ] オンライン復帰時の自動再同期（`window` の `online` イベントで `syncFromSupabase()`）。

### 受け入れ条件
- Lighthouse PWA チェック（installable）を満たす。
- Android 実機で「共有」→ lokipedia を選択 → 検索欄にテキストが入ることを管理者が確認（エージェントは `/add?text=...` の直接アクセスで代替確認まで）。

---

## Phase 6: 仕上げ・デプロイ

- [ ] UI 磨き込み: ローディングスケルトン、空状態（辞書0件時の案内）、トースト統一。
- [ ] README.md: セットアップ手順（Supabase 手動設定含む）、開発コマンド、デプロイ手順。
- [ ] Vercel: GitHub リポジトリ連携、環境変数（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）設定、SPA fallback 確認（Vite SPA はデフォルトで OK、`vercel.json` の rewrite が必要なら追加）。
- [ ] 本番 URL で PWA インストール・share_target・RLS（未ログイン書き込み拒否）を最終確認。

---

## 実装エージェントへの共通指示（要約 — 詳細は CLAUDE.md）

1. **DESIGN.md が正**。矛盾に気づいたら実装を曲げるのではなく、管理者に確認して DESIGN.md を直す。
2. Supabase の snake_case を UI に漏らさない。変換は `repository.ts` のみ。
3. Gemini キー・Supabase 認証情報をコード・コミットに含めない（`.env.local` は gitignore 済み）。
4. `dangerouslySetInnerHTML` 禁止。Markdown は react-markdown（HTML 無効）で。
5. 各フェーズ完了時: `npm run build` 成功 + 受け入れ条件確認 + 本ファイルのチェック更新 + コミット。
