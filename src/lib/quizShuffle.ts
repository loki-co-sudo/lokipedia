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

/** クイズの選択肢をシャッフルし、正解の choices 内での新しい添字を返す。 */
export function shuffleQuizChoices(
  quiz: Pick<Quiz, 'choices' | 'correctIndex'>,
  rng: () => number = Math.random,
): ShuffledChoices {
  const order = shuffleArray([0, 1, 2, 3] as const, rng)
  const choices = order.map((i) => quiz.choices[i])
  const correctIndex = order.indexOf(quiz.correctIndex) as ChoiceIndex
  return { choices, correctIndex }
}
