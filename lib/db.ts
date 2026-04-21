import { sql } from '@/lib/sql'
import { getBlockDateRange } from '@/lib/training/planner'
import { evaluateExercisePerformance, reviewBlockProgress } from '@/lib/training/progression'
import type {
  ActiveRestriction,
  BlockReview,
  CompletedExerciseInput,
  CompletedSessionInput,
  CompletedSessionSummary,
  ExerciseProgressPoint,
  ExerciseRecommendation,
  InjurySeverity,
  MuscleGroup,
  PlannedExercise,
  PlannedSession,
  SessionReason,
  SessionStatus,
  TrainingBlock,
  TrainingBlockBlueprint,
  TrainingEvent,
  TrainingEventType,
  Weekday,
} from '@/lib/training/types'

type PlannedSessionRow = {
  id: number
  block_id: number
  week_index: number
  day_index: number
  day_label: Weekday
  title: string
  focus: string
  notes: string | null
  status: SessionStatus
  completed_session_id: number | null
}

type PlannedExerciseRow = {
  id: number
  session_id: number
  exercise_id: number | null
  exercise_name: string
  muscle_group: MuscleGroup
  order_index: number
  target_sets: number
  min_reps: number
  max_reps: number
  target_rir: number | null
  suggested_weight: string | null
  notes: string | null
}

type TrainingBlockRow = {
  id: number
  title: string
  goal: string
  start_date: string | Date
  end_date: string | Date
  weeks: number
  status: TrainingBlock['status']
  notes: string | null
  rationale: string | null
  generated_by: 'rules' | 'ai'
  training_days_per_week: number
  preferred_weekdays: string
  created_at: string
}

type CompletedSessionRow = {
  id: number
  planned_session_id: number | null
  block_id: number | null
  performed_at: string | Date
  session_status: Exclude<SessionStatus, 'planned'>
  reason: SessionReason | null
  duration_minutes: number | null
  energy: number | null
  injury_name: string | null
  injury_severity: InjurySeverity | null
  restriction_until: string | Date | null
  load_reduction_percent: string | null
  load_reduction_kg: string | null
  notes: string | null
  created_at: string
}

type CompletedSetRow = {
  id: number
  completed_session_id: number
  planned_exercise_id: number | null
  exercise_id: number | null
  exercise_name: string
  muscle_group: MuscleGroup
  set_index: number
  reps: number
  weight: string
  rir: number | null
  is_warmup: boolean
  adjustment_reason: SessionReason | null
  injury_name: string | null
  injury_severity: InjurySeverity | null
  restriction_until: string | Date | null
  load_reduction_percent: string | null
  load_reduction_kg: string | null
  notes: string | null
}

type TrainingEventRow = {
  id: number
  event_date: string | Date
  event_type: TrainingEventType
  reason: SessionReason | null
  session_status: Exclude<SessionStatus, 'planned'> | null
  exercise_name: string | null
  injury_name: string | null
  injury_severity: InjurySeverity | null
  restriction_until: string | Date | null
  load_reduction_percent: string | null
  load_reduction_kg: string | null
  notes: string | null
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value !== '') return Number.parseFloat(value)
  return null
}

function normalizeIsoDate(value: string | Date | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'string') return value.split('T')[0]
  if (typeof (value as { toISOString?: () => string }).toISOString === 'function') {
    return (value as { toISOString: () => string }).toISOString().split('T')[0]
  }
  return String(value)
}

function serializeWeekdays(weekdays: Weekday[]) {
  return JSON.stringify(weekdays)
}

function parseWeekdays(value: string | null | undefined): Weekday[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as Weekday[]) : []
  } catch {
    return []
  }
}

function mapTrainingEvent(row: TrainingEventRow): TrainingEvent {
  return {
    id: row.id,
    date: normalizeIsoDate(row.event_date) ?? '',
    eventType: row.event_type,
    reason: row.reason,
    sessionStatus: row.session_status,
    exerciseName: row.exercise_name,
    injuryName: row.injury_name,
    injurySeverity: row.injury_severity,
    restrictionUntil: normalizeIsoDate(row.restriction_until),
    loadReductionPercent: toNumber(row.load_reduction_percent),
    loadReductionKg: toNumber(row.load_reduction_kg),
    notes: row.notes,
  }
}

async function ensureExerciseCatalogEntry(name: string, muscleGroup: MuscleGroup) {
  const existing = await sql`
    SELECT id FROM exercise_catalog WHERE name = ${name} LIMIT 1
  `
  if (existing.rows[0]?.id) return existing.rows[0].id as number

  const inserted = await sql`
    INSERT INTO exercise_catalog (name, muscle_group)
    VALUES (${name}, ${muscleGroup})
    ON CONFLICT (name) DO UPDATE SET muscle_group = EXCLUDED.muscle_group
    RETURNING id
  `

  return inserted.rows[0].id as number
}

