import { useState } from 'react'

interface ConfettiPiece {
  left: number
  delay: number
  duration: number
  color: string
}

const COLORS = ['bg-app-accent', 'bg-app-accent-hover', 'bg-app-success', 'bg-app-warning', 'bg-app-danger']
const PIECE_COUNT = 40

/**
 * 依存ライブラリなしの紙吹雪エフェクト（CSS アニメーションのみ）。
 * 画面全体を覆う固定オーバーレイだが pointer-events-none のため操作は妨げない。
 */
export default function Confetti() {
  const [pieces] = useState<ConfettiPiece[]>(() =>
    Array.from({ length: PIECE_COUNT }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 1.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })),
  )

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`absolute top-0 h-2 w-2 rounded-sm ${p.color} animate-confetti-fall`}
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
        />
      ))}
    </div>
  )
}
