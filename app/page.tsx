'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart2, CalendarRange, Dumbbell, Plus, Scale, Sparkles, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { BlockReview, TrainingBlock } from '@/lib/training/types'

type BodyWeightRow = { id: number; date: string; weight: string; notes: string | null }
type ExerciseHistoryRow = { date: string; maxWeight: number; totalSets: number }
type CompletedSessionSummary = {
  id: number
  performedAt: string
  title: string
  dayLabel: string | null
  durationMinutes: number | null
  energy: number | null
  notes: string | null
  exercises: string[]
}
type OverviewResponse = {
  activeBlock: TrainingBlock | null
  review: BlockReview | null
  completedSessions: CompletedSessionSummary[]
  exerciseCatalog: Array<{ id: number; name: string; muscle_group: string }>
}
type SessionDraftSet = {
  setIndex: number
  reps: string
  weight: string
  rir: string
}
type SessionDraftExercise = {
  plannedExerciseId: number
  exerciseName: string
  muscleGroup: string
  notes: string
  sets: SessionDraftSet[]
}
type SaveResult = {
  recommendations?: Array<{ exerciseName: string; decision: string; nextWeight: number | null; reason: string }>
}

const TAB_LABELS = ['Plan actual', 'Registrar sesión', 'Evolución', 'Peso corporal']
const TAB_ICONS = [CalendarRange, Dumbbell, BarChart2, Scale]

function today() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(date: string) {
  try {
    return format(parseISO(date), 'd MMM yyyy', { locale: es })
  } catch {
    return date
  }
}

function toChartDate(date: string) {
  try {
    return format(parseISO(date), 'd MMM', { locale: es })
  } catch {
    return date
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(json.error || 'Error de red')
  }

  return json
}

function getCurrentWeek(block: TrainingBlock | null) {
  if (!block) return null
  const start = new Date(`${block.startDate}T12:00:00`)
  const now = new Date()
  const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  return Math.min(block.weeks, Math.max(1, Math.floor(diffDays / 7) + 1))
}

function buildInitialDraft(block: TrainingBlock | null, sessionId: number | null) {
  const session = block?.sessions.find((item) => item.id === sessionId)
  if (!session) return []

  return session.exercises.map((exercise) => ({
    plannedExerciseId: exercise.id,
    exerciseName: exercise.exerciseName,
    muscleGroup: exercise.muscleGroup,
    notes: '',
    sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
      setIndex: index + 1,
      reps: String(exercise.maxReps),
      weight: exercise.suggestedWeight ? String(exercise.suggestedWeight) : '',
      rir: exercise.targetRir !== null ? String(exercise.targetRir) : '',
    })),
  }))
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div style={{ background: '#141414', border: '1px solid #3d3d3d', borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: 1, marginBottom: subtitle ? 4 : 14 }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 12, color: '#7a7a7a', marginBottom: 14 }}>{subtitle}</div> : null}
      {children}
    </div>
  )
}

