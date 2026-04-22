import { NextRequest, NextResponse } from 'next/server'
import {
  createTrainingBlock,
  deleteActiveTrainingBlock,
  getActiveRestrictions,
  getActiveTrainingBlock,
  getBlockReview,
  getExerciseHistoryMap,
  initDB,
} from '@/lib/db'
import { generateCoachBlock } from '@/lib/training/ai'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await initDB()
    const block = await getActiveTrainingBlock()
    return NextResponse.json(block)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDB()
    const body = await req.json()
    const historyMap = await getExerciseHistoryMap()
    const review = body?.useReview ? await getBlockReview() : null
    const activeRestrictions = await getActiveRestrictions()
    const { blueprint, source } = await generateCoachBlock({
      goal: body?.goal,
      weeks: body?.weeks,
      startDate: body?.startDate,
      trainingDaysPerWeek: body?.trainingDaysPerWeek,
      preferredWeekdays: body?.preferredWeekdays,
      historyMap,
      activeRestrictions,
      review,
    })

    const block = await createTrainingBlock(blueprint)
    return NextResponse.json({ block, source, blueprint })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await initDB()
    return NextResponse.json(await deleteActiveTrainingBlock())
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
