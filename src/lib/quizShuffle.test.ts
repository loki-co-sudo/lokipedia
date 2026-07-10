import { describe, expect, it } from 'vitest'
import { shuffleArray, shuffleQuizChoices, stripChoiceLabel } from './quizShuffle'

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

describe('stripChoiceLabel', () => {
  it('英字ラベルを除去する', () => {
    expect(stripChoiceLabel('A. 公開鍵で暗号化する')).toBe('公開鍵で暗号化する')
    expect(stripChoiceLabel('B．共通鍵を共有する')).toBe('共通鍵を共有する')
    expect(stripChoiceLabel('C) ハッシュ化する')).toBe('ハッシュ化する')
    expect(stripChoiceLabel('(D) 署名する')).toBe('署名する')
    expect(stripChoiceLabel('ｄ: 全角小文字')).toBe('全角小文字')
  })

  it('数字ラベル（1〜4・丸数字）を除去する', () => {
    expect(stripChoiceLabel('1. 選択肢の内容')).toBe('選択肢の内容')
    expect(stripChoiceLabel('４．全角数字')).toBe('全角数字')
    expect(stripChoiceLabel('① 丸数字')).toBe('丸数字')
    expect(stripChoiceLabel('(2) 括弧数字')).toBe('括弧数字')
  })

  it('カタカナラベル（ア〜エ）を除去する', () => {
    expect(stripChoiceLabel('ア. 選択肢')).toBe('選択肢')
    expect(stripChoiceLabel('イ、選択肢')).toBe('選択肢')
    expect(stripChoiceLabel('（ウ）選択肢')).toBe('選択肢')
  })

  it('区切り記号のない本文はラベルとみなさず除去しない', () => {
    expect(stripChoiceLabel('C言語')).toBe('C言語')
    expect(stripChoiceLabel('1080p')).toBe('1080p')
    expect(stripChoiceLabel('Aレコード')).toBe('Aレコード')
    expect(stripChoiceLabel('アルゴリズム')).toBe('アルゴリズム')
  })

  it('除去すると空になる場合は元のテキストを返す', () => {
    expect(stripChoiceLabel('A.')).toBe('A.')
    expect(stripChoiceLabel('①')).toBe('①')
  })

  it('ラベルのない選択肢はそのまま（前後の空白のみ除去）', () => {
    expect(stripChoiceLabel(' 公開鍵で暗号化する ')).toBe('公開鍵で暗号化する')
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
