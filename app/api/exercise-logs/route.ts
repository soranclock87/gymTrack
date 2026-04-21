import { NextRequest, NextResponse } from 'next/server'
import { getExerciseLogs, addExerciseLog, deleteExerciseLog, getExerciseNames } from '@/lib/db'
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('names') === '1') return NextResponse.json(await getExerciseNames())
    return NextResponse.json(await getExerciseLogs())
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
export async function POST(req: NextRequest) {
  try { const b = await req.json(); return NextResponse.json(await addExerciseLog(b.date, b.exercise, b.muscle_group, b.sets, b.reps, b.weight, b.notes)) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
export async function DELETE(req: NextRequest) {
  try { const { id } = await req.json(); await deleteExerciseLog(id); return NextResponse.json({ ok: true }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
