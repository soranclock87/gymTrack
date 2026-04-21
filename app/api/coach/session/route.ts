import { NextRequest, NextResponse } from 'next/server'
import { getCompletedSessions, initDB, saveCompletedSession } from '@/lib/db'

export async function GET() {
  try {
    await initDB()
    return NextResponse.json(await getCompletedSessions())
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDB()
    const body = await req.json()
    const saved = await saveCompletedSession(body)
    return NextResponse.json(saved)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
