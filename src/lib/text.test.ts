import { describe, expect, it } from 'vitest'
import { normalizeTerm, repairMarkdown } from './text'

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

describe('repairMarkdown', () => {
  it('直前の文に連結された見出し(##)の前に空行を補う', () => {
    const input = '概要の説明です。## 主な特徴- 項目1です。- 項目2です。'
    const result = repairMarkdown(input)
    expect(result).toBe('概要の説明です。\n\n## 主な特徴\n- 項目1です。\n- 項目2です。')
  })

  it('実際にGeminiが生成した改行なしのdefinitionを見出し・箇条書きに復元する（実データ由来）', () => {
    const input =
      '前置きの文です。## WSLの主な特徴- **Linux環境の統合**: 説明1です。- **仮想マシンの不要**: 説明2です。'
    const result = repairMarkdown(input)
    expect(result).toContain('\n\n## WSLの主な特徴\n')
    expect(result).toContain('\n- **Linux環境の統合**: 説明1です。\n- **仮想マシンの不要**: 説明2です。')
  })

  it('すでに正しく改行されているMarkdownはそのまま保つ（冪等性）', () => {
    const input = '導入文です。\n\n## 見出し\n\n- 項目1\n- 項目2\n\nまとめの文です。'
    expect(repairMarkdown(input)).toBe(input)
  })

  it('コードフェンス内の # や - は書き換えない', () => {
    const input = '説明文です。\n\n```bash\n# コメント\n-v --help\n```\n\n続きの文です。'
    expect(repairMarkdown(input)).toBe(input)
  })

  it('スペースで挟まれたハイフン（ダッシュ用法）は書き換えない', () => {
    const input = 'AとB - 補足情報です。'
    expect(repairMarkdown(input)).toBe(input)
  })
})
