// 辞書一覧の並び替え純粋関数。docs/DESIGN.md §5.2 が仕様の正。

import type { Word } from '../types'

const kanaCollator = new Intl.Collator('ja')

export function sortWordsByLatest(words: Word[]): Word[] {
  return [...words].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function sortWordsByKana(words: Word[]): Word[] {
  return [...words].sort((a, b) => kanaCollator.compare(a.reading ?? a.term, b.reading ?? b.term))
}
