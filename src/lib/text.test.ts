import { describe, expect, it } from 'vitest'
import { normalizeTerm } from './text'

describe('normalizeTerm', () => {
  it('前後の空白を除去する', () => {
    expect(normalizeTerm('  PWA  ')).toBe('pwa')
  })

  it('大文字小文字を同一視する', () => {
    expect(normalizeTerm('PWA')).toBe(normalizeTerm('pwa'))
  })

  it('全角英数字と半角英数字を同一視する（NFKC正規化）', () => {
    expect(normalizeTerm('ＰＷＡ')).toBe(normalizeTerm('PWA'))
  })

  it('全角スペースと半角スペースを含む表記揺れでも同一視する', () => {
    expect(normalizeTerm('冪等性　')).toBe(normalizeTerm('冪等性'))
  })
})