function mapBlockRows(
  block: TrainingBlockRow,
  sessionRows: PlannedSessionRow[],
  exerciseRows: PlannedExerciseRow[]
): TrainingBlock {
  const sessions: PlannedSession[] = sessionRows.map((session) => ({
    id: session.id,
    blockId: session.block_id,
    weekIndex: session.week_index,
    dayIndex: session.day_index,
    dayLabel: session.day_label,
    title: session.title,
    focus: session.focus,
    notes: session.notes,
    status: session.status,
    completedSessionId: session.completed_session_id,
    exercises: exerciseRows
      .filter((exercise) => exercise.session_id === session.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map(
        (exercise): PlannedExercise => ({
          id: exercise.id,
          sessionId: exercise.session_id,
          exerciseId: exercise.exercise_id,
          exerciseName: exercise.exercise_name,
          muscleGroup: exercise.muscle_group,
          orderIndex: exercise.order_index,
          targetSets: exercise.target_sets,
          minReps: exercise.min_reps,
          maxReps: exercise.max_reps,
          targetRir: exercise.target_rir,
          suggestedWeight: toNumber(exercise.suggested_weight),
          notes: exercise.notes,
        })
      ),
  }))

  return {
    id: block.id,
    title: block.title,
    goal: block.goal,
    startDate: normalizeIsoDate(block.start_date) ?? '',
    endDate: normalizeIsoDate(block.end_date) ?? '',
    weeks: block.weeks,
    status: block.status,
    notes: block.notes,
    rationale: block.rationale,
    generatedBy: block.generated_by,
    createdAt: block.created_at,
    trainingDaysPerWeek: block.training_days_per_week,
    preferredWeekdays: parseWeekdays(block.preferred_weekdays),
    sessions,
  }
}

async function getBlockById(blockId: number) {
  const blockResult = await sql`
    SELECT * FROM training_blocks WHERE id = ${blockId} LIMIT 1
  `
  const block = blockResult.rows[0] as TrainingBlockRow | undefined
  if (!block) return null

  const [sessionsResult, exercisesResult] = await Promise.all([
    sql`
      SELECT * FROM planned_sessions
      WHERE block_id = ${blockId}
      ORDER BY week_index ASC, day_index ASC, id ASC
    `,
    sql`
      SELECT pe.*
      FROM planned_exercises pe
      JOIN planned_sessions ps ON ps.id = pe.session_id
      WHERE ps.block_id = ${blockId}
      ORDER BY ps.week_index ASC, ps.day_index ASC, pe.order_index ASC
    `,
  ])

  return mapBlockRows(block, sessionsResult.rows as PlannedSessionRow[], exercisesResult.rows as PlannedExerciseRow[])
}

async function getPlannedSessionWithExercises(sessionId: number) {
  const sessionResult = await sql`
    SELECT * FROM planned_sessions WHERE id = ${sessionId} LIMIT 1
  `
  const session = sessionResult.rows[0] as PlannedSessionRow | undefined
  if (!session) return null

  const exercisesResult = await sql`
    SELECT * FROM planned_exercises
    WHERE session_id = ${sessionId}
    ORDER BY order_index ASC
  `

  return {
    session,
    exercises: exercisesResult.rows as PlannedExerciseRow[],
  }
}

function mergeProgressRows(
  legacyRows: Array<{ date: string | Date; max_weight: string; total_sets: string }>,
  modernRows: Array<{ date: string | Date; max_weight: string; total_sets: string }>
) {
  const merged = new Map<string, ExerciseProgressPoint>()

  ;[...legacyRows, ...modernRows].forEach((row) => {
    const key = normalizeIsoDate(row.date)
    if (!key) return
    const current = merged.get(key)
    const maxWeight = Number.parseFloat(row.max_weight)
    const totalSets = Number.parseInt(row.total_sets, 10)

    if (!current) {
      merged.set(key, { date: key, maxWeight, totalSets })
      return
    }

    merged.set(key, {
      date: key,
      maxWeight: Math.max(current.maxWeight, maxWeight),
      totalSets: current.totalSets + totalSets,
    })
  })

  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date))
}

