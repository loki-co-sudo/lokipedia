import { describe, expect, it } from 'vitest'
import { shuffleArray, shuffleQuizChoices } from './quizShuffle'

// 決定的な疑似乱数（シードごとに再現可能な結果を得るため Math.random を使わない）
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('shuffleArray', () => {
  it('元の配列と同じ要素の並び替えを返す', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleArray(input, mulberry32(1))
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
  })

  it('引数の配列を破壊しない', () => {
    const input = [1, 2, 3]
    shuffleArray(input, mulberry32(2))
    expect(input).toEqual([1, 2, 3])
  })
})

describe('shuffleQuizChoices', () => {
  const baseQuiz = {
    choices: ['A', 'B', 'C', 'D'] as [string, string, string, string],
    correctIndex: 2 as const, // 'C' が正解
  }

  it('どのシャッフル結果でも choices[correctIndex] が元の正解と一致する', () => {
    for (let seed = 0; seed < 100; seed++) {
      const { choices, correctIndex } = shuffleQuizChoices(baseQuiz, mulberry32(seed))
      expect(choices).toHaveLength(4)
      expect(choices[correctIndex]).toBe('C')
      expect([...choices].sort()).toEqual([...baseQuiz.choices].sort())
    }
  })

  it('同じクイズでもシャッフルのたびに選択肢の順序が変わり得る', () => {
    const orders = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      const { choices } = shuffleQuizChoices(baseQuiz, mulberry32(seed))
      orders.add(choices.join('|'))
    }
    expect(orders.size).toBeGreaterThan(1)
  })

  it('correctIndex が 0 の場合でも正しく写像される', () => {
    const quiz = { choices: ['正解', 'X', 'Y', 'Z'] as [string, string, string, string], correctIndex: 0 as const }
    for (let seed = 0; seed < 20; seed++) {
      const { choices, correctIndex } = shuffleQuizChoices(quiz, mulberry32(seed))
      expect(choices[correctIndex]).toBe('正解')
    }
  })
})
