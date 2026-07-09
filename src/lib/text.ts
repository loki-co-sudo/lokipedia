// Markdown をプレーンテキストへ簡易変換するユーティリティ。辞書カードの抜粋表示に使う。

// 見出し語の表記揺れ（全角/半角・大文字小文字・前後空白）を吸収する正規化。重複判定（Phase 8）に使う。
export function normalizeTerm(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase()
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
