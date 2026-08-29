import type { Metadata } from 'next'
import SaloneGame from '@/components/salone/SaloneGame'

export const metadata: Metadata = {
  title: 'Salone di Bellezza — taglia, trucca e vesti',
  description:
    'Gioco per bambini: scegli una modella o carica una foto, poi cambia capelli, trucco e vestiti e salva il tuo look.',
}

export default function SalonePage() {
  return <SaloneGame />
}
