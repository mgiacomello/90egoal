// La chiave pubblica VAPID, letta a runtime: il browser la usa per iscriversi.
// È pubblica per definizione. La privata resta solo sul server.
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null })
}