export default function Home() {
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingWeight, setSavingWeight] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [creatingBlock, setCreatingBlock] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const [bodyWeights, setBodyWeights] = useState<BodyWeightRow[]>([])
  const [overview, setOverview] = useState<OverviewResponse>({
    activeBlock: null,
    review: null,
    completedSessions: [],
    exerciseCatalog: [],
  })
  const [historyExercise, setHistoryExercise] = useState('')
  const [historyData, setHistoryData] = useState<ExerciseHistoryRow[]>([])
  const [recommendations, setRecommendations] = useState<SaveResult['recommendations']>([])

  const [bwDate, setBwDate] = useState(today())
  const [bwWeight, setBwWeight] = useState('')
  const [bwNotes, setBwNotes] = useState('')

  const [goal, setGoal] = useState('Hipertrofia con progresión sostenible')
  const [weeks, setWeeks] = useState('4')
  const [blockStartDate, setBlockStartDate] = useState(today())
  const [useReview, setUseReview] = useState(true)

  const [sessionDate, setSessionDate] = useState(today())
  const [sessionDuration, setSessionDuration] = useState('75')
  const [sessionEnergy, setSessionEnergy] = useState('3')
  const [sessionNotes, setSessionNotes] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [sessionDraft, setSessionDraft] = useState<SessionDraftExercise[]>([])

  const activeBlock = overview.activeBlock
  const currentWeek = getCurrentWeek(activeBlock)
  const pendingSessions = activeBlock?.sessions.filter((session) => session.status === 'planned') ?? []

  const exerciseOptions = useMemo(() => {
    const set = new Map<string, string>()
    overview.exerciseCatalog.forEach((item) => set.set(item.name, item.muscle_group))
    activeBlock?.sessions.forEach((session) => {
      session.exercises.forEach((exercise) => set.set(exercise.exerciseName, exercise.muscleGroup))
    })

    return Array.from(set.entries())
      .map(([exercise, muscleGroup]) => ({ exercise, muscleGroup }))
      .sort((a, b) => a.exercise.localeCompare(b.exercise))
  }, [overview.exerciseCatalog, activeBlock])

  const selectedSession = useMemo(
    () => activeBlock?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [activeBlock, selectedSessionId]
  )

  const bodyWeightChartData = useMemo(
    () => [...bodyWeights].reverse().map((entry) => ({ date: toChartDate(entry.date), peso: Number.parseFloat(entry.weight) })),
    [bodyWeights]
  )

  const currentWeight = bodyWeights[0] ? Number.parseFloat(bodyWeights[0].weight) : null
  const startWeight = bodyWeights.length > 1 ? Number.parseFloat(bodyWeights[bodyWeights.length - 1].weight) : null
  const weightDelta = currentWeight !== null && startWeight !== null ? +(currentWeight - startWeight).toFixed(1) : null

  const loadOverview = useCallback(async () => {
    const data = await fetchJson<OverviewResponse>('/api/coach/overview')
    setOverview(data)
  }, [])

  const loadBodyWeights = useCallback(async () => {
    const data = await fetchJson<BodyWeightRow[]>('/api/body-weight')
    setBodyWeights(Array.isArray(data) ? data : [])
  }, [])

  const loadExerciseHistory = useCallback(async (exercise: string) => {
    setHistoryExercise(exercise)
    if (!exercise) {
      setHistoryData([])
      return
    }

    const data = await fetchJson<Array<{ date: string; maxWeight: number; totalSets: number }>>(
      `/api/exercise-history?exercise=${encodeURIComponent(exercise)}`
    )
    setHistoryData(
      (Array.isArray(data) ? data : []).map((item) => ({
        date: item.date,
        maxWeight: Number(item.maxWeight),
        totalSets: Number(item.totalSets),
      }))
    )
  }, [])

  const refreshAll = useCallback(async () => {
    setError(null)
    await fetch('/api/init')
    await Promise.all([loadOverview(), loadBodyWeights()])
    setLoading(false)
  }, [loadOverview, loadBodyWeights])

  useEffect(() => {
    refreshAll().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la app')
      setLoading(false)
    })
  }, [refreshAll])

  useEffect(() => {
    const firstPending = pendingSessions[0]?.id ?? null
    if (firstPending && !pendingSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(firstPending)
    }
    if (!firstPending) {
      setSelectedSessionId(null)
    }
  }, [pendingSessions, selectedSessionId])

  useEffect(() => {
    setSessionDraft(buildInitialDraft(activeBlock, selectedSessionId))
  }, [activeBlock, selectedSessionId])

  useEffect(() => {
    if (!historyExercise && exerciseOptions[0]) {
      loadExerciseHistory(exerciseOptions[0].exercise).catch(() => undefined)
    }
  }, [exerciseOptions, historyExercise, loadExerciseHistory])

  async function handleSaveWeight() {
    if (!bwWeight) return
    setSavingWeight(true)
    setError(null)
    try {
      await fetchJson('/api/body-weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: bwDate,
          weight: Number.parseFloat(bwWeight),
          notes: bwNotes || null,
        }),
      })
      setBwWeight('')
      setBwNotes('')
      await loadBodyWeights()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el peso')
    } finally {
      setSavingWeight(false)
    }
  }

  async function handleDeleteWeight(id: number) {
    setError(null)
    try {
      await fetchJson('/api/body-weight', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await loadBodyWeights()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar el peso')
    }
  }

  async function handleGenerateBlock() {
    setCreatingBlock(true)
    setError(null)
    setStatusMessage(null)
    try {
      const response = await fetchJson<{ source: 'ai' | 'rules' }>('/api/coach/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          weeks: Number.parseInt(weeks, 10),
          startDate: blockStartDate,
          useReview,
        }),
      })
      setStatusMessage(
        response.source === 'ai'
          ? 'Bloque generado con apoyo del modelo y reglas de seguridad.'
          : 'Bloque generado con motor de reglas. Si configuras una API key, también podrá usar IA.'
      )
      await loadOverview()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el bloque')
    } finally {
      setCreatingBlock(false)
    }
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    field: keyof SessionDraftSet,
    value: string
  ) {
    setSessionDraft((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exercise
        return {
          ...exercise,
          sets: exercise.sets.map((set, currentSetIndex) =>
            currentSetIndex === setIndex ? { ...set, [field]: value } : set
          ),
        }
      })
    )
  }

  function addSetRow(exerciseIndex: number) {
    setSessionDraft((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exercise
        const last = exercise.sets[exercise.sets.length - 1]
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              setIndex: exercise.sets.length + 1,
              reps: last?.reps ?? '',
              weight: last?.weight ?? '',
              rir: last?.rir ?? '',
            },
          ],
        }
      })
    )
  }

  async function handleSaveSession() {
    if (!selectedSession) return
    setSavingSession(true)
    setError(null)
    setRecommendations([])
    setStatusMessage(null)

    try {
      const payload = {
        plannedSessionId: selectedSession.id,
        performedAt: sessionDate,
        durationMinutes: sessionDuration ? Number.parseInt(sessionDuration, 10) : null,
        energy: sessionEnergy ? Number.parseInt(sessionEnergy, 10) : null,
        notes: sessionNotes || null,
        exercises: sessionDraft.map((exercise) => ({
          plannedExerciseId: exercise.plannedExerciseId,
          exerciseName: exercise.exerciseName,
          muscleGroup: exercise.muscleGroup,
          notes: exercise.notes || null,
          sets: exercise.sets
            .filter((set) => set.weight && set.reps)
            .map((set) => ({
              setIndex: set.setIndex,
              reps: Number.parseInt(set.reps, 10),
              weight: Number.parseFloat(set.weight),
              rir: set.rir ? Number.parseInt(set.rir, 10) : null,
            })),
        })),
      }

      const response = await fetchJson<SaveResult>('/api/coach/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setRecommendations(response.recommendations ?? [])
      setSessionNotes('')
      setSessionEnergy('3')
      setSessionDuration('75')
      await loadOverview()
      if (historyExercise) {
        await loadExerciseHistory(historyExercise)
      }
      setStatusMessage('Sesión guardada. Las próximas cargas sugeridas ya se han recalculado.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la sesión')
    } finally {
      setSavingSession(false)
    }
  }

  const historyChartData = historyData.map((point) => ({
    date: toChartDate(point.date),
    maxWeight: point.maxWeight,
    totalSets: point.totalSets,
  }))

  const selectedExerciseSuggestions =
    historyExercise && activeBlock
      ? activeBlock.sessions
          .flatMap((session) =>
            session.exercises
              .filter((exercise) => exercise.exerciseName === historyExercise)
              .map((exercise) => ({
                weekIndex: session.weekIndex,
                dayLabel: session.dayLabel,
                title: session.title,
                suggestedWeight: exercise.suggestedWeight,
                repRange: `${exercise.minReps}-${exercise.maxReps}`,
              }))
          )
          .slice(0, 8)
      : []

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f5f2ee' }}>
      <div style={{ background: '#141414', borderBottom: '1px solid #3d3d3d', padding: '24px 24px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -10, top: -20, fontFamily: 'Bebas Neue, sans-serif', fontSize: 120, color: 'rgba(255,255,255,0.03)', pointerEvents: 'none', lineHeight: 1 }}>
          PABLO
        </div>
        <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d63c2a', fontWeight: 500, marginBottom: 6 }}>
          La Force et la Douleur
        </div>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: 2, lineHeight: 1, marginBottom: 16 }}>
          Coach <span style={{ color: '#d63c2a' }}>Entreno</span>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: '#c8a84b', letterSpacing: 1 }}>{activeBlock ? activeBlock.weeks : 0}</div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a' }}>Semanas del bloque</div>
          </div>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: '#c8a84b', letterSpacing: 1 }}>{pendingSessions.length}</div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a' }}>Sesiones pendientes</div>
          </div>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: '#c8a84b', letterSpacing: 1 }}>{overview.completedSessions.length}</div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a' }}>Sesiones registradas</div>
          </div>
          {currentWeight !== null ? (
            <div>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: '#c8a84b', letterSpacing: 1 }}>{currentWeight.toFixed(1)} kg</div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a' }}>
                Peso actual {weightDelta !== null ? `· ${weightDelta > 0 ? '+' : ''}${weightDelta} kg` : ''}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #3d3d3d', background: '#141414' }}>
        {TAB_LABELS.map((label, index) => {
          const Icon = TAB_ICONS[index]
          return (
            <button
              key={label}
              onClick={() => setTab(index)}
              style={{
                flex: 1,
                padding: '14px 8px',
                background: 'none',
                border: 'none',
                borderBottom: tab === index ? '2px solid #d63c2a' : '2px solid transparent',
                color: tab === index ? '#f5f2ee' : '#7a7a7a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      <div style={{ padding: 20, maxWidth: 980, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#7a7a7a', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>CARGANDO...</div>
        ) : (
          <>
            {error ? (
              <div style={{ background: 'rgba(214,60,42,0.12)', border: '1px solid rgba(214,60,42,0.35)', color: '#ff9f92', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                {error}
              </div>
            ) : null}
            {statusMessage ? (
              <div style={{ background: 'rgba(200,168,75,0.12)', border: '1px solid rgba(200,168,75,0.35)', color: '#f3d88b', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                {statusMessage}
              </div>
            ) : null}

            {tab === 0 ? (
              <>
                <SectionCard title="Generar bloque" subtitle="Crea o reemplaza el bloque activo con reglas y, si configuras una API key, con ayuda del modelo.">
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Objetivo del bloque" style={inputStyle} />
                    <select value={weeks} onChange={(event) => setWeeks(event.target.value)} style={inputStyle}>
                      <option value="3">3 semanas</option>
                      <option value="4">4 semanas</option>
                    </select>
                    <input type="date" value={blockStartDate} onChange={(event) => setBlockStartDate(event.target.value)} style={inputStyle} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#bcbcbc', marginBottom: 14 }}>
                    <input type="checkbox" checked={useReview} onChange={(event) => setUseReview(event.target.checked)} />
                    Revisar el bloque anterior antes de generar el siguiente
                  </label>
                  <button onClick={handleGenerateBlock} disabled={creatingBlock} style={primaryButtonStyle(creatingBlock)}>
                    <Sparkles size={14} />
                    {creatingBlock ? 'Generando...' : activeBlock ? 'Generar siguiente bloque' : 'Generar primer bloque'}
                  </button>
                </SectionCard>

                {activeBlock ? (
                  <>
                    <SectionCard
                      title={activeBlock.title}
                      subtitle={`${activeBlock.goal} · ${formatDate(activeBlock.startDate)} - ${formatDate(activeBlock.endDate)} · Semana actual ${currentWeek ?? 1}/${activeBlock.weeks}`}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                        <Metric title="Origen" value={activeBlock.generatedBy === 'ai' ? 'IA + reglas' : 'Reglas'} />
                        <Metric title="Pendientes" value={String(pendingSessions.length)} />
                        <Metric title="Completadas" value={String(activeBlock.sessions.length - pendingSessions.length)} />
                      </div>
                      {activeBlock.rationale ? <div style={{ fontSize: 13, color: '#bcbcbc', marginBottom: 12 }}>{activeBlock.rationale}</div> : null}
                      {overview.review ? (
                        <div style={{ background: '#1b1b1b', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#7a7a7a', marginBottom: 6 }}>Revisión del bloque</div>
                          <div style={{ fontSize: 14, marginBottom: 8 }}>{overview.review.summary}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {overview.review.actions.map((action) => (
                              <span key={action} style={{ background: '#2a2a2a', color: '#cfcfcf', borderRadius: 999, padding: '5px 10px', fontSize: 11 }}>
                                {action}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </SectionCard>

                    <SectionCard title="Sesiones planificadas" subtitle="Cada sesión conserva series objetivo, rango de repeticiones y carga sugerida actualizada por tus resultados.">
                      <div style={{ display: 'grid', gap: 12 }}>
                        {activeBlock.sessions.map((session) => (
                          <div key={session.id} style={{ border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, background: session.status === 'completed' ? '#111b12' : '#101010' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>
                                  Semana {session.weekIndex} · {session.dayLabel} · {session.title}
                                </div>
                                <div style={{ fontSize: 12, color: '#7a7a7a' }}>{session.focus}</div>
                              </div>
                              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: session.status === 'completed' ? '#315a37' : '#2a2a2a', color: session.status === 'completed' ? '#d5f5d8' : '#d0d0d0' }}>
                                {session.status === 'completed' ? 'Completada' : 'Pendiente'}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              {session.exercises.map((exercise) => (
                                <div key={exercise.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#d0d0d0', paddingBottom: 6, borderBottom: '1px solid #1f1f1f' }}>
                                  <div>
                                    <strong>{exercise.exerciseName}</strong> <span style={{ color: '#7a7a7a' }}>· {exercise.targetSets}x {exercise.minReps}-{exercise.maxReps}</span>
                                  </div>
                                  <div style={{ color: '#c8a84b' }}>{exercise.suggestedWeight ? `${exercise.suggestedWeight} kg` : 'Sin carga base'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </>
                ) : (
                  <SectionCard title="Sin bloque activo">
                    <div style={{ fontSize: 14, color: '#bcbcbc' }}>Genera el primer bloque para empezar a registrar sesiones y dejar que el sistema ajuste las cargas automáticamente.</div>
                  </SectionCard>
                )}

                <SectionCard title="Últimas sesiones">
                  {overview.completedSessions.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#7a7a7a' }}>Todavía no has guardado sesiones en el nuevo flujo.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {overview.completedSessions.map((session) => (
                        <div key={session.id} style={{ background: '#101010', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{session.title}</div>
                              <div style={{ fontSize: 12, color: '#7a7a7a' }}>{formatDate(session.performedAt)}{session.dayLabel ? ` · ${session.dayLabel}` : ''}</div>
                            </div>
                            <div style={{ fontSize: 12, color: '#c8a84b' }}>
                              {session.durationMinutes ? `${session.durationMinutes} min` : 'Duración libre'} · Energía {session.energy ?? '-'}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#bcbcbc', marginTop: 8 }}>{session.exercises.join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            ) : null}

            {tab === 1 ? (
              !selectedSession ? (
                <SectionCard title="No hay sesión pendiente">
                  <div style={{ fontSize: 14, color: '#bcbcbc' }}>Genera un bloque o completa la siguiente rotación para seguir registrando sesiones.</div>
                </SectionCard>
              ) : (
                <>
                  <SectionCard title="Registrar sesión" subtitle="Edita solo las series y el peso real de cada ejercicio. El sistema recalcula la progresión después de guardar.">
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <select value={selectedSessionId ?? ''} onChange={(event) => setSelectedSessionId(Number(event.target.value))} style={inputStyle}>
                        {pendingSessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            Semana {session.weekIndex} · {session.dayLabel} · {session.title}
                          </option>
                        ))}
                      </select>
                      <input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} style={inputStyle} />
                      <input type="number" value={sessionDuration} onChange={(event) => setSessionDuration(event.target.value)} placeholder="Duración" style={inputStyle} />
                      <select value={sessionEnergy} onChange={(event) => setSessionEnergy(event.target.value)} style={inputStyle}>
                        <option value="1">Energía 1/5</option>
                        <option value="2">Energía 2/5</option>
                        <option value="3">Energía 3/5</option>
                        <option value="4">Energía 4/5</option>
                        <option value="5">Energía 5/5</option>
                      </select>
                    </div>
                    <input value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} placeholder="Notas generales de la sesión" style={{ ...inputStyle, marginBottom: 14 }} />

                    <div style={{ display: 'grid', gap: 14 }}>
                      {sessionDraft.map((exercise, exerciseIndex) => (
                        <div key={exercise.plannedExerciseId} style={{ border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, background: '#101010' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{exercise.exerciseName}</div>
                              <div style={{ fontSize: 12, color: '#7a7a7a' }}>{exercise.muscleGroup}</div>
                            </div>
                            <button onClick={() => addSetRow(exerciseIndex)} style={{ ...pillButtonStyle, border: '1px solid #3d3d3d' }}>
                              <Plus size={12} />
                              Añadir serie
                            </button>
                          </div>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {exercise.sets.map((set, setIndex) => (
                              <div key={`${exercise.plannedExerciseId}-${set.setIndex}`} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                                <div style={{ fontSize: 12, color: '#7a7a7a' }}>Serie {set.setIndex}</div>
                                <input type="number" value={set.reps} onChange={(event) => updateSet(exerciseIndex, setIndex, 'reps', event.target.value)} placeholder="Reps" style={inputStyle} />
                                <input type="number" step="0.5" value={set.weight} onChange={(event) => updateSet(exerciseIndex, setIndex, 'weight', event.target.value)} placeholder="Peso kg" style={inputStyle} />
                                <input type="number" value={set.rir} onChange={(event) => updateSet(exerciseIndex, setIndex, 'rir', event.target.value)} placeholder="RIR" style={inputStyle} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button onClick={handleSaveSession} disabled={savingSession} style={{ ...primaryButtonStyle(savingSession), marginTop: 16 }}>
                      <Dumbbell size={14} />
                      {savingSession ? 'Guardando...' : 'Guardar sesión'}
                    </button>
                  </SectionCard>

                  {recommendations && recommendations.length > 0 ? (
                    <SectionCard title="Ajustes automáticos">
                      <div style={{ display: 'grid', gap: 10 }}>
                        {recommendations.map((recommendation) => (
                          <div key={`${recommendation.exerciseName}-${recommendation.decision}`} style={{ background: '#101010', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                              <strong>{recommendation.exerciseName}</strong>
                              <span style={{ color: recommendation.decision === 'increase' ? '#7ee787' : recommendation.decision === 'decrease' ? '#ff8b7b' : '#c8a84b' }}>
                                {recommendation.nextWeight ? `${recommendation.nextWeight} kg` : 'Sin peso sugerido'}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#bcbcbc', marginTop: 6 }}>{recommendation.reason}</div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  ) : null}
                </>
              )
            ) : null}

            {tab === 2 ? (
              <>
                <SectionCard title="Progresión por ejercicio">
                  <select value={historyExercise} onChange={(event) => loadExerciseHistory(event.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
                    <option value="">Selecciona un ejercicio...</option>
                    {exerciseOptions.map((option) => (
                      <option key={option.exercise} value={option.exercise}>
                        {option.exercise} ({option.muscleGroup})
                      </option>
                    ))}
                  </select>

                  {historyExercise && historyChartData.length > 0 ? (
                    <>
                      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: 1, color: '#c8a84b', marginBottom: 12 }}>
                        {historyExercise} · máximo por sesión
                      </div>
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={historyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                          <XAxis dataKey="date" stroke="#7a7a7a" tick={{ fontSize: 10 }} />
                          <YAxis stroke="#7a7a7a" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                          <Tooltip
                            contentStyle={{ background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, color: '#f5f2ee', fontSize: 12 }}
                            formatter={(value: number) => [`${value} kg`, 'Peso máximo']}
                          />
                          <Line type="monotone" dataKey="maxWeight" stroke="#d63c2a" strokeWidth={2} dot={{ fill: '#d63c2a', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: '#7a7a7a' }}>Selecciona un ejercicio con historial para ver su progresión.</div>
                  )}
                </SectionCard>

                {selectedExerciseSuggestions.length > 0 ? (
                  <SectionCard title="Próximas sugerencias de carga">
                    <div style={{ display: 'grid', gap: 10 }}>
                      {selectedExerciseSuggestions.map((entry) => (
                        <div key={`${entry.weekIndex}-${entry.title}-${entry.dayLabel}`} style={{ background: '#101010', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Semana {entry.weekIndex} · {entry.dayLabel}</div>
                            <div style={{ fontSize: 12, color: '#7a7a7a' }}>{entry.title} · {entry.repRange} reps</div>
                          </div>
                          <div style={{ color: '#c8a84b', fontWeight: 600 }}>{entry.suggestedWeight ? `${entry.suggestedWeight} kg` : 'Sin sugerencia'}</div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                ) : null}

                {overview.review ? (
                  <SectionCard title="Estado del bloque">
                    <div style={{ fontSize: 14, marginBottom: 10 }}>{overview.review.summary}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {overview.review.actions.map((action) => (
                        <span key={action} style={{ background: '#2a2a2a', color: '#d0d0d0', borderRadius: 999, padding: '5px 10px', fontSize: 11 }}>
                          {action}
                        </span>
                      ))}
                    </div>
                  </SectionCard>
                ) : null}
              </>
            ) : null}

            {tab === 3 ? (
              <>
                <SectionCard title="Peso corporal">
                  {bodyWeightChartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={bodyWeightChartData}>
                        <defs>
                          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#c8a84b" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#c8a84b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis dataKey="date" stroke="#7a7a7a" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#7a7a7a" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, color: '#f5f2ee', fontSize: 12 }} />
                        <Area type="monotone" dataKey="peso" stroke="#c8a84b" strokeWidth={2} fill="url(#wGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ fontSize: 13, color: '#7a7a7a', marginBottom: 14 }}>Añade al menos dos mediciones para ver la evolución del peso.</div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, marginBottom: 10 }}>
                    <input type="date" value={bwDate} onChange={(event) => setBwDate(event.target.value)} style={inputStyle} />
                    <input type="number" step="0.1" value={bwWeight} onChange={(event) => setBwWeight(event.target.value)} placeholder="Peso en kg" style={inputStyle} />
                  </div>
                  <input value={bwNotes} onChange={(event) => setBwNotes(event.target.value)} placeholder="Notas opcionales" style={{ ...inputStyle, marginBottom: 14 }} />
                  <button onClick={handleSaveWeight} disabled={savingWeight || !bwWeight} style={primaryButtonStyle(savingWeight || !bwWeight)}>
                    <Plus size={14} />
                    {savingWeight ? 'Guardando...' : 'Guardar peso'}
                  </button>
                </SectionCard>

                <SectionCard title="Historial de peso">
                  {bodyWeights.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#7a7a7a' }}>Todavía no has registrado peso corporal.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {bodyWeights.map((entry) => (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', borderBottom: '1px solid #1f1f1f', paddingBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{Number.parseFloat(entry.weight).toFixed(1)} kg</div>
                            <div style={{ fontSize: 12, color: '#7a7a7a' }}>{formatDate(entry.date)}{entry.notes ? ` · ${entry.notes}` : ''}</div>
                          </div>
                          <button onClick={() => handleDeleteWeight(entry.id)} style={{ ...pillButtonStyle, color: '#7a7a7a' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ background: '#101010', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12 }}>
      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: 1, color: '#c8a84b' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#1e1e1e',
  border: '1px solid #3d3d3d',
  borderRadius: 6,
  padding: '8px 10px',
  color: '#f5f2ee',
  fontSize: 13,
}

const pillButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#d0d0d0',
  cursor: 'pointer',
  borderRadius: 999,
  padding: '6px 10px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    background: '#d63c2a',
    border: 'none',
    borderRadius: 6,
    padding: '10px 18px',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
}
