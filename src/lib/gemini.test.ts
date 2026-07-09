import { describe, expect, it } from 'vitest'
import { isGeneratedEntry } from './gemini'

function validEntry() {
  return {
    term: 'PWA',
    reading: 'ぴーだぶりゅーえー',
    definition: '## 概要\nPWAとは...',
    tags: ['ウェブ', '技術', 'モバイル'],
    quiz: {
      question: 'PWAとは何の略か？',
      choices: ['Progressive Web App', 'Public Web API', 'Personal Web Area', 'Private Web Access'],
      correctIndex: 0,
      explanation: '正解はProgressive Web Appです。',
    },
  }
}

describe('isGeneratedEntry', () => {
  it('全フィールドが揃っていれば true を返す', () => {
    expect(isGeneratedEntry(validEntry())).toBe(true)
  })

  it('reading を欠いた応答は false を返す（型ガードで拒否される）', () => {
    const entry = validEntry() as Record<string, unknown>
    delete entry.reading
    expect(isGeneratedEntry(entry)).toBe(false)
  })

  it('reading が空文字の応答は false を返す', () => {
    const entry = validEntry()
    expect(isGeneratedEntry({ ...entry, reading: '' })).toBe(false)
  })

  it('choices が4つでない応答は false を返す', () => {
    const entry = validEntry()
    entry.quiz.choices = entry.quiz.choices.slice(0, 3) as unknown as typeof entry.quiz.choices
    expect(isGeneratedEntry(entry)).toBe(false)
  })
})
