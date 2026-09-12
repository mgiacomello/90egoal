'use client'

// Come portare ONE TAP fuori dall'app: nella home, nel menu di condivisione,
// sotto al dito. Include anche, per onestà, quello che una web app NON può fare.

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { copyText, detectPlatform, type Platform } from '@/lib/onetap/actions'
import { CheckIcon, CloseIcon } from './icons'

type Tab = 'ios' | 'android' | 'desktop'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'ios', label: 'iPhone' },
  { id: 'android', label: 'Android' },
  { id: 'desktop', label: 'Computer' },
]

function tabFor(platform: Platform): Tab {
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  return 'desktop'
}

/**
 * Piattaforma e dominio si conoscono solo nel browser. Sono stato esterno a
 * React, non stato di React: letti una volta, memorizzati, e serviti al server
 * con un valore neutro perché l'idratazione non trovi due render diversi.
 */
interface ClientInfo {
  platform: Platform
  origin: string
}
const SERVER_INFO: ClientInfo = { platform: 'other', origin: '' }
let clientInfo: ClientInfo | null = null

/**
 * Un URL di anteprima (`…-git-branch-team.vercel.app`) o locale cambia a ogni
 * deploy: un comando iOS costruito su quello smette di funzionare da solo.
 * Meglio dirlo prima che dopo.
 */
function isUnstableOrigin(origin: string): boolean {
  if (!origin) return false
  try {
    const host = new URL(origin).hostname
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      host.includes('-git-')
    )
  } catch {
    return false
  }
}

const noSubscribe = () => () => {}
function readClientInfo(): ClientInfo {
  if (!clientInfo) clientInfo = { platform: detectPlatform(), origin: window.location.origin }
  return clientInfo
}
const readServerInfo = () => SERVER_INFO

