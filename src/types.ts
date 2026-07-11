// 共有型定義。docs/DESIGN.md §3 が仕様の正 — 変更時は必ず両方を更新すること。
// DB (Postgres) は snake_case、アプリ内は camelCase。変換は src/lib/repository.ts に閉じ込める。

export interface Word {
  id: string
  term: string
  /** よみがな（ひらがな）。50音順ソート用。旧データは null */
  reading: string | null
  /** Markdown */
  definition: string
  tags: string[]
  sourceUrl: string | null
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
}

export type ChoiceIndex = 0 | 1 | 2 | 3

export interface Quiz {
  id: string
  wordId: string
  question: string
  choices: [string, string, string, string]
  correctIndex: ChoiceIndex
  /** Markdown */
  explanation: string
  createdAt: string
}

export interface QuizHistoryEntry {
  /** Dexie auto-increment */
  id?: number
  quizId: string
  wordId: string
  selectedIndex: number
  isCorrect: boolean
  answeredAt: string
}

/** Gemini からの生成結果（Supabase 保存前のプレビューに使う） */
export interface GeneratedEntry {
  term: string
  /** よみがな（ひらがな） */
  reading: string
  definition: string
  /** ちょうど3つ */
  tags: string[]
  quiz: {
    question: string
    choices: [string, string, string, string]
    correctIndex: ChoiceIndex
    explanation: string
  }
}

/** チャット入力に添付する画像（docs/DESIGN.md §4.4 / §5.1）。メモリ上のみで永続化しない */
export interface ChatImage {
  mimeType: string
  /** base64エンコード（data: プレフィックスなし） */
  data: string
}

/** 継続質問（docs/DESIGN.md §4.1 / §5.1）の会話履歴。メモリ上のみで永続化しない */
export interface ChatMessage {
  role: 'user' | 'model'
  /** Markdown */
  text: string
  /** ユーザーメッセージへの添付画像（docs/DESIGN.md §4.4）。model には付かない */
  images?: ChatImage[]
}
