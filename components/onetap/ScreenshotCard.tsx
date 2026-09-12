// Finta schermata usata da demo e onboarding: deve sembrare uno screenshot vero.
import type { DemoChrome } from '@/lib/onetap/demo'

export default function ScreenshotCard({
  chrome,
  from,
  lines,
  scanning = false,
  className = '',
}: {
  chrome: DemoChrome
  from?: string
  lines: string[]
  scanning?: boolean
  className?: string
}) {
  return (
    <div className={`ot-shot relative ${className}`}>
      {scanning && <div className="ot-scan" />}

      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="truncate text-xs font-medium tracking-wide text-white/45">
          {from ?? chromeLabel(chrome)}
        </span>
        <span className="ml-auto text-[10px] tabular-nums text-white/25">9:41</span>
      </div>

      <div className="px-4 py-4">
        {chrome === 'chat' || chrome === 'sms' ? (
          <div className="ot-bubble text-white/90">
            {lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        ) : chrome === 'receipt' ? (
          <div className="space-y-1.5 font-mono text-[13px] leading-relaxed text-white/80">
            {lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {lines.map((l, i) => (
              <p
                key={i}
                className={
                  i === 0
                    ? 'ot-display text-lg font-semibold text-white'
                    : 'text-[15px] leading-relaxed text-white/70'
                }
              >
                {l}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function chromeLabel(chrome: DemoChrome): string {
  switch (chrome) {
    case 'chat': return 'Messages'
    case 'sms': return 'SMS'
    case 'note': return 'Notes'
    case 'card': return 'Business card'
    case 'receipt': return 'Invoice'
    case 'photo': return 'Photo'
  }
}
