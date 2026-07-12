// Markdown をプレーンテキストへ簡易変換するユーティリティ。辞書カードの抜粋表示に使う。

// 見出し語の表記揺れ（全角/半角・大文字小文字・前後空白）を吸収する正規化。重複判定（Phase 8）に使う。
export function normalizeTerm(s: string): string {
  return s.normalize('NFKC').trim().toLowerCase()
}

// Gemini の構造化出力（responseSchema）は、definition/explanation 内の見出し(##)や箇条書き(-/*)の
// 直前の改行を省略して直前の文にそのまま連結してしまうことがある（例:「...です。## 見出し- 項目1」）。
// react-markdown は行頭でない # や - をただの記号として扱うため、レンダリング表示時に repairMarkdown で
// 欠落した改行を補ってから渡す。コードフェンス内は書き換えない。
export function repairMarkdown(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/)
    .map((segment, i) => (i % 2 === 1 ? segment : repairMarkdownSegment(segment)))
    .join('')
}

function repairMarkdownSegment(segment: string): string {
  return segment
    .replace(/([^\n])(#{2,6}\s)/g, '$1\n\n$2')
    .replace(/([^\n\s])([-*]\s)/g, '$1\n$2')
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
