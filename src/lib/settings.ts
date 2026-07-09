// localStorage アクセスの集約。docs/DESIGN.md §2.3 参照。
// Gemini API キーはこのモジュール経由でのみ読み書きする（CLAUDE.md 絶対ルール1）。

const GEMINI_API_KEY_STORAGE_KEY = 'lokipedia:gemini-api-key'

export function getGeminiApiKey(): string | null {
  return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, key)
}

export function clearGeminiApiKey(): void {
  localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY)
}
