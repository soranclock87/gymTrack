import { NextResponse } from 'next/server'
import { initDB, resetAllTrainingData } from '@/lib/db'

export async function POST() {
  try {
    await initDB()
    return NextResponse.json(await resetAllTrainingData())
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