async function createTrainingEvent(input: {
  date: string
  blockId?: number | null
  plannedSessionId?: number | null
  completedSessionId?: number | null
  eventType: TrainingEventType
  reason?: SessionReason | null
  sessionStatus?: Exclude<SessionStatus, 'planned'> | null
  exerciseName?: string | null
  injuryName?: string | null
  injurySeverity?: InjurySeverity | null
  restrictionUntil?: string | null
  loadReductionPercent?: number | null
  loadReductionKg?: number | null
  notes?: string | null
}) {
  await sql`
    INSERT INTO training_events (
      event_date, block_id, planned_session_id, completed_session_id, event_type, reason, session_status,
      exercise_name, injury_name, injury_severity, restriction_until, load_reduction_percent, load_reduction_kg, notes
    )
    VALUES (
      ${input.date},
      ${input.blockId ?? null},
      ${input.plannedSessionId ?? null},
      ${input.completedSessionId ?? null},
      ${input.eventType},
      ${input.reason ?? null},
      ${input.sessionStatus ?? null},
      ${input.exerciseName ?? null},
      ${input.injuryName ?? null},
      ${input.injurySeverity ?? null},
      ${input.restrictionUntil ?? null},
      ${input.loadReductionPercent ?? null},
      ${input.loadReductionKg ?? null},
      ${input.notes ?? null}
    )
  `
}

