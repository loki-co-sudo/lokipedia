interface LokiPortraitProps {
  className?: string
  /** 円形メダリオン等、コンテナに合わせて上端基準でトリミングしたいときに指定（例: "xMidYMax slice"）。 */
  preserveAspectRatio?: string
}

/**
 * ロキ（トリックスター）のバストアップイラスト。狐面を手に持った男性のシルエット。
 * FoxIcon 同様、色はすべてテーマトークン（app-text / app-accent 系 / app-bg）に追従する。
 * 肩から先は viewBox の外（y=110 超）まで伸ばしてあり、メダリオン等でトリミングしても不自然な余白が出ない。
 */
export default function LokiPortrait({ className, preserveAspectRatio }: LokiPortraitProps) {
  return (
    <svg
      viewBox="0 0 100 110"
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      aria-hidden="true"
    >
      {/* shoulders / chest */}
      <path d="M 8,120 L 15,74 Q 50,58 85,74 L 92,120 Z" className="fill-app-text" />

      {/* V-neck collar cut */}
      <path d="M 40,74 L 50,90 L 60,74 L 55,72 L 50,80 L 45,72 Z" className="fill-app-bg" />

      {/* neck */}
      <path d="M 42,72 L 42,56 L 58,56 L 58,72 Z" className="fill-app-text" />

      {/* head */}
      <path
        d="M 50,14 C 68,14 74,29 72,41 C 71,49 64,58 50,58 C 36,58 29,49 28,41 C 26,29 32,14 50,14 Z"
        className="fill-app-text"
      />

      {/* 頬の陰影（フラットな塗りに立体感を持たせる） */}
      <path
        d="M 55,20 C 63,26 66,36 62,46 C 68,40 70,28 62,18 C 59,15 56,17 55,20 Z"
        className="fill-app-bg opacity-15"
      />

      {/* swept hair + cowlick */}
      <path
        d="M 25,27 C 23,16 34,6 50,7 C 65,8 76,15 75,26 C 68,19 58,14 50,15 C 39,16 29,19 25,27 Z"
        className="fill-app-text"
      />
      <path d="M 47,9 L 53,0 L 57,11 Z" className="fill-app-text" />

      {/* sly visible eye (the other side is behind the mask) */}
      <line x1="33" y1="41" x2="42" y2="46" className="stroke-app-bg" strokeWidth="3" strokeLinecap="round" />

      {/* fox mask held up beside the face, on a handle gripped in a fist */}
      <g transform="translate(60,20) rotate(18) scale(0.5)">
        <path d="M 18,6 L 50,28 L 82,6 L 79,54 L 50,92 L 21,54 Z" className="fill-app-accent" />
        <path
          d="M 50,26 L 53,35 L 62,38 L 53,41 L 50,50 L 47,41 L 38,38 L 47,35 Z"
          className="fill-app-accent-hover"
        />
        <circle cx="38" cy="50" r="7" className="fill-app-bg" />
        <line x1="48" y1="88" x2="42" y2="140" className="stroke-app-accent" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 22,120 C 14,116 12,130 18,138 C 24,146 38,146 42,136 C 46,126 34,122 22,120 Z"
          className="fill-app-accent"
        />
      </g>
    </svg>
  )
}
