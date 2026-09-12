// Icone ONE TAP: tratto uniforme, 24×24, nessuna dipendenza esterna.
import type { ActionKind } from '@/lib/onetap/types'

type IconProps = { className?: string }

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function PhoneIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M6.6 3.5h2.2l1.5 3.8-1.8 1.3a11.5 11.5 0 0 0 5.4 5.4l1.3-1.8 3.8 1.5v2.2a2.1 2.1 0 0 1-2.3 2.1A16.4 16.4 0 0 1 4.5 5.8 2.1 2.1 0 0 1 6.6 3.5Z" />
    </svg>
  )
}
export function PinIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  )
}
export function CopyIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 6.2V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15h.7" />
    </svg>
  )
}
export function LinkIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
    </svg>
  )
}
export function MailIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.8 7 7.3 5.2a1.5 1.5 0 0 0 1.8 0L20.2 7" />
    </svg>
  )
}
export function CalendarIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </svg>
  )
}
export function ReplyIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M20 18v-2.5a5 5 0 0 0-5-5H5" />
      <path d="m9 6.5-4 4 4 4" />
    </svg>
  )
}
export function SearchIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}
export function ChatIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.6-.35L4.5 20l1.1-3.2A6.4 6.4 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5Z" />
    </svg>
  )
}
export function PersonIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}
export function TranslateIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M4 6h9M8.5 4v2M11 6c0 4-3 7.5-7 8.5" />
      <path d="M6 10.5c1.4 2.4 3.4 3.8 5.5 4.5M13 20l3.8-9 3.7 9M14.6 17.2h5" />
    </svg>
  )
}
export function ShareIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M12 15V4M8.5 7.2 12 3.7l3.5 3.5" />
      <path d="M5 13.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-5.5" />
    </svg>
  )
}
export function CameraIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.2l1.2-2h7.2l1.2 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z" />
      <circle cx="12" cy="12.5" r="3.3" />
    </svg>
  )
}
export function TrashIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
    </svg>
  )
}
export function CloseIcon(p: IconProps) {
  return (
    <svg {...base} className={p.className} aria-hidden="true">
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </svg>
  )
}
export function CheckIcon(p: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} className={p.className} aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export function ActionIcon({ kind, className }: { kind: ActionKind; className?: string }) {
  switch (kind) {
    case 'CALL': return <PhoneIcon className={className} />
    case 'TEXT': return <ChatIcon className={className} />
    case 'WHATSAPP': return <ChatIcon className={className} />
    case 'EMAIL': return <MailIcon className={className} />
    case 'COPY': return <CopyIcon className={className} />
    case 'OPEN': return <LinkIcon className={className} />
    case 'NAVIGATE': return <PinIcon className={className} />
    case 'CALENDAR': return <CalendarIcon className={className} />
    case 'CONTACT': return <PersonIcon className={className} />
    case 'SEARCH': return <SearchIcon className={className} />
    case 'REPLY': return <ReplyIcon className={className} />
    case 'TRANSLATE': return <TranslateIcon className={className} />
    case 'SHARE': return <ShareIcon className={className} />
  }
}
