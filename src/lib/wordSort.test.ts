import { describe, expect, it } from 'vitest'
import { sortWordsByKana, sortWordsByLatest } from './wordSort'
import type { Word } from '../types'

function makeWord(partial: Partial<Word> & Pick<Word, 'id' | 'term'>): Word {
  return {
    reading: null,
    definition: '',
    tags: [],
    sourceUrl: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('sortWordsByLatest', () => {
  it('createdAt の降順（新しい順）に並べる', () => {
    const words = [
      makeWord({ id: '1', term: 'A', createdAt: '2024-01-01T00:00:00.000Z' }),
      makeWord({ id: '2', term: 'B', createdAt: '2024-03-01T00:00:00.000Z' }),
      makeWord({ id: '3', term: 'C', createdAt: '2024-02-01T00:00:00.000Z' }),
    ]
    expect(sortWordsByLatest(words).map((w) => w.id)).toEqual(['2', '3', '1'])
  })

  it('引数の配列を破壊しない', () => {
    const words = [makeWord({ id: '1', term: 'A' }), makeWord({ id: '2', term: 'B' })]
    const original = [...words]
    sortWordsByLatest(words)
    expect(words).toEqual(original)
  })
})

describe('sortWordsByKana', () => {
  it('ひらがな・カタカナ語を50音順に並べる', () => {
    const words = [
      makeWord({ id: '1', term: 'わ', reading: 'わ' }),
      makeWord({ id: '2', term: 'あ', reading: 'あ' }),
      makeWord({ id: '3', term: 'か', reading: 'か' }),
    ]
    expect(sortWordsByKana(words).map((w) => w.id)).toEqual(['2', '3', '1'])
  })

  it('reading を持つ漢字語は読みで整列する', () => {
    const words = [
      makeWord({ id: '1', term: '冪等性', reading: 'べきとうせい' }),
      makeWord({ id: '2', term: '安定性', reading: 'あんていせい' }),
    ]
    expect(sortWordsByKana(words).map((w) => w.id)).toEqual(['2', '1'])
  })

  it('reading が null の語は term にフォールバックする', () => {
    const words = [
      makeWord({ id: '1', term: 'われ', reading: null }),
      makeWord({ id: '2', term: 'あれ', reading: null }),
    ]
    expect(sortWordsByKana(words).map((w) => w.id)).toEqual(['2', '1'])
  })

  it('英数字語を含めても順序が安定する', () => {
    const words = [
      makeWord({ id: '1', term: 'PWA', reading: 'ぴーだぶりゅーえー' }),
      makeWord({ id: '2', term: 'あ', reading: 'あ' }),
    ]
    const result = sortWordsByKana(words)
    expect(result).toHaveLength(2)
    expect(new Set(result.map((w) => w.id))).toEqual(new Set(['1', '2']))
  })
})
