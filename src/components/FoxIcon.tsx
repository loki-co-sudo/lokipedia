interface FoxIconProps {
  className?: string
}

/**
 * design/icon.svg から背景を除いた狐面のみのアイコン。
 * 色はすべてテーマトークン（app-text / app-accent / app-bg）に追従する。
 */
export default function FoxIcon({ className }: FoxIconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* fox head silhouette (ears + face as one shape, trickster motif) */}
      <path d="M 18,6 L 50,28 L 82,6 L 79,54 L 50,92 L 21,54 Z" className="fill-app-text" />

      {/* sparkle on forehead: insight / intellect */}
      <path d="M 50,26 L 53,35 L 62,38 L 53,41 L 50,50 L 47,41 L 38,38 L 47,35 Z" className="fill-app-accent" />

      {/* eyes (sly / upward-slanted at outer corner) */}
      <line x1="30" y1="55" x2="44" y2="65" className="stroke-app-bg" strokeWidth="5" strokeLinecap="round" />
      <line x1="70" y1="55" x2="56" y2="65" className="stroke-app-bg" strokeWidth="5" strokeLinecap="round" />

      {/* nose */}
      <path d="M 44,80 L 56,80 L 50,90 Z" className="fill-app-bg" />
    </svg>
  )
}
