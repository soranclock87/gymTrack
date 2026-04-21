import { NextResponse } from 'next/server'
import { getActiveTrainingBlock, getBlockReview, getCompletedSessions, getExerciseCatalog, initDB } from '@/lib/db'

export async function GET() {
  try {
    await initDB()
    const [activeBlock, review, completedSessions, exerciseCatalog] = await Promise.all([
      getActiveTrainingBlock(),
      getBlockReview(),
      getCompletedSessions(),
      getExerciseCatalog(),
    ])

    return NextResponse.json({
      activeBlock,
      review,
      completedSessions,
      exerciseCatalog,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
