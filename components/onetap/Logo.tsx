// Il segno di ONE TAP: un bersaglio. Anello sottile, punto pieno al centro —
// il posto dove appoggi il dito. È lo stesso disegno dell'icona sulla home
// screen, così l'app si riconosce prima ancora di leggerne il nome.

export function LogoMark({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ot-mark" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#c9bcff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="19" stroke="url(#ot-mark)" strokeWidth="3.4" />
      <circle cx="32" cy="32" r="7" fill="url(#ot-mark)" />
    </svg>
  )
}

export default function Logo({
  size = 64,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <LogoMark size={size} />
      <span className="ot-wordmark text-[15px] text-white">One Tap</span>
    </div>
  )
}
