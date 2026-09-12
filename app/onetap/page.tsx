import { Suspense } from 'react'
import OneTapApp from '@/components/onetap/OneTapApp'

// L'app è interamente client-side: le catture non passano dal server se non
// per la trascrizione, e la cronologia non lo raggiunge mai.
export default function OneTapPage() {
  return (
    <Suspense fallback={<div className="ot" aria-busy="true" />}>
      <OneTapApp />
    </Suspense>
  )
}
