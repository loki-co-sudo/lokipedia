// クイズ出題時の選択肢シャッフルと正解添字の写像。docs/DESIGN.md §5.3。
// 純粋関数として切り出し、ユニットテスト（quizShuffle.test.ts）で正誤判定の正しさを担保する。

import type { ChoiceIndex, Quiz } from '../types'

export interface ShuffledChoices {
  choices: string[]
  correctIndex: ChoiceIndex
}

/** Fisher-Yates シャッフル。rng は [0, 1) を返す関数（テスト時に差し替え可能）。元の配列は変更しない。 */
export function shuffleArray<T>(array: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// 旧データの選択肢に付いたラベル接頭辞（「A.」「1）」「(ア)」「①」等）にマッチするパターン。
// 誤除去を防ぐため、ラベル1文字の後に区切り記号（. ． : ： 、 ) ））か閉じ括弧を必須とする
// （「C言語」「1080p」「Aレコード」のような本文は除去しない）。丸数字①〜④のみ単独で除去可。
const CHOICE_LABEL_PATTERN =
  /^(?:[(（][A-DＡ-Ｄa-dａ-ｄ1-4１-４アイウエ][)）]|[A-DＡ-Ｄa-dａ-ｄ1-4１-４アイウエ][.．:：、)）]|[①②③④])\s*/

/**
 * 選択肢先頭のラベル接頭辞を除去する（表示は 1〜4 の番号に統一するため）。
 * 新規生成分はプロンプトでラベル禁止だが、既存データ対策として表示時にも適用する。
 */
export function stripChoiceLabel(choice: string): string {
  const trimmed = choice.trim()
  const stripped = trimmed.replace(CHOICE_LABEL_PATTERN, '')
  // 除去した結果が空になる場合はラベルではなく本文だったとみなし、元のテキストを返す
  return stripped === '' ? trimmed : stripped
}

/** クイズの選択肢をシャッフルし、正解の choices 内での新しい添字を返す。選択肢のラベル接頭辞も除去する。 */
export function shuffleQuizChoices(
  quiz: Pick<Quiz, 'choices' | 'correctIndex'>,
  rng: () => number = Math.random,
): ShuffledChoices {
  const order = shuffleArray([0, 1, 2, 3] as const, rng)
  const choices = order.map((i) => stripChoiceLabel(quiz.choices[i]))
  const correctIndex = order.indexOf(quiz.correctIndex) as ChoiceIndex
  return { choices, correctIndex }
}
