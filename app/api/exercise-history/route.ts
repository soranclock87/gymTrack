import { NextRequest, NextResponse } from 'next/server'
import { getExerciseHistory } from '@/lib/db'
export async function GET(req: NextRequest) {
  try { const ex = new URL(req.url).searchParams.get('exercise') ?? ''; return NextResponse.json(await getExerciseHistory(ex)) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
