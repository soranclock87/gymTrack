import { NextRequest, NextResponse } from 'next/server'
import { getBodyWeights, addBodyWeight, deleteBodyWeight } from '@/lib/db'
export async function GET() {
  try { return NextResponse.json(await getBodyWeights()) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
export async function POST(req: NextRequest) {
  try { const { date, weight, notes } = await req.json(); return NextResponse.json(await addBodyWeight(date, weight, notes)) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
export async function DELETE(req: NextRequest) {
  try { const { id } = await req.json(); await deleteBodyWeight(id); return NextResponse.json({ ok: true }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
