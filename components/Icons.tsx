// Icone a linea, disegnate uguali: le emoji cambiano da telefono a telefono.
// Tutte su griglia 24, tratto 2, colore corrente.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 20, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  )
}

/** Pallone: cerchio con pentagono centrale. */
export function IconBall(p: P) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l4.3 3.1-1.6 5H9.3l-1.6-5z" />
      <path d="M12 7.5V3.2M16.3 10.6l3.9-1.3M14.7 15.6l2.5 3.5M9.3 15.6l-2.5 3.5M7.7 10.6L3.8 9.3" />
    </Base>
  )
}

/** Schedina: foglio con righe spuntate. */
export function IconTicket(p: P) {
  return (
    <Base {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </Base>
  )
}

/** Coppa. */
export function IconTrophy(p: P) {
  return (
    <Base {...p}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M9 21h6M10 17h4" />
    </Base>
  )
}

/** Persona. */
export function IconUser(p: P) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Base>
  )
}

/** Campanella. */
export function IconBell(p: P) {
  return (
    <Base {...p}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Base>
  )
}

/** Orologio: i minuti. */
export function IconClock(p: P) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Base>
  )
}

/** Più: il recupero. */
export function IconPlus(p: P) {
  return (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  )
}

/** Bandierina: ultimo gol. */
export function IconFlag(p: P) {
  return (
    <Base {...p}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </Base>
  )
}

/** Fischietto: primo gol. */
export function IconWhistle(p: P) {
  return (
    <Base {...p}>
      <path d="M13 8h7v3h-5l-.5 2.5A5 5 0 1 1 9 9h4z" />
      <circle cx="8.5" cy="14" r="1" />
    </Base>
  )
}

/** Libro: regole. */
export function IconBook(p: P) {
  return (
    <Base {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19a2 2 0 0 1 2-2h13" />
    </Base>
  )
}

/** Telefono con freccia: installa. */
export function IconInstall(p: P) {
  return (
    <Base {...p}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M12 7v7M9.5 11.5L12 14l2.5-2.5" />
    </Base>
  )
}

/** Condividi. */
export function IconShare(p: P) {
  return (
    <Base {...p}>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </Base>
  )
}

/** Spunta. */
export function IconCheck(p: P) {
  return (
    <Base {...p}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Base>
  )
}

/** Lucchetto: definitivo. */
export function IconLock(p: P) {
  return (
    <Base {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Base>
  )
}

/** Cronometro: supplementari. */
export function IconStopwatch(p: P) {
  return (
    <Base {...p}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5M10 2h4M12 2v3" />
    </Base>
  )
}

/** Grafico: statistiche. */
export function IconChart(p: P) {
  return (
    <Base {...p}>
      <path d="M4 20h16" />
      <path d="M7 16v-5M12 16V7M17 16v-3" />
    </Base>
  )
}

/** Archivio. */
export function IconArchive(p: P) {
  return (
    <Base {...p}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
    </Base>
  )
}

/** Mirino: il Cecchino. */
export function IconTarget(p: P) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Base>
  )
}

/** Corona: il Leader. */
export function IconCrown(p: P) {
  return (
    <Base {...p}>
      <path d="M4 18h16l1-10-5 4-4-6-4 6-5-4z" />
    </Base>
  )
}

/** Stella: il Veggente. */
export function IconStar(p: P) {
  return (
    <Base {...p}>
      <path d="M12 3l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8z" />
    </Base>
  )
}
