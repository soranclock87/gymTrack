import { NextResponse } from 'next/server'
import { getBlockReview, initDB } from '@/lib/db'

export async function GET() {
  try {
    await initDB()
    return NextResponse.json(await getBlockReview())
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
