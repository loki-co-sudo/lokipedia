import { describe, expect, it } from 'vitest'
import { ANSWER_MODE_INSTRUCTIONS, ANSWER_MODE_LABELS, ANSWER_MODES, isAnswerMode } from './answerMode'

describe('isAnswerMode', () => {
  it('定義済みの5モードすべてを受け入れる', () => {
    for (const mode of ANSWER_MODES) {
      expect(isAnswerMode(mode)).toBe(true)
    }
  })

  it('未知の文字列や非文字列は拒否する', () => {
    expect(isAnswerMode('polite')).toBe(false)
    expect(isAnswerMode('')).toBe(false)
    expect(isAnswerMode(null)).toBe(false)
    expect(isAnswerMode(0)).toBe(false)
  })
})

describe('モード定義の整合性', () => {
  it('全モードにラベルと文体指示が定義されている', () => {
    for (const mode of ANSWER_MODES) {
      expect(ANSWER_MODE_LABELS[mode].trim()).not.toBe('')
      expect(ANSWER_MODE_INSTRUCTIONS[mode].trim()).not.toBe('')
    }
  })
})
