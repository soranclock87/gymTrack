import { NextResponse } from 'next/server'
import {
  getActiveRestrictions,
  getActiveTrainingBlock,
  getBlockReview,
  getCompletedSessions,
  getExerciseCatalog,
  getRecentTrainingEvents,
  initDB,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await initDB()
    const [activeBlock, review, completedSessions, exerciseCatalog, recentEvents, activeRestrictions] = await Promise.all([
      getActiveTrainingBlock(),
      getBlockReview(),
      getCompletedSessions(),
      getExerciseCatalog(),
      getRecentTrainingEvents(),
      getActiveRestrictions(),
    ])

    return NextResponse.json({
      activeBlock,
      review,
      completedSessions,
      exerciseCatalog,
      recentEvents,
      activeRestrictions,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
