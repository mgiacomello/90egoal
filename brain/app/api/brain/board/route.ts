import { BOARD_AGENT, runBoard } from '@/lib/brain/agents/board'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { lastRun } from '@/lib/brain/memory'

export const runtime = 'nodejs'
export const maxDuration = 300

/** L'ultimo board, com'è stato scritto. */
export async function GET() {
  try {
    await requireOwner()
    const run = await lastRun(BOARD_AGENT)
    return Response.json({ board: run ? { ...(run.answer as Record<string, unknown>), at: run.createdAt } : null })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere il board.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** Riunisce il board adesso: scrivanie, memo, repliche, sintesi. */
export async function POST(request: Request) {
  try {
    const owner = await requireOwner()
    return Response.json({ board: await runBoard(owner.email, request.signal) })
  } catch (err) {
    const e = toBrainError(err, 'Il board non si è riunito.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
