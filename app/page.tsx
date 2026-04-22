'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  BarChart2,
  CalendarRange,
  Dumbbell,
  MinusCircle,
  Plus,
  Scale,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type {
  ActiveRestriction,
  BlockReview,
  CompletedSessionSummary,
  ExerciseReference,
  SessionReason,
  TrainingBlock,
  TrainingEvent,
  Weekday,
} from '@/lib/training/types'

type BodyWeightRow = { id: number; date: string; weight: string; notes: string | null }
type ExerciseHistoryRow = { date: string; maxWeight: number; totalSets: number }
type OverviewResponse = {
  activeBlock: TrainingBlock | null
  review: BlockReview | null
  completedSessions: CompletedSessionSummary[]
  exerciseCatalog: Array<{ id: number; name: string; muscle_group: string }>
  recentEvents: TrainingEvent[]
  activeRestrictions: ActiveRestriction[]
}
type SaveResult = {
  recommendations?: Array<{ exerciseName: string; decision: string; nextWeight: number | null; reason: string }>
}
type ExerciseReferenceResponse = {
  references: Record<string, ExerciseReference | null>
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
  adjustmentReason: SessionReason | ''
  loadReductionPercent: string
  loadReductionKg: string
  injuryName: string
  injurySeverity: '' | 'leve' | 'moderada' | 'alta'
  restrictionUntil: string
  sets: SessionDraftSet[]
}

const TAB_LABELS = ['Plan actual', 'Registrar sesión', 'Evolución', 'Peso corporal']
const TAB_ICONS = [CalendarRange, Dumbbell, BarChart2, Scale]
const WEEKDAYS: Weekday[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SESSION_REASONS: Array<{ id: SessionReason; label: string }> = [
  { id: 'fatiga', label: 'Fatiga' },
  { id: 'lesion', label: 'Lesión' },
  { id: 'viaje', label: 'Viaje' },
  { id: 'falta_de_tiempo', label: 'Falta de tiempo' },
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'otro', label: 'Otro' },
]

