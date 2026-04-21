import type {
  ExerciseProgressPoint,
  MuscleGroup,
  PlannedExerciseInput,
  PlannedSessionInput,
  TrainingBlockBlueprint,
} from '@/lib/training/types'

type ExerciseHistoryMap = Record<string, ExerciseProgressPoint[]>

type Profile = {
  goal?: string
  startDate?: string
  weeks?: number
}

const SESSION_TEMPLATES: Array<{
  dayLabel: string
  title: string
  focus: string
  exercises: Array<{ name: string; muscleGroup: MuscleGroup; targetSets: number; minReps: number; maxReps: number; targetRir: number }>
}> = [
  {
    dayLabel: 'Lunes',
    title: 'Superior A',
    focus: 'Empuje horizontal y tirón',
    exercises: [
      { name: 'Press plano mancuernas', muscleGroup: 'Pecho', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
      { name: 'Remo polea baja', muscleGroup: 'Espalda', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
      { name: 'Press inclinado mancuernas', muscleGroup: 'Pecho', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
      { name: 'Jalón pecho agarre ancho', muscleGroup: 'Espalda', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
      { name: 'Elevaciones laterales', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 2 },
      { name: 'Tirón polea tríceps cuerda', muscleGroup: 'Tríceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
    ],
  },
  {
    dayLabel: 'Miércoles',
    title: 'Pierna',
    focus: 'Cadena posterior y cuádriceps',
    exercises: [
      { name: 'Prensa inclinada', muscleGroup: 'Piernas', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
      { name: 'Peso muerto rumano', muscleGroup: 'Glúteos', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
      { name: 'Extensión cuádriceps', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      { name: 'Femoral sentado', muscleGroup: 'Piernas', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      { name: 'Gemelos multipower', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      { name: 'Plancha', muscleGroup: 'Core', targetSets: 3, minReps: 1, maxReps: 1, targetRir: 0 },
    ],
  },
  {
    dayLabel: 'Viernes',
    title: 'Superior B',
    focus: 'Tracción y hombro',
    exercises: [
      { name: 'Remo landmine', muscleGroup: 'Espalda', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
      { name: 'Press militar mancuernas', muscleGroup: 'Hombro', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
      { name: 'Pullover mancuerna', muscleGroup: 'Espalda', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 2 },
      { name: 'Pájaros banco inclinado', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      { name: 'Curl EZ', muscleGroup: 'Bíceps', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 1 },
      { name: 'Curl martillo', muscleGroup: 'Bíceps', targetSets: 2, minReps: 10, maxReps: 12, targetRir: 1 },
    ],
  },
  {
    dayLabel: 'Sábado',
    title: 'Brazos y accesorios',
    focus: 'Trabajo accesorio y bombeo',
    exercises: [
      { name: 'Curl scott EZ', muscleGroup: 'Bíceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      { name: 'Fondos tríceps', muscleGroup: 'Tríceps', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 1 },
      { name: 'Press francés mancuernas', muscleGroup: 'Tríceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      { name: 'Elevaciones laterales', muscleGroup: 'Hombro', targetSets: 3, minReps: 15, maxReps: 18, targetRir: 1 },
      { name: 'Hiperextensiones', muscleGroup: 'Espalda', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      { name: 'Bici estática', muscleGroup: 'Cardio', targetSets: 1, minReps: 1, maxReps: 1, targetRir: 0 },
    ],
  },
]

function plusDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function endDateFrom(startDate: string, weeks: number) {
  return plusDays(startDate, weeks * 7 - 1)
}

function averageRecentMax(points: ExerciseProgressPoint[]) {
  if (!points.length) return null
  const recent = points.slice(-3)
  return recent.reduce((sum, point) => sum + point.maxWeight, 0) / recent.length
}

function roundToNearestStep(value: number, step: number) {
  return Math.round(value / step) * step
}

function getDefaultStep(exerciseName: string, weight: number) {
  const lower = exerciseName.toLowerCase()
  if (lower.includes('curl') || lower.includes('laterales') || lower.includes('pájaros') || lower.includes('tríceps')) {
    return weight >= 12 ? 1 : 0.5
  }

  if (lower.includes('press') || lower.includes('remo') || lower.includes('jalón') || lower.includes('prensa') || lower.includes('peso muerto')) {
    return weight >= 60 ? 2.5 : 1.25
  }

  return weight >= 20 ? 1 : 0.5
}

function deriveSuggestedWeight(exerciseName: string, history: ExerciseProgressPoint[]) {
  const recent = averageRecentMax(history)
  if (recent === null) return null
  const step = getDefaultStep(exerciseName, recent)
  return roundToNearestStep(recent, step)
}

function buildExercisePlan(
  exercise: (typeof SESSION_TEMPLATES)[number]['exercises'][number],
  orderIndex: number,
  historyMap: ExerciseHistoryMap,
  weekIndex: number,
  totalWeeks: number
): PlannedExerciseInput {
  const suggestedWeight = deriveSuggestedWeight(exercise.name, historyMap[exercise.name] ?? [])
  const isDeloadWeek = totalWeeks >= 4 && weekIndex === totalWeeks
  const deloadSets = isDeloadWeek ? Math.max(2, exercise.targetSets - 1) : exercise.targetSets
  const deloadWeight = suggestedWeight ? roundToNearestStep(suggestedWeight * 0.9, getDefaultStep(exercise.name, suggestedWeight)) : null

  return {
    exerciseName: exercise.name,
    muscleGroup: exercise.muscleGroup,
    orderIndex,
    targetSets: deloadSets,
    minReps: exercise.minReps,
    maxReps: exercise.maxReps,
    targetRir: exercise.targetRir,
    suggestedWeight: isDeloadWeek ? deloadWeight : suggestedWeight,
    notes: isDeloadWeek ? 'Semana de descarga: baja un poco la carga y deja margen.' : null,
  }
}

export function buildBlockBlueprint(profile: Profile, historyMap: ExerciseHistoryMap): TrainingBlockBlueprint {
  const weeks = profile.weeks ?? 4
  const startDate = profile.startDate ?? new Date().toISOString().split('T')[0]
  const goal = profile.goal?.trim() || 'Hipertrofia con progresión sostenible'

  const sessions: PlannedSessionInput[] = []

  for (let weekIndex = 1; weekIndex <= weeks; weekIndex += 1) {
    SESSION_TEMPLATES.forEach((template, dayIndex) => {
      sessions.push({
        weekIndex,
        dayIndex: dayIndex + 1,
        dayLabel: template.dayLabel,
        title: `${template.title} · Semana ${weekIndex}`,
        focus: weekIndex === weeks && weeks >= 4 ? `${template.focus} · Descarga` : template.focus,
        notes: weekIndex === weeks && weeks >= 4 ? 'Reduce esfuerzo percibido y prioriza técnica.' : null,
        exercises: template.exercises.map((exercise, index) =>
          buildExercisePlan(exercise, index + 1, historyMap, weekIndex, weeks)
        ),
      })
    })
  }

  return {
    title: `Bloque ${weeks} semanas`,
    goal,
    weeks,
    startDate,
    notes: 'Bloque generado para una progresión simple con control de fatiga.',
    rationale:
      'Se propone una estructura upper/lower con accesorios y una descarga final para consolidar la progresión sin acumular demasiada fatiga.',
    generatedBy: 'rules',
    sessions,
  }
}

export function summarizeHistoryForPrompt(historyMap: ExerciseHistoryMap) {
  return Object.entries(historyMap)
    .slice(0, 18)
    .map(([exercise, points]) => {
      const last = points.at(-1)
      if (!last) {
        return `${exercise}: sin datos`
      }

      return `${exercise}: último máximo ${last.maxWeight} kg, ${last.totalSets} series (${last.date})`
    })
    .join('\n')
}

export function getBlockDateRange(startDate: string, weeks: number) {
  return {
    startDate,
    endDate: endDateFrom(startDate, weeks),
  }
}