async function applyRecommendationsToFutureExercises(
  blockId: number,
  currentSession: PlannedSessionRow,
  recommendations: ExerciseRecommendation[]
) {
  for (const recommendation of recommendations) {
    if (recommendation.nextWeight === null) continue

    await sql`
      UPDATE planned_exercises pe
      SET suggested_weight = ${recommendation.nextWeight}
      FROM planned_sessions ps
      WHERE pe.session_id = ps.id
        AND ps.block_id = ${blockId}
        AND ps.status = 'planned'
        AND pe.exercise_name = ${recommendation.exerciseName}
        AND (
          ps.week_index > ${currentSession.week_index}
          OR (ps.week_index = ${currentSession.week_index} AND ps.day_index > ${currentSession.day_index})
        )
    `
  }
}

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS body_weight (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      weight NUMERIC(5,2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS exercise_logs (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      exercise TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      sets INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight NUMERIC(6,2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS exercise_catalog (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
      movement_pattern TEXT,
      equipment TEXT,
      is_compound BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS training_blocks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      weeks INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      rationale TEXT,
      generated_by TEXT NOT NULL DEFAULT 'rules',
      training_days_per_week INTEGER NOT NULL DEFAULT 4,
      preferred_weekdays TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS planned_sessions (
      id SERIAL PRIMARY KEY,
      block_id INTEGER NOT NULL REFERENCES training_blocks(id) ON DELETE CASCADE,
      week_index INTEGER NOT NULL,
      day_index INTEGER NOT NULL,
      day_label TEXT NOT NULL,
      title TEXT NOT NULL,
      focus TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      completed_session_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS planned_exercises (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES planned_sessions(id) ON DELETE CASCADE,
      exercise_id INTEGER REFERENCES exercise_catalog(id) ON DELETE SET NULL,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      target_sets INTEGER NOT NULL,
      min_reps INTEGER NOT NULL,
      max_reps INTEGER NOT NULL,
      target_rir INTEGER,
      suggested_weight NUMERIC(6,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS completed_sessions (
      id SERIAL PRIMARY KEY,
      planned_session_id INTEGER REFERENCES planned_sessions(id) ON DELETE SET NULL,
      block_id INTEGER REFERENCES training_blocks(id) ON DELETE SET NULL,
      performed_at DATE NOT NULL,
      session_status TEXT NOT NULL DEFAULT 'completed',
      reason TEXT,
      duration_minutes INTEGER,
      energy INTEGER,
      injury_name TEXT,
      injury_severity TEXT,
      restriction_until DATE,
      load_reduction_percent NUMERIC(5,2),
      load_reduction_kg NUMERIC(6,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS completed_sets (
      id SERIAL PRIMARY KEY,
      completed_session_id INTEGER NOT NULL REFERENCES completed_sessions(id) ON DELETE CASCADE,
      planned_exercise_id INTEGER REFERENCES planned_exercises(id) ON DELETE SET NULL,
      exercise_id INTEGER REFERENCES exercise_catalog(id) ON DELETE SET NULL,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight NUMERIC(6,2) NOT NULL,
      rir INTEGER,
      is_warmup BOOLEAN DEFAULT FALSE,
      adjustment_reason TEXT,
      injury_name TEXT,
      injury_severity TEXT,
      restriction_until DATE,
      load_reduction_percent NUMERIC(5,2),
      load_reduction_kg NUMERIC(6,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS training_events (
      id SERIAL PRIMARY KEY,
      event_date DATE NOT NULL,
      block_id INTEGER REFERENCES training_blocks(id) ON DELETE SET NULL,
      planned_session_id INTEGER REFERENCES planned_sessions(id) ON DELETE SET NULL,
      completed_session_id INTEGER REFERENCES completed_sessions(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      reason TEXT,
      session_status TEXT,
      exercise_name TEXT,
      injury_name TEXT,
      injury_severity TEXT,
      restriction_until DATE,
      load_reduction_percent NUMERIC(5,2),
      load_reduction_kg NUMERIC(6,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_exercise_logs_exercise_date ON exercise_logs (exercise, date DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_planned_sessions_block_week_day ON planned_sessions (block_id, week_index, day_index)`
  await sql`CREATE INDEX IF NOT EXISTS idx_planned_exercises_session_order ON planned_exercises (session_id, order_index)`
  await sql`CREATE INDEX IF NOT EXISTS idx_completed_sets_exercise_date ON completed_sets (exercise_name, completed_session_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_training_events_date ON training_events (event_date DESC, created_at DESC)`

  await sql`ALTER TABLE training_blocks ADD COLUMN IF NOT EXISTS training_days_per_week INTEGER NOT NULL DEFAULT 4`
  await sql`ALTER TABLE training_blocks ADD COLUMN IF NOT EXISTS preferred_weekdays TEXT NOT NULL DEFAULT '[]'`
  await sql`ALTER TABLE completed_sessions ADD COLUMN IF NOT EXISTS session_status TEXT NOT NULL DEFAULT 'completed'`
  await sql`ALTER TABLE completed_sessions ADD COLUMN IF NOT EXISTS reason TEXT`
  await sql`ALTER TABLE completed_sessions ADD COLUMN IF NOT EXISTS injury_name TEXT`
  await sql`ALTER TABLE completed_sessions ADD COLUMN IF NOT EXISTS injury_severity TEXT`
  await sql`ALTER TABLE completed_sessions ADD COLUMN IF NOT EXISTS restriction_until DATE`
  await sql`ALTER TABLE completed_sessions ADD COLUMN IF NOT EXISTS load_reduction_percent NUMERIC(5,2)`
  await sql`ALTER TABLE completed_sessions ADD COLUMN IF NOT EXISTS load_reduction_kg NUMERIC(6,2)`
  await sql`ALTER TABLE completed_sets ADD COLUMN IF NOT EXISTS adjustment_reason TEXT`
  await sql`ALTER TABLE completed_sets ADD COLUMN IF NOT EXISTS injury_name TEXT`
  await sql`ALTER TABLE completed_sets ADD COLUMN IF NOT EXISTS injury_severity TEXT`
  await sql`ALTER TABLE completed_sets ADD COLUMN IF NOT EXISTS restriction_until DATE`
  await sql`ALTER TABLE completed_sets ADD COLUMN IF NOT EXISTS load_reduction_percent NUMERIC(5,2)`
  await sql`ALTER TABLE completed_sets ADD COLUMN IF NOT EXISTS load_reduction_kg NUMERIC(6,2)`
}

export async function getBodyWeights() {
  const result = await sql`
    SELECT * FROM body_weight ORDER BY date DESC LIMIT 52
  `
  return result.rows
}

export async function addBodyWeight(date: string, weight: number, notes?: string) {
  const result = await sql`
    INSERT INTO body_weight (date, weight, notes)
    VALUES (${date}, ${weight}, ${notes ?? null})
    RETURNING *
  `
  return result.rows[0]
}

export async function deleteBodyWeight(id: number) {
  await sql`DELETE FROM body_weight WHERE id = ${id}`
}

export async function getExerciseLogs(limit = 100) {
  const result = await sql`
    SELECT * FROM exercise_logs ORDER BY date DESC, created_at DESC LIMIT ${limit}
  `
  return result.rows
}

export async function getExerciseHistory(exercise: string) {
  const [legacy, modern] = await Promise.all([
    sql`
      SELECT date, MAX(weight) AS max_weight, SUM(sets)::text AS total_sets
      FROM exercise_logs
      WHERE exercise = ${exercise}
      GROUP BY date
      ORDER BY date ASC
      LIMIT 30
    `,
    sql`
      SELECT cs.performed_at AS date, MAX(cset.weight) AS max_weight, COUNT(*)::text AS total_sets
      FROM completed_sets cset
      JOIN completed_sessions cs ON cs.id = cset.completed_session_id
      WHERE cset.exercise_name = ${exercise}
        AND cset.is_warmup = FALSE
        AND cs.session_status <> 'skipped'
      GROUP BY cs.performed_at
      ORDER BY cs.performed_at ASC
      LIMIT 30
    `,
  ])

  return mergeProgressRows(
    legacy.rows as Array<{ date: string | Date; max_weight: string; total_sets: string }>,
    modern.rows as Array<{ date: string | Date; max_weight: string; total_sets: string }>
  )
}

export async function getExerciseHistoryMap(limit = 250) {
  const [legacy, modern] = await Promise.all([
    sql`
      SELECT exercise, date, MAX(weight) AS max_weight, SUM(sets)::text AS total_sets
      FROM exercise_logs
      GROUP BY exercise, date
      ORDER BY date ASC
      LIMIT ${limit}
    `,
    sql`
      SELECT cset.exercise_name AS exercise, cs.performed_at AS date, MAX(cset.weight) AS max_weight, COUNT(*)::text AS total_sets
      FROM completed_sets cset
      JOIN completed_sessions cs ON cs.id = cset.completed_session_id
      WHERE cset.is_warmup = FALSE
        AND cs.session_status <> 'skipped'
      GROUP BY cset.exercise_name, cs.performed_at
      ORDER BY cs.performed_at ASC
      LIMIT ${limit}
    `,
  ])

  const map = new Map<string, Array<{ date: string | Date; max_weight: string; total_sets: string }>>()
  for (const row of [...legacy.rows, ...modern.rows] as Array<{ exercise: string; date: string | Date; max_weight: string; total_sets: string }>) {
    const entries = map.get(row.exercise) ?? []
    entries.push({ date: row.date, max_weight: row.max_weight, total_sets: row.total_sets })
    map.set(row.exercise, entries)
  }

  return Object.fromEntries(Array.from(map.entries()).map(([exercise, rows]) => [exercise, mergeProgressRows(rows, [])])) as Record<
    string,
    ExerciseProgressPoint[]
  >
}

export async function addExerciseLog(
  date: string,
  exercise: string,
  muscleGroup: string,
  sets: number,
  reps: number,
  weight: number,
  notes?: string
) {
  await ensureExerciseCatalogEntry(exercise, muscleGroup as MuscleGroup)
  const result = await sql`
    INSERT INTO exercise_logs (date, exercise, muscle_group, sets, reps, weight, notes)
    VALUES (${date}, ${exercise}, ${muscleGroup}, ${sets}, ${reps}, ${weight}, ${notes ?? null})
    RETURNING *
  `
  return result.rows[0]
}

export async function deleteExerciseLog(id: number) {
  await sql`DELETE FROM exercise_logs WHERE id = ${id}`
}

export async function getExerciseNames() {
  const result = await sql`
    SELECT exercise, muscle_group FROM (
      SELECT DISTINCT exercise, muscle_group FROM exercise_logs
      UNION
      SELECT name AS exercise, muscle_group FROM exercise_catalog
      UNION
      SELECT DISTINCT exercise_name AS exercise, muscle_group FROM planned_exercises
    ) all_exercises
    ORDER BY exercise
  `
  return result.rows
}

export async function getExerciseCatalog() {
  const result = await sql`
    SELECT * FROM exercise_catalog ORDER BY muscle_group, name
  `
  return result.rows
}

export async function getRecentTrainingEvents(limit = 20) {
  const result = await sql`
    SELECT * FROM training_events
    ORDER BY event_date DESC, created_at DESC
    LIMIT ${limit}
  `
  return (result.rows as TrainingEventRow[]).map(mapTrainingEvent)
}

export async function getActiveRestrictions(): Promise<ActiveRestriction[]> {
  const result = await sql`
    SELECT * FROM training_events
    WHERE injury_name IS NOT NULL
      AND (restriction_until IS NULL OR restriction_until >= CURRENT_DATE)
    ORDER BY event_date DESC, created_at DESC
    LIMIT 25
  `

  const seen = new Set<string>()
  const restrictions: ActiveRestriction[] = []

  for (const row of result.rows as TrainingEventRow[]) {
    const key = `${row.exercise_name ?? 'global'}-${row.injury_name ?? ''}-${normalizeIsoDate(row.restriction_until) ?? 'none'}`
    if (seen.has(key)) continue
    seen.add(key)
    restrictions.push({
      exerciseName: row.exercise_name,
      injuryName: row.injury_name ?? 'molestia activa',
      injurySeverity: row.injury_severity,
      reason: row.reason,
      restrictionUntil: normalizeIsoDate(row.restriction_until),
      notes: row.notes,
      loadReductionPercent: toNumber(row.load_reduction_percent),
      loadReductionKg: toNumber(row.load_reduction_kg),
    })
  }

  return restrictions
}

export async function getActiveTrainingBlock() {
  const result = await sql`
    SELECT * FROM training_blocks
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const row = result.rows[0] as TrainingBlockRow | undefined
  if (!row) return null
  return getBlockById(row.id)
}

export async function createTrainingBlock(blueprint: TrainingBlockBlueprint) {
  const { endDate } = getBlockDateRange(blueprint.startDate, blueprint.weeks)

  await sql`
    UPDATE training_blocks
    SET status = CASE WHEN status = 'active' THEN 'completed' ELSE status END
    WHERE status = 'active'
  `

  const blockInsert = await sql`
    INSERT INTO training_blocks (
      title, goal, start_date, end_date, weeks, status, notes, rationale, generated_by,
      training_days_per_week, preferred_weekdays
    )
    VALUES (
      ${blueprint.title},
      ${blueprint.goal},
      ${blueprint.startDate},
      ${endDate},
      ${blueprint.weeks},
      'active',
      ${blueprint.notes ?? null},
      ${blueprint.rationale ?? null},
      ${blueprint.generatedBy},
      ${blueprint.trainingDaysPerWeek},
      ${serializeWeekdays(blueprint.preferredWeekdays)}
    )
    RETURNING id
  `

  const blockId = blockInsert.rows[0].id as number

  for (const session of blueprint.sessions) {
    const sessionInsert = await sql`
      INSERT INTO planned_sessions (block_id, week_index, day_index, day_label, title, focus, notes)
      VALUES (
        ${blockId},
        ${session.weekIndex},
        ${session.dayIndex},
        ${session.dayLabel},
        ${session.title},
        ${session.focus},
        ${session.notes ?? null}
      )
      RETURNING id
    `
    const sessionId = sessionInsert.rows[0].id as number

    for (const exercise of session.exercises) {
      const exerciseId = await ensureExerciseCatalogEntry(exercise.exerciseName, exercise.muscleGroup)
      await sql`
        INSERT INTO planned_exercises (
          session_id, exercise_id, exercise_name, muscle_group, order_index,
          target_sets, min_reps, max_reps, target_rir, suggested_weight, notes
        )
        VALUES (
          ${sessionId},
          ${exerciseId},
          ${exercise.exerciseName},
          ${exercise.muscleGroup},
          ${exercise.orderIndex},
          ${exercise.targetSets},
          ${exercise.minReps},
          ${exercise.maxReps},
          ${exercise.targetRir},
          ${exercise.suggestedWeight},
          ${exercise.notes ?? null}
        )
      `
    }
  }

  return getBlockById(blockId)
}

export async function deleteActiveTrainingBlock() {
  const active = await getActiveTrainingBlock()
  if (!active) return { deleted: false }

  await createTrainingEvent({
    date: new Date().toISOString().split('T')[0],
    blockId: active.id,
    eventType: 'plan_deleted',
    notes: 'Plan activo eliminado manualmente para regenerar otro.',
  })

  await sql`DELETE FROM training_blocks WHERE id = ${active.id}`
  return { deleted: true, deletedBlockId: active.id }
}

export async function resetAllTrainingData() {
  await sql`
    TRUNCATE TABLE
      training_events,
      completed_sets,
      completed_sessions,
      planned_exercises,
      planned_sessions,
      training_blocks,
      exercise_logs,
      body_weight
    RESTART IDENTITY CASCADE
  `
  await sql`DELETE FROM exercise_catalog`
  return { ok: true }
}

async function persistExerciseEvents(
  exercise: CompletedExerciseInput,
  input: CompletedSessionInput,
  blockId: number | null,
  completedSessionId: number,
  plannedSessionId: number | null
) {
  const hasAdjustment =
    Boolean(exercise.injuryName) ||
    Boolean((exercise.loadReductionPercent ?? 0) > 0) ||
    Boolean((exercise.loadReductionKg ?? 0) > 0) ||
    Boolean(exercise.adjustmentReason)

  if (!hasAdjustment) return

  await createTrainingEvent({
    date: input.performedAt,
    blockId,
    plannedSessionId,
    completedSessionId,
    eventType: exercise.injuryName ? 'injury' : 'adaptation',
    reason: exercise.adjustmentReason ?? input.reason ?? null,
    sessionStatus: input.sessionStatus,
    exerciseName: exercise.exerciseName,
    injuryName: exercise.injuryName ?? null,
    injurySeverity: exercise.injurySeverity ?? null,
    restrictionUntil: exercise.restrictionUntil ?? null,
    loadReductionPercent: exercise.loadReductionPercent ?? null,
    loadReductionKg: exercise.loadReductionKg ?? null,
    notes: exercise.notes ?? null,
  })
}

export async function saveCompletedSession(input: CompletedSessionInput) {
  const plannedContext = input.plannedSessionId ? await getPlannedSessionWithExercises(input.plannedSessionId) : null
  const blockId = plannedContext?.session.block_id ?? null

  const sessionInsert = await sql`
    INSERT INTO completed_sessions (
      planned_session_id, block_id, performed_at, session_status, reason, duration_minutes, energy,
      injury_name, injury_severity, restriction_until, load_reduction_percent, load_reduction_kg, notes
    )
    VALUES (
      ${input.plannedSessionId ?? null},
      ${blockId},
      ${input.performedAt},
      ${input.sessionStatus},
      ${input.reason ?? null},
      ${input.durationMinutes ?? null},
      ${input.energy ?? null},
      ${input.injuryName ?? null},
      ${input.injurySeverity ?? null},
      ${input.restrictionUntil ?? null},
      ${input.loadReductionPercent ?? null},
      ${input.loadReductionKg ?? null},
      ${input.notes ?? null}
    )
    RETURNING *
  `

  const completedSession = sessionInsert.rows[0] as CompletedSessionRow
  const recommendations: ExerciseRecommendation[] = []

  if (input.sessionStatus === 'skipped') {
    await createTrainingEvent({
      date: input.performedAt,
      blockId,
      plannedSessionId: input.plannedSessionId ?? null,
      completedSessionId: completedSession.id,
      eventType: 'skip',
      reason: input.reason ?? null,
      sessionStatus: input.sessionStatus,
      injuryName: input.injuryName ?? null,
      injurySeverity: input.injurySeverity ?? null,
      restrictionUntil: input.restrictionUntil ?? null,
      notes: input.notes ?? null,
    })
  }

  for (const exercise of input.exercises) {
    const matchedPlan = plannedContext?.exercises.find((planned) => planned.id === exercise.plannedExerciseId)
    const exerciseId = await ensureExerciseCatalogEntry(exercise.exerciseName, exercise.muscleGroup)

    for (const set of exercise.sets) {
      await sql`
        INSERT INTO completed_sets (
          completed_session_id, planned_exercise_id, exercise_id, exercise_name,
          muscle_group, set_index, reps, weight, rir, is_warmup, adjustment_reason,
          injury_name, injury_severity, restriction_until, load_reduction_percent, load_reduction_kg, notes
        )
        VALUES (
          ${completedSession.id},
          ${exercise.plannedExerciseId ?? null},
          ${exerciseId},
          ${exercise.exerciseName},
          ${exercise.muscleGroup},
          ${set.setIndex},
          ${set.reps},
          ${set.weight},
          ${set.rir ?? null},
          ${set.isWarmup ?? false},
          ${exercise.adjustmentReason ?? null},
          ${exercise.injuryName ?? null},
          ${exercise.injurySeverity ?? null},
          ${exercise.restrictionUntil ?? null},
          ${exercise.loadReductionPercent ?? null},
          ${exercise.loadReductionKg ?? null},
          ${set.notes ?? exercise.notes ?? null}
        )
      `
    }

    await persistExerciseEvents(exercise, input, blockId, completedSession.id, input.plannedSessionId ?? null)

    if (matchedPlan) {
      recommendations.push(
        evaluateExercisePerformance({
          exerciseName: matchedPlan.exercise_name,
          targetSets: matchedPlan.target_sets,
          minReps: matchedPlan.min_reps,
          maxReps: matchedPlan.max_reps,
          targetRir: matchedPlan.target_rir,
          suggestedWeight: toNumber(matchedPlan.suggested_weight),
          sessionStatus: input.sessionStatus,
          sessionReason: input.reason ?? exercise.adjustmentReason ?? null,
          loadReductionPercent: exercise.loadReductionPercent ?? input.loadReductionPercent ?? null,
          loadReductionKg: exercise.loadReductionKg ?? input.loadReductionKg ?? null,
          injuryName: exercise.injuryName ?? input.injuryName ?? null,
          sets: exercise.sets,
        })
      )
    }
  }

  if (plannedContext) {
    await sql`
      UPDATE planned_sessions
      SET status = ${input.sessionStatus}, completed_session_id = ${completedSession.id}
      WHERE id = ${plannedContext.session.id}
    `

    if (input.sessionStatus !== 'skipped') {
      await applyRecommendationsToFutureExercises(plannedContext.session.block_id, plannedContext.session, recommendations)
    }
  }

  if (input.sessionStatus === 'adapted' && !input.injuryName && !input.reason && !input.loadReductionPercent && !input.loadReductionKg) {
    await createTrainingEvent({
      date: input.performedAt,
      blockId,
      plannedSessionId: input.plannedSessionId ?? null,
      completedSessionId: completedSession.id,
      eventType: 'adaptation',
      sessionStatus: input.sessionStatus,
      notes: input.notes ?? 'Sesión adaptada sin detalle adicional.',
    })
  }

  return { completedSession, recommendations }
}

export async function getCompletedSessions(limit = 20): Promise<CompletedSessionSummary[]> {
  const sessionsResult = await sql`
    SELECT cs.*, ps.title AS planned_title, ps.day_label AS planned_day_label
    FROM completed_sessions cs
    LEFT JOIN planned_sessions ps ON ps.id = cs.planned_session_id
    ORDER BY cs.performed_at DESC, cs.created_at DESC
    LIMIT ${limit}
  `

  const setsResult = await sql`
    SELECT * FROM completed_sets
    WHERE completed_session_id IN (
      SELECT id FROM completed_sessions
      ORDER BY performed_at DESC, created_at DESC
      LIMIT ${limit}
    )
    ORDER BY completed_session_id DESC, exercise_name ASC, set_index ASC
  `

  const setsBySession = new Map<number, CompletedSetRow[]>()
  for (const row of setsResult.rows as CompletedSetRow[]) {
    const current = setsBySession.get(row.completed_session_id) ?? []
    current.push(row)
    setsBySession.set(row.completed_session_id, current)
  }

  return (sessionsResult.rows as Array<CompletedSessionRow & { planned_title: string | null; planned_day_label: string | null }>).map(
    (session) => ({
      id: session.id,
      performedAt: normalizeIsoDate(session.performed_at) ?? '',
      title: session.planned_title ?? 'Sesión libre',
      dayLabel: session.planned_day_label,
      sessionStatus: session.session_status,
      reason: session.reason,
      durationMinutes: session.duration_minutes,
      energy: session.energy,
      notes: session.notes,
      injuryName: session.injury_name,
      injurySeverity: session.injury_severity,
      restrictionUntil: normalizeIsoDate(session.restriction_until),
      loadReductionPercent: toNumber(session.load_reduction_percent),
      loadReductionKg: toNumber(session.load_reduction_kg),
      exercises: Array.from(new Set((setsBySession.get(session.id) ?? []).map((set) => set.exercise_name))),
    })
  )
}

export async function getBlockReview(blockId?: number): Promise<BlockReview | null> {
  const activeBlock = blockId ? await getBlockById(blockId) : await getActiveTrainingBlock()
  if (!activeBlock) return null

  const sessionIds = activeBlock.sessions
    .filter((session) => session.completedSessionId !== null)
    .map((session) => session.completedSessionId as number)

  if (!sessionIds.length) {
    return {
      summary: 'Todavía no hay suficientes sesiones completadas para revisar el bloque.',
      readiness: 'moderate',
      deloadRecommended: false,
      actions: ['Completa al menos 2-3 sesiones antes de revisar el bloque.'],
    }
  }

  const [completedSessionsResult, completedSetsResult] = await Promise.all([
    sql`
      SELECT * FROM completed_sessions
      WHERE block_id = ${activeBlock.id}
      ORDER BY performed_at ASC, created_at ASC
    `,
    sql`
      SELECT cset.*
      FROM completed_sets cset
      JOIN completed_sessions cs ON cs.id = cset.completed_session_id
      WHERE cs.block_id = ${activeBlock.id}
      ORDER BY cset.completed_session_id ASC, cset.exercise_name ASC, cset.set_index ASC
    `,
  ])

  const completedSessions = (completedSessionsResult.rows as CompletedSessionRow[]).filter((row) => sessionIds.includes(row.id))
  const completedSets = (completedSetsResult.rows as CompletedSetRow[]).filter((row) =>
    sessionIds.includes(row.completed_session_id)
  )

  const signals: Array<{
    decision: ExerciseRecommendation['decision']
    energy: number | null
    sessionStatus: Exclude<SessionStatus, 'planned'>
    protectedAdjustment: boolean
  }> = []

  for (const session of activeBlock.sessions) {
    if (!session.completedSessionId) continue
    const completedSession = completedSessions.find((row) => row.id === session.completedSessionId)
    if (!completedSession) continue

    if (completedSession.session_status === 'skipped') {
      signals.push({
        decision: 'hold',
        energy: completedSession.energy,
        sessionStatus: 'skipped',
        protectedAdjustment: true,
      })
      continue
    }

    for (const exercise of session.exercises) {
      const sets = completedSets
        .filter((row) => row.completed_session_id === session.completedSessionId && row.planned_exercise_id === exercise.id)
        .map((row) => ({
          setIndex: row.set_index,
          reps: row.reps,
          weight: Number.parseFloat(row.weight),
          rir: row.rir,
          isWarmup: row.is_warmup,
          notes: row.notes,
        }))

      const firstSet = completedSets.find(
        (row) => row.completed_session_id === session.completedSessionId && row.planned_exercise_id === exercise.id
      )

      const recommendation = evaluateExercisePerformance({
        exerciseName: exercise.exerciseName,
        targetSets: exercise.targetSets,
        minReps: exercise.minReps,
        maxReps: exercise.maxReps,
        targetRir: exercise.targetRir,
        suggestedWeight: exercise.suggestedWeight,
        sessionStatus: completedSession.session_status,
        sessionReason: completedSession.reason ?? firstSet?.adjustment_reason ?? null,
        loadReductionPercent: toNumber(firstSet?.load_reduction_percent) ?? toNumber(completedSession.load_reduction_percent),
        loadReductionKg: toNumber(firstSet?.load_reduction_kg) ?? toNumber(completedSession.load_reduction_kg),
        injuryName: firstSet?.injury_name ?? completedSession.injury_name,
        sets,
      })

      signals.push({
        decision: recommendation.decision,
        energy: completedSession.energy,
        sessionStatus: completedSession.session_status,
        protectedAdjustment: recommendation.protectedAdjustment ?? false,
      })
    }
  }

  return reviewBlockProgress(signals)
}