function today() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(date: string | null) {
  if (!date) return '-'
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
  const method = init?.method?.toUpperCase() ?? 'GET'
  const response = await fetch(url, {
    cache: method === 'GET' ? 'no-store' : 'default',
    ...init,
  })
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

function buildInitialDraft(block: TrainingBlock | null, sessionId: number | null): SessionDraftExercise[] {
  const session = block?.sessions.find((item) => item.id === sessionId)
  if (!session) return []

  return session.exercises.map((exercise) => ({
    plannedExerciseId: exercise.id,
    exerciseName: exercise.exerciseName,
    muscleGroup: exercise.muscleGroup,
    notes: '',
    adjustmentReason: '',
    loadReductionPercent: '',
    loadReductionKg: '',
    injuryName: '',
    injurySeverity: '',
    restrictionUntil: '',
    sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
      setIndex: index + 1,
      reps: String(exercise.maxReps),
      weight: exercise.suggestedWeight ? String(exercise.suggestedWeight) : '',
      rir: exercise.targetRir !== null ? String(exercise.targetRir) : '',
    })),
  }))
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
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
  const [deletingBlock, setDeletingBlock] = useState(false)
  const [resettingAll, setResettingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const [bodyWeights, setBodyWeights] = useState<BodyWeightRow[]>([])
  const [overview, setOverview] = useState<OverviewResponse>({
    activeBlock: null,
    review: null,
    completedSessions: [],
    exerciseCatalog: [],
    recentEvents: [],
    activeRestrictions: [],
  })
  const [historyExercise, setHistoryExercise] = useState('')
  const [historyData, setHistoryData] = useState<ExerciseHistoryRow[]>([])
  const [recommendations, setRecommendations] = useState<SaveResult['recommendations']>([])
  const [exerciseReferences, setExerciseReferences] = useState<Record<string, ExerciseReference | null>>({})

  const [bwDate, setBwDate] = useState(today())
  const [bwWeight, setBwWeight] = useState('')
  const [bwNotes, setBwNotes] = useState('')

  const [goal, setGoal] = useState('Hipertrofia con progresión sostenible')
  const [weeks, setWeeks] = useState('4')
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState('4')
  const [preferredWeekdays, setPreferredWeekdays] = useState<Weekday[]>(['Lunes', 'Miércoles', 'Viernes', 'Sábado'])
  const [blockStartDate, setBlockStartDate] = useState(today())
  const [useReview, setUseReview] = useState(true)

  const [sessionDate, setSessionDate] = useState(today())
  const [sessionDuration, setSessionDuration] = useState('75')
  const [sessionEnergy, setSessionEnergy] = useState('3')
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionStatus, setSessionStatus] = useState<'completed' | 'skipped' | 'adapted'>('completed')
  const [sessionReason, setSessionReason] = useState<SessionReason | ''>('')
  const [sessionInjuryName, setSessionInjuryName] = useState('')
  const [sessionInjurySeverity, setSessionInjurySeverity] = useState<'' | 'leve' | 'moderada' | 'alta'>('')
  const [sessionRestrictionUntil, setSessionRestrictionUntil] = useState('')
  const [sessionReductionPercent, setSessionReductionPercent] = useState('')
  const [sessionReductionKg, setSessionReductionKg] = useState('')
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
    setHistoryData((Array.isArray(data) ? data : []).map((item) => ({ date: item.date, maxWeight: Number(item.maxWeight), totalSets: Number(item.totalSets) })))
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
    if (activeBlock) {
      setTrainingDaysPerWeek(String(activeBlock.trainingDaysPerWeek))
      setPreferredWeekdays(activeBlock.preferredWeekdays)
    }
  }, [activeBlock])

  useEffect(() => {
    const firstPending = pendingSessions[0]?.id ?? null
    if (firstPending && !pendingSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(firstPending)
    }
    if (!firstPending) setSelectedSessionId(null)
  }, [pendingSessions, selectedSessionId])

  useEffect(() => {
    setSessionDraft(buildInitialDraft(activeBlock, selectedSessionId))
    setSessionStatus('completed')
    setSessionReason('')
    setSessionInjuryName('')
    setSessionInjurySeverity('')
    setSessionRestrictionUntil('')
    setSessionReductionPercent('')
    setSessionReductionKg('')
  }, [activeBlock, selectedSessionId])

  useEffect(() => {
    if (!historyExercise && exerciseOptions[0]) {
      loadExerciseHistory(exerciseOptions[0].exercise).catch(() => undefined)
    }
  }, [exerciseOptions, historyExercise, loadExerciseHistory])

  useEffect(() => {
    const names = Array.from(new Set(activeBlock?.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.exerciseName)) ?? []))

    if (!names.length) {
      setExerciseReferences({})
      return
    }

    let cancelled = false

    fetchJson<ExerciseReferenceResponse>('/api/exercise-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    })
      .then((data) => {
        if (!cancelled) {
          setExerciseReferences(data.references ?? {})
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExerciseReferences({})
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeBlock])

  async function handleSaveWeight() {
    if (!bwWeight) return
    setSavingWeight(true)
    setError(null)
    try {
      await fetchJson('/api/body-weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: bwDate, weight: Number.parseFloat(bwWeight), notes: bwNotes || null }),
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

  function toggleWeekday(weekday: Weekday) {
    setPreferredWeekdays((current) => (current.includes(weekday) ? current.filter((item) => item !== weekday) : [...current, weekday]))
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
          trainingDaysPerWeek: Number.parseInt(trainingDaysPerWeek, 10),
          preferredWeekdays,
        }),
      })
      setStatusMessage(
        response.source === 'ai'
          ? 'Bloque generado con apoyo del modelo y reglas de seguridad.'
          : 'Bloque generado con motor de reglas y validado según tus días preferidos.'
      )
      await loadOverview()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el bloque')
    } finally {
      setCreatingBlock(false)
    }
  }

  async function handleDeleteActivePlan() {
    if (!window.confirm('Se eliminará el plan activo, pero el historial ya guardado se conservará.')) return
    setDeletingBlock(true)
    setError(null)
    try {
      await fetchJson('/api/coach/block', { method: 'DELETE' })
      setStatusMessage('Plan activo eliminado. Puedes generar uno nuevo cuando quieras.')
      await loadOverview()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar el plan activo')
    } finally {
      setDeletingBlock(false)
    }
  }

  async function handleResetAllData() {
    if (!window.confirm('Se borrarán todos los datos actuales: pesos, sesiones, histórico, eventos y planes.')) return
    setResettingAll(true)
    setError(null)
    try {
      await fetchJson('/api/coach/reset', { method: 'POST' })
      setHistoryExercise('')
      setHistoryData([])
      setRecommendations([])
      setStatusMessage('Se han borrado todos los datos y la app ha quedado lista para empezar desde cero.')
      await refreshAll()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron borrar los datos')
    } finally {
      setResettingAll(false)
    }
  }

  function updateExerciseField(exerciseIndex: number, field: keyof Omit<SessionDraftExercise, 'sets' | 'plannedExerciseId' | 'exerciseName' | 'muscleGroup'>, value: string) {
    setSessionDraft((current) =>
      current.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex ? { ...exercise, [field]: value } : exercise
      )
    )
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: keyof SessionDraftSet, value: string) {
    setSessionDraft((current) =>
      current.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exercise
        return {
          ...exercise,
          sets: exercise.sets.map((set, currentSetIndex) => (currentSetIndex === setIndex ? { ...set, [field]: value } : set)),
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
          sets: [...exercise.sets, { setIndex: exercise.sets.length + 1, reps: last?.reps ?? '', weight: last?.weight ?? '', rir: last?.rir ?? '' }],
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
        sessionStatus,
        reason: sessionReason || null,
        durationMinutes: sessionDuration ? Number.parseInt(sessionDuration, 10) : null,
        energy: sessionEnergy ? Number.parseInt(sessionEnergy, 10) : null,
        injuryName: sessionInjuryName || null,
        injurySeverity: sessionInjurySeverity || null,
        restrictionUntil: sessionRestrictionUntil || null,
        loadReductionPercent: sessionReductionPercent ? Number.parseFloat(sessionReductionPercent) : null,
        loadReductionKg: sessionReductionKg ? Number.parseFloat(sessionReductionKg) : null,
        notes: sessionNotes || null,
        exercises:
          sessionStatus === 'skipped'
            ? []
            : sessionDraft.map((exercise) => ({
                plannedExerciseId: exercise.plannedExerciseId,
                exerciseName: exercise.exerciseName,
                muscleGroup: exercise.muscleGroup,
                adjustmentReason: exercise.adjustmentReason || null,
                loadReductionPercent: exercise.loadReductionPercent ? Number.parseFloat(exercise.loadReductionPercent) : null,
                loadReductionKg: exercise.loadReductionKg ? Number.parseFloat(exercise.loadReductionKg) : null,
                injuryName: exercise.injuryName || null,
                injurySeverity: exercise.injurySeverity || null,
                restrictionUntil: exercise.restrictionUntil || null,
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
      if (historyExercise) await loadExerciseHistory(historyExercise)
      setStatusMessage(
        sessionStatus === 'skipped'
          ? 'Sesión marcada como saltada y registrada en el seguimiento.'
          : sessionStatus === 'adapted'
            ? 'Sesión adaptada guardada. El seguimiento tendrá en cuenta lesiones y reducciones deliberadas.'
            : 'Sesión guardada. Las próximas cargas sugeridas ya se han recalculado.'
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la sesión')
    } finally {
      setSavingSession(false)
    }
  }

  const historyChartData = historyData.map((point) => ({ date: toChartDate(point.date), maxWeight: point.maxWeight, totalSets: point.totalSets }))

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
          .slice(0, 10)
      : []

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f5f2ee' }}>
      <div style={{ background: '#141414', borderBottom: '1px solid #3d3d3d', padding: '24px 24px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -10, top: -20, fontFamily: 'Bebas Neue, sans-serif', fontSize: 120, color: 'rgba(255,255,255,0.03)', pointerEvents: 'none', lineHeight: 1 }}>PABLO</div>
        <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d63c2a', fontWeight: 500, marginBottom: 6 }}>La Force et la Douleur</div>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: 2, lineHeight: 1, marginBottom: 16 }}>
          Coach <span style={{ color: '#d63c2a' }}>Flexible</span>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Metric title="Días por semana" value={activeBlock ? String(activeBlock.trainingDaysPerWeek) : trainingDaysPerWeek} />
          <Metric title="Pendientes" value={String(pendingSessions.length)} />
          <Metric title="Eventos recientes" value={String(overview.recentEvents.length)} />
          {currentWeight !== null ? <Metric title="Peso actual" value={`${currentWeight.toFixed(1)} kg${weightDelta !== null ? ` · ${weightDelta > 0 ? '+' : ''}${weightDelta}` : ''}`} /> : null}
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

      <div style={{ padding: 20, maxWidth: 1040, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#7a7a7a', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>CARGANDO...</div>
        ) : (
          <>
            {error ? <div style={errorBannerStyle}>{error}</div> : null}
            {statusMessage ? <div style={infoBannerStyle}>{statusMessage}</div> : null}

            {tab === 0 ? (
              <>
                <SectionCard title="Generar o regenerar plan" subtitle="Configura cuántos días entrenas, qué días prefieres y genera un bloque nuevo respetando tus restricciones actuales.">
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Objetivo del bloque" style={inputStyle} />
                    <select value={weeks} onChange={(event) => setWeeks(event.target.value)} style={inputStyle}>
                      <option value="3">3 semanas</option>
                      <option value="4">4 semanas</option>
                    </select>
                    <select value={trainingDaysPerWeek} onChange={(event) => setTrainingDaysPerWeek(event.target.value)} style={inputStyle}>
                      {Array.from({ length: 7 }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>
                          {count} día{count > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                    <input type="date" value={blockStartDate} onChange={(event) => setBlockStartDate(event.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', marginBottom: 8 }}>Días preferidos</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {WEEKDAYS.map((weekday) => (
                        <button
                          key={weekday}
                          onClick={() => toggleWeekday(weekday)}
                          style={{
                            ...chipStyle,
                            background: preferredWeekdays.includes(weekday) ? '#d63c2a' : '#2a2a2a',
                            color: preferredWeekdays.includes(weekday) ? '#fff' : '#d0d0d0',
                          }}
                        >
                          {weekday}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#bcbcbc', marginBottom: 16 }}>
                    <input type="checkbox" checked={useReview} onChange={(event) => setUseReview(event.target.checked)} />
                    Revisar el bloque anterior y las sesiones adaptadas antes de generar el siguiente
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={handleGenerateBlock} disabled={creatingBlock} style={primaryButtonStyle(creatingBlock)}>
                      <Sparkles size={14} />
                      {creatingBlock ? 'Generando...' : activeBlock ? 'Regenerar plan' : 'Generar primer plan'}
                    </button>
                    <button onClick={handleDeleteActivePlan} disabled={deletingBlock || !activeBlock} style={secondaryButtonStyle(deletingBlock || !activeBlock)}>
                      <MinusCircle size={14} />
                      {deletingBlock ? 'Borrando...' : 'Borrar plan activo'}
                    </button>
                    <button onClick={handleResetAllData} disabled={resettingAll} style={dangerButtonStyle(resettingAll)}>
                      <Trash2 size={14} />
                      {resettingAll ? 'Borrando todo...' : 'Borrar todos los datos'}
                    </button>
                  </div>
                </SectionCard>

                {activeBlock ? (
                  <>
                    <SectionCard
                      title={activeBlock.title}
                      subtitle={`${activeBlock.goal} · ${formatDate(activeBlock.startDate)} - ${formatDate(activeBlock.endDate)} · ${activeBlock.trainingDaysPerWeek} días/semana`}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                        <Metric title="Semana actual" value={`${currentWeek ?? 1}/${activeBlock.weeks}`} />
                        <Metric title="Preferencias" value={activeBlock.preferredWeekdays.join(' · ')} />
                        <Metric title="Pendientes" value={String(pendingSessions.length)} />
                      </div>
                      {activeBlock.rationale ? <div style={{ fontSize: 13, color: '#bcbcbc', marginBottom: 12 }}>{activeBlock.rationale}</div> : null}
                      {overview.review ? (
                        <div style={{ background: '#1b1b1b', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#7a7a7a', marginBottom: 6 }}>Lectura del bloque</div>
                          <div style={{ fontSize: 14, marginBottom: 8 }}>{overview.review.summary}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {overview.review.actions.map((action) => (
                              <span key={action} style={badgeStyle}>{action}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </SectionCard>

                    <SectionCard title="Restricciones activas" subtitle="Lesiones, molestias o reducciones que el sistema tendrá en cuenta al planificar y revisar.">
                      {overview.activeRestrictions.length === 0 ? (
                        <div style={{ fontSize: 13, color: '#7a7a7a' }}>No hay restricciones activas ahora mismo.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 10 }}>
                          {overview.activeRestrictions.map((restriction, index) => (
                            <div key={`${restriction.injuryName}-${restriction.exerciseName ?? 'global'}-${index}`} style={eventCardStyle}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <strong>{restriction.injuryName}</strong>
                                <span style={{ color: '#c8a84b' }}>{restriction.exerciseName ?? 'Sesión completa'}</span>
                              </div>
                              <div style={{ fontSize: 12, color: '#bcbcbc', marginTop: 6 }}>
                                {restriction.reason ? `Motivo: ${restriction.reason}` : 'Restricción activa'}
                                {restriction.restrictionUntil ? ` · revisar hasta ${formatDate(restriction.restrictionUntil)}` : ''}
                                {restriction.loadReductionPercent ? ` · -${restriction.loadReductionPercent}%` : ''}
                                {restriction.loadReductionKg ? ` · -${restriction.loadReductionKg} kg` : ''}
                              </div>
                              {restriction.notes ? <div style={{ fontSize: 12, color: '#7a7a7a', marginTop: 4 }}>{restriction.notes}</div> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Sesiones planificadas" subtitle="La semana se distribuye con tus días preferidos y respeta restricciones activas si las hay.">
                      <div style={{ display: 'grid', gap: 12 }}>
                        {activeBlock.sessions.map((session) => (
                          <div key={session.id} style={{ ...eventCardStyle, background: session.status === 'completed' ? '#111b12' : session.status === 'adapted' ? '#1b1910' : session.status === 'skipped' ? '#241313' : '#101010' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>
                                  Semana {session.weekIndex} · {session.dayLabel} · {session.title}
                                </div>
                                <div style={{ fontSize: 12, color: '#7a7a7a' }}>{session.focus}</div>
                                <div style={{ fontSize: 12, color: '#bcbcbc', marginTop: 6 }}>
                                  {session.exercises.map((exercise) => exercise.exerciseName).join(' · ')}
                                </div>
                              </div>
                              <span style={statusPill(session.status)}>{session.status}</span>
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              {session.exercises.map((exercise) => {
                                const reference = exerciseReferences[exercise.exerciseName]

                                return (
                                  <div key={exercise.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#d0d0d0', paddingBottom: 10, borderBottom: '1px solid #1f1f1f' }}>
                                    <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                                      {reference?.imageUrl ? (
                                        <img
                                          src={reference.imageUrl}
                                          alt={reference.matchedName ?? exercise.exerciseName}
                                          style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #2a2a2a', background: '#0f0f0f' }}
                                        />
                                      ) : null}
                                      <div>
                                        <strong>{exercise.exerciseName}</strong> <span style={{ color: '#7a7a7a' }}>· {exercise.targetSets}x {exercise.minReps}-{exercise.maxReps}</span>
                                        {reference?.matchedName && reference.matchedName !== exercise.exerciseName ? (
                                          <div style={{ color: '#8a8a8a', marginTop: 4 }}>Referencia API: {reference.matchedName}</div>
                                        ) : null}
                                        {reference?.description ? (
                                          <div style={{ color: '#bcbcbc', marginTop: 4, lineHeight: 1.45 }}>{reference.description}</div>
                                        ) : null}
                                        {reference?.category || reference?.equipment.length ? (
                                          <div style={{ color: '#8a8a8a', marginTop: 4 }}>
                                            {[reference.category, reference.equipment.join(' · ')].filter(Boolean).join(' · ')}
                                          </div>
                                        ) : null}
                                        {exercise.notes ? <div style={{ color: '#ffca7a', marginTop: 4 }}>{exercise.notes}</div> : null}
                                      </div>
                                    </div>
                                    <div style={{ color: '#c8a84b', whiteSpace: 'nowrap' }}>{exercise.suggestedWeight ? `${exercise.suggestedWeight} kg` : 'Sin carga base'}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </>
                ) : (
                  <SectionCard title="Sin plan activo">
                    <div style={{ fontSize: 14, color: '#bcbcbc' }}>Empieza desde cero generando un bloque nuevo con tu número de días y tus preferencias semanales.</div>
                  </SectionCard>
                )}

                <SectionCard title="Eventos recientes">
                  {overview.recentEvents.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#7a7a7a' }}>Todavía no hay eventos de seguimiento registrados.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {overview.recentEvents.map((event) => (
                        <div key={event.id} style={eventCardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{event.eventType}</div>
                            <div style={{ fontSize: 12, color: '#7a7a7a' }}>{formatDate(event.date)}</div>
                          </div>
                          <div style={{ fontSize: 12, color: '#bcbcbc', marginTop: 6 }}>
                            {event.exerciseName ? `${event.exerciseName} · ` : ''}
                            {event.reason ?? 'sin motivo específico'}
                            {event.injuryName ? ` · ${event.injuryName}` : ''}
                            {event.loadReductionPercent ? ` · -${event.loadReductionPercent}%` : ''}
                            {event.loadReductionKg ? ` · -${event.loadReductionKg} kg` : ''}
                          </div>
                          {event.notes ? <div style={{ fontSize: 12, color: '#7a7a7a', marginTop: 4 }}>{event.notes}</div> : null}
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
                  <div style={{ fontSize: 14, color: '#bcbcbc' }}>Genera un plan o deja que aparezca una nueva sesión pendiente para registrarla aquí.</div>
                </SectionCard>
              ) : (
                <>
                  <SectionCard title="Registrar sesión" subtitle="Puedes marcarla como completada, saltada o adaptada, y registrar reducciones por lesión o fatiga a nivel de sesión o ejercicio.">
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <select value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value as 'completed' | 'skipped' | 'adapted')} style={inputStyle}>
                        <option value="completed">Completada</option>
                        <option value="adapted">Adaptada</option>
                        <option value="skipped">Saltada</option>
                      </select>
                      <select value={sessionReason} onChange={(event) => setSessionReason(event.target.value as SessionReason | '')} style={inputStyle}>
                        <option value="">Motivo principal</option>
                        {SESSION_REASONS.map((reason) => (
                          <option key={reason.id} value={reason.id}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                      <input value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} placeholder="Notas generales" style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                      <input value={sessionInjuryName} onChange={(event) => setSessionInjuryName(event.target.value)} placeholder="Lesión o molestia" style={inputStyle} />
                      <select value={sessionInjurySeverity} onChange={(event) => setSessionInjurySeverity(event.target.value as '' | 'leve' | 'moderada' | 'alta')} style={inputStyle}>
                        <option value="">Severidad</option>
                        <option value="leve">Leve</option>
                        <option value="moderada">Moderada</option>
                        <option value="alta">Alta</option>
                      </select>
                      <input type="date" value={sessionRestrictionUntil} onChange={(event) => setSessionRestrictionUntil(event.target.value)} style={inputStyle} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <input type="number" step="1" value={sessionReductionPercent} onChange={(event) => setSessionReductionPercent(event.target.value)} placeholder="- % carga" style={inputStyle} />
                        <input type="number" step="0.5" value={sessionReductionKg} onChange={(event) => setSessionReductionKg(event.target.value)} placeholder="- kg" style={inputStyle} />
                      </div>
                    </div>

                    {sessionStatus !== 'skipped' ? (
                      <div style={{ display: 'grid', gap: 14 }}>
                        {sessionDraft.map((exercise, exerciseIndex) => (
                          <div key={exercise.plannedExerciseId} style={eventCardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{exercise.exerciseName}</div>
                                <div style={{ fontSize: 12, color: '#7a7a7a' }}>{exercise.muscleGroup}</div>
                              </div>
                              <button onClick={() => addSetRow(exerciseIndex)} style={secondaryButtonStyle(false)}>
                                <Plus size={12} />
                                Añadir serie
                              </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                              <select value={exercise.adjustmentReason} onChange={(event) => updateExerciseField(exerciseIndex, 'adjustmentReason', event.target.value)} style={inputStyle}>
                                <option value="">Motivo ejercicio</option>
                                {SESSION_REASONS.map((reason) => (
                                  <option key={reason.id} value={reason.id}>
                                    {reason.label}
                                  </option>
                                ))}
                              </select>
                              <input value={exercise.injuryName} onChange={(event) => updateExerciseField(exerciseIndex, 'injuryName', event.target.value)} placeholder="Molestia" style={inputStyle} />
                              <select value={exercise.injurySeverity} onChange={(event) => updateExerciseField(exerciseIndex, 'injurySeverity', event.target.value)} style={inputStyle}>
                                <option value="">Severidad</option>
                                <option value="leve">Leve</option>
                                <option value="moderada">Moderada</option>
                                <option value="alta">Alta</option>
                              </select>
                              <input type="number" step="1" value={exercise.loadReductionPercent} onChange={(event) => updateExerciseField(exerciseIndex, 'loadReductionPercent', event.target.value)} placeholder="- %" style={inputStyle} />
                              <input type="number" step="0.5" value={exercise.loadReductionKg} onChange={(event) => updateExerciseField(exerciseIndex, 'loadReductionKg', event.target.value)} placeholder="- kg" style={inputStyle} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                              <input type="date" value={exercise.restrictionUntil} onChange={(event) => updateExerciseField(exerciseIndex, 'restrictionUntil', event.target.value)} style={inputStyle} />
                              <input value={exercise.notes} onChange={(event) => updateExerciseField(exerciseIndex, 'notes', event.target.value)} placeholder="Notas del ejercicio" style={inputStyle} />
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              {exercise.sets.map((set, setIndex) => (
                                <div key={`${exercise.plannedExerciseId}-${set.setIndex}`} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
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
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f3d88b', fontSize: 13, marginBottom: 16 }}>
                        <AlertTriangle size={16} />
                        La sesión quedará registrada como saltada. No hace falta rellenar ejercicios ni series.
                      </div>
                    )}

                    <button onClick={handleSaveSession} disabled={savingSession} style={{ ...primaryButtonStyle(savingSession), marginTop: 16 }}>
                      <Dumbbell size={14} />
                      {savingSession ? 'Guardando...' : 'Guardar resultado'}
                    </button>
                  </SectionCard>

                  {recommendations && recommendations.length > 0 ? (
                    <SectionCard title="Ajustes automáticos">
                      <div style={{ display: 'grid', gap: 10 }}>
                        {recommendations.map((recommendation) => (
                          <div key={`${recommendation.exerciseName}-${recommendation.decision}`} style={eventCardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                              <strong>{recommendation.exerciseName}</strong>
                              <span style={{ color: recommendation.decision === 'increase' ? '#7ee787' : recommendation.decision === 'decrease' ? '#ff8b7b' : '#c8a84b' }}>
                                {recommendation.nextWeight ? `${recommendation.nextWeight} kg` : 'Sin cambio de carga'}
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
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={historyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis dataKey="date" stroke="#7a7a7a" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#7a7a7a" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, color: '#f5f2ee', fontSize: 12 }} formatter={(value: number) => [`${value} kg`, 'Peso máximo']} />
                        <Line type="monotone" dataKey="maxWeight" stroke="#d63c2a" strokeWidth={2} dot={{ fill: '#d63c2a', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ fontSize: 13, color: '#7a7a7a' }}>Selecciona un ejercicio con historial para ver su progresión.</div>
                  )}
                </SectionCard>

                {selectedExerciseSuggestions.length > 0 ? (
                  <SectionCard title="Siguientes exposiciones previstas">
                    <div style={{ display: 'grid', gap: 10 }}>
                      {selectedExerciseSuggestions.map((entry) => (
                        <div key={`${entry.weekIndex}-${entry.title}-${entry.dayLabel}`} style={eventCardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>Semana {entry.weekIndex} · {entry.dayLabel}</div>
                              <div style={{ fontSize: 12, color: '#7a7a7a' }}>{entry.title} · {entry.repRange} reps</div>
                            </div>
                            <div style={{ color: '#c8a84b', fontWeight: 600 }}>{entry.suggestedWeight ? `${entry.suggestedWeight} kg` : 'Sin sugerencia'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                ) : null}

                <SectionCard title="Sesiones y contexto">
                  {overview.completedSessions.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#7a7a7a' }}>Todavía no hay sesiones registradas.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {overview.completedSessions.map((session) => (
                        <div key={session.id} style={eventCardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{session.title}</div>
                              <div style={{ fontSize: 12, color: '#7a7a7a' }}>
                                {formatDate(session.performedAt)}{session.dayLabel ? ` · ${session.dayLabel}` : ''} · {session.sessionStatus}
                                {session.reason ? ` · ${session.reason}` : ''}
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#c8a84b' }}>
                              {session.durationMinutes ? `${session.durationMinutes} min` : 'Duración libre'} · Energía {session.energy ?? '-'}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#bcbcbc', marginTop: 8 }}>{session.exercises.join(' · ') || 'Sin ejercicios registrados'}</div>
                          {session.injuryName || session.loadReductionPercent || session.loadReductionKg ? (
                            <div style={{ fontSize: 12, color: '#ffca7a', marginTop: 6 }}>
                              {session.injuryName ? `${session.injuryName}` : 'Adaptación'}
                              {session.restrictionUntil ? ` · hasta ${formatDate(session.restrictionUntil)}` : ''}
                              {session.loadReductionPercent ? ` · -${session.loadReductionPercent}%` : ''}
                              {session.loadReductionKg ? ` · -${session.loadReductionKg} kg` : ''}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {overview.review ? (
                  <SectionCard title="Estado del bloque">
                    <div style={{ fontSize: 14, marginBottom: 10 }}>{overview.review.summary}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {overview.review.actions.map((action) => (
                        <span key={action} style={badgeStyle}>{action}</span>
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
                          <button onClick={() => handleDeleteWeight(entry.id)} style={{ ...secondaryButtonStyle(false), padding: '6px 10px' }}>
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
      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: 1, color: '#c8a84b' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
    </div>
  )
}

function statusPill(status: string): CSSProperties {
  const tones: Record<string, { background: string; color: string }> = {
    planned: { background: '#2a2a2a', color: '#d0d0d0' },
    completed: { background: '#315a37', color: '#d5f5d8' },
    adapted: { background: '#5a4a1f', color: '#ffe9a8' },
    skipped: { background: '#5c2323', color: '#ffb3b3' },
  }
  const tone = tones[status] ?? tones.planned
  return { fontSize: 11, padding: '4px 10px', borderRadius: 999, background: tone.background, color: tone.color }
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

const chipStyle: CSSProperties = {
  border: '1px solid #3d3d3d',
  borderRadius: 999,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 12,
}

const badgeStyle: CSSProperties = {
  background: '#2a2a2a',
  color: '#d0d0d0',
  borderRadius: 999,
  padding: '5px 10px',
  fontSize: 11,
}

const eventCardStyle: CSSProperties = {
  background: '#101010',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  padding: 12,
}

const errorBannerStyle: CSSProperties = {
  background: 'rgba(214,60,42,0.12)',
  border: '1px solid rgba(214,60,42,0.35)',
  color: '#ff9f92',
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
}

const infoBannerStyle: CSSProperties = {
  background: 'rgba(200,168,75,0.12)',
  border: '1px solid rgba(200,168,75,0.35)',
  color: '#f3d88b',
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
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

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    background: '#2a2a2a',
    border: '1px solid #3d3d3d',
    borderRadius: 6,
    padding: '10px 18px',
    color: '#f5f2ee',
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
}

function dangerButtonStyle(disabled: boolean): CSSProperties {
  return {
    background: '#5c2323',
    border: '1px solid #7d3636',
    borderRadius: 6,
    padding: '10px 18px',
    color: '#fff',
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
}