export default function InstallGuide() {
  const info = useSyncExternalStore(noSubscribe, readClientInfo, readServerInfo)
  const [picked, setPicked] = useState<Tab | null>(null)
  const [copied, setCopied] = useState(false)

  const tab = picked ?? tabFor(info.platform)
  const shortcutUrl = `${info.origin || 'https://…'}/onetap?text=`

  async function copyShortcutUrl() {
    const ok = await copyText(shortcutUrl)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="ot">
      <div className="relative mx-auto w-full max-w-[460px] px-6 pb-24">
        <header className="flex items-center justify-between pt-6">
          <Link href="/onetap" aria-label="Back" className="ot-ghost -ml-2 p-2">
            <CloseIcon className="h-5 w-5" />
          </Link>
          <span className="ot-wordmark text-[13px] text-white/40">One Tap</span>
          <span className="w-9" />
        </header>

        <div className="ot-rise pt-12">
          <h1 className="ot-display text-[34px] font-extrabold leading-[1.06]">
            Put ONE TAP everywhere.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--ot-muted)]">
            The goal is never to open the app. You see something — in Photos, in WhatsApp, on a
            poster — and you act on it from where you already are.
          </p>

          <div className="mt-8 flex gap-2" role="tablist" aria-label="Platform">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setPicked(t.id)}
                className={`ot-chip ${tab === t.id ? 'ot-chip-on' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'ios' && (
            <Ios
              url={shortcutUrl}
              onCopy={copyShortcutUrl}
              copied={copied}
              unstable={isUnstableOrigin(info.origin)}
            />
          )}
          {tab === 'android' && <Android />}
          {tab === 'desktop' && <Desktop />}

          <Limits />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="ot-display mt-0.5 w-6 shrink-0 text-[15px] font-bold tabular-nums text-[var(--ot-violet)]">
        {n}
      </span>
      <div className="min-w-0">
        <p className="ot-display text-[17px] font-bold tracking-tight">{title}</p>
        <div className="mt-1.5 text-[15px] leading-relaxed text-white/70">{children}</div>
      </div>
    </li>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ot-muted)]">
        {title}
      </h2>
      <ol className="mt-5 space-y-6">{children}</ol>
    </section>
  )
}

/** Nome dell'azione nell'app Comandi, con l'etichetta italiana accanto. */
function Act({ en, it }: { en: string; it: string }) {
  return (
    <>
      <strong className="text-white">{en}</strong>
      <span className="text-[var(--ot-muted)]"> ({it})</span>
    </>
  )
}

/* ------------------------------------------------------------------ */

function Ios({
  url,
  onCopy,
  copied,
  unstable,
}: {
  url: string
  onCopy: () => void
  copied: boolean
  unstable: boolean
}) {
  return (
    <>
      <Section title="1 · On the home screen">
        <Step n={1} title="Add to Home Screen">
          In Safari, tap Share → <strong className="text-white">Add to Home Screen</strong>. ONE TAP
          opens full screen, with no browser bar.
        </Step>
      </Section>

      <Section title="2 · In the share sheet">
        <li className="ot-card px-5 py-4 text-[14px] leading-relaxed text-white/70">
          Safari cannot do this part on its own: iOS does not let a web app register itself as a
          share target. A Shortcut can, and it takes about two minutes — once.
          <span className="mt-2 block text-[var(--ot-muted)]">
            It also reads the image <strong className="text-white/80">on the phone</strong>, so on
            this route the picture never leaves your device at all.
          </span>
        </li>

        <Step n={1} title="New shortcut">
          Open <strong className="text-white">Shortcuts</strong> (Comandi) → <strong className="text-white">+</strong>.
        </Step>
        <Step n={2} title="Accept images from the share sheet">
          At the top, set the shortcut to receive <strong className="text-white">Images</strong> from{' '}
          <strong className="text-white">Share Sheet</strong>, and turn on{' '}
          <Act en="Show in Share Sheet" it="Mostra nel menu di condivisione" />.
        </Step>
        <Step n={3} title="Read the text on the device">
          Add <Act en="Extract Text from Image" it="Estrai testo dall'immagine" />. This is Apple’s
          own on-device OCR — nothing is uploaded.
        </Step>
        <Step n={4} title="Prepare the link">
          Add <Act en="URL Encode" it="Codifica URL" />, then <Act en="Text" it="Testo" /> containing
          this address followed by the encoded variable:
          <button
            onClick={onCopy}
            className="ot-card mt-3 flex w-full items-center gap-3 px-4 py-3 text-left font-mono text-[12px] leading-snug break-all text-white/85 transition-colors active:bg-white/10"
          >
            <span className="min-w-0 flex-1">{url}</span>
            {copied ? (
              <CheckIcon className="h-4 w-4 shrink-0 text-[var(--ot-violet)]" />
            ) : (
              <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-[var(--ot-muted)]">
                Copy
              </span>
            )}
          </button>
          <p className={`mt-2 text-[13px] leading-relaxed ${unstable ? 'text-amber-200/90' : 'text-[var(--ot-muted)]'}`}>
            {unstable
              ? 'Careful: this is a local or preview address and it changes with every deploy. Open this page from your production domain before you build the shortcut, or it will break on its own.'
              : 'Use the address of your production domain — a preview URL changes with every deploy.'}
          </p>
        </Step>
        <Step n={5} title="Open it">
          Add <Act en="Open URLs" it="Apri URL" />. Rename the shortcut{' '}
          <strong className="text-white">ONE TAP</strong> and give it an icon.
        </Step>
        <Step n={6} title="Use it">
          Long-press any photo, screenshot or image — in Photos, WhatsApp, Mail, Safari — tap Share,
          then <strong className="text-white">ONE TAP</strong>. The action is already on screen.
        </Step>
      </Section>

      <Section title="3 · Under your finger">
        <Step n={1} title="Back Tap">
          Settings → Accessibility → Touch → <strong className="text-white">Back Tap</strong> → Double
          Tap → your ONE TAP shortcut. Two taps on the back of the phone and it runs.
        </Step>
        <Step n={2} title="Action Button">
          On iPhone 15 Pro and later: Settings → Action Button → Shortcut → ONE TAP.
        </Step>
      </Section>
    </>
  )
}

function Android() {
  return (
    <>
      <Section title="1 · Install">
        <Step n={1} title="Install app">
          In Chrome, open the menu → <strong className="text-white">Install app</strong> (or{' '}
          <em>Add to Home screen</em>).
        </Step>
      </Section>

      <Section title="2 · That’s already it">
        <Step n={1} title="ONE TAP is in the share sheet">
          Android honours the app’s share target, so no extra setup: take a screenshot, or open any
          photo, tap Share, and pick <strong className="text-white">ONE TAP</strong>. Shared text and
          links work the same way.
        </Step>
        <Step n={2} title="Quick actions">
          Long-press the ONE TAP icon on the home screen for Capture and the demo.
        </Step>
        <Step n={3} title="The first share needs the app once">
          The share target is served by the app’s own worker, which registers the first time you open
          ONE TAP after installing. Open it once, then share away.
        </Step>
      </Section>
    </>
  )
}

function Desktop() {
  return (
    <>
      <Section title="Install">
        <Step n={1} title="Install the app">
          In Chrome or Edge, use the install icon at the right of the address bar. ONE TAP gets its
          own window and its own icon.
        </Step>
      </Section>

      <Section title="Use it">
        <Step n={1} title="Copy, then paste anywhere in the app">
          Take a screenshot to the clipboard (<kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[12px]">⌘⌃⇧4</kbd> on
          Mac, <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[12px]">Win+Shift+S</kbd> on
          Windows) and press <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[12px]">⌘V</kbd> on
          the ONE TAP home screen. Copied text works the same way.
        </Step>
        <Step n={2} title="Or drag it in">
          Drop an image file anywhere on the window.
        </Step>
      </Section>
    </>
  )
}

/* ------------------------------------------------------------------ */

function Limits() {
  return (
    <section className="mt-14 border-t border-white/8 pt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ot-muted)]">
        What this cannot do
      </h2>
      <ul className="mt-5 space-y-4 text-[15px] leading-relaxed text-white/70">
        <li>
          <strong className="text-white">Sit on top of your other apps.</strong> Nothing on the web
          can watch messages as they arrive or float over WhatsApp. No phone allows it — and you
          would not want an app that could.
        </li>
        <li>
          <strong className="text-white">Read your photo library.</strong> There is no browser
          permission for that, on any platform. A picture reaches ONE TAP only when you take it,
          share it, paste it or pick it. That boundary is the reason the privacy promise holds.
        </li>
        <li>
          <strong className="text-white">Register itself in the iPhone share sheet.</strong> Only a
          native app extension can, which is exactly what the Shortcut above stands in for.
        </li>
      </ul>
      <p className="mt-6 text-[14px] leading-relaxed text-[var(--ot-muted)]">
        A native app would add the missing pieces: an action right on the photo, actions inside
        notifications, a lock-screen tile. That is the step after this MVP shows the habit is real —
        the engine that decides the action would not change.
      </p>
      <Link href="/onetap" className="ot-chip mt-8 inline-flex">
        Back to ONE TAP
      </Link>
    </section>
  )
}
