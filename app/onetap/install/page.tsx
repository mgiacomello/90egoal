import type { Metadata } from 'next'
import InstallGuide from '@/components/onetap/InstallGuide'

export const metadata: Metadata = {
  title: 'Install ONE TAP',
  description: 'Put ONE TAP on your home screen and in the system share sheet.',
  robots: { index: false, follow: false },
}

export default function InstallPage() {
  return <InstallGuide />
}
