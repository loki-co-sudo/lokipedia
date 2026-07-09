// テーマ（ライト/ダーク/ロキ）の取得・変更。docs/DESIGN.md §5.5 参照。
// data-theme 属性の初期値は index.html のインラインスクリプトが設定済み（FOUC防止）。

import { useEffect, useState } from 'react'
import { getTheme, setTheme as persistTheme, type Theme } from '../lib/settings'

const THEME_COLOR: Record<Theme, string> = {
  light: '#f8fafc',
  dark: '#0f172a',
  loki: '#1e1b4b',
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  function setTheme(next: Theme) {
    persistTheme(next)
    setThemeState(next)
  }

  return { theme, setTheme }
}
