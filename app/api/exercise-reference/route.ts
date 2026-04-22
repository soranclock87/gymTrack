import { NextRequest, NextResponse } from 'next/server'
import { getExerciseReferences } from '@/lib/exercise-reference'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { names?: string[] }
    const names = Array.isArray(body?.names) ? body.names : []
    const references = await getExerciseReferences(names)
    return NextResponse.json({ references })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
