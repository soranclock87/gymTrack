import type {
  ActiveRestriction,
  ExerciseProgressPoint,
  MuscleGroup,
  PlannedExerciseInput,
  PlannedSessionInput,
  TrainingBlockBlueprint,
  Weekday,
} from '@/lib/training/types'

type ExerciseHistoryMap = Record<string, ExerciseProgressPoint[]>

type Profile = {
  goal?: string
  startDate?: string
  weeks?: number
  trainingDaysPerWeek?: number
  preferredWeekdays?: Weekday[]
  activeRestrictions?: ActiveRestriction[]
}

const WEEKDAYS: Weekday[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type SessionTemplate = {
  title: string
  focus: string
  exercises: Array<{ name: string; muscleGroup: MuscleGroup; targetSets: number; minReps: number; maxReps: number; targetRir: number }>
}

const TEMPLATE_LIBRARY: Record<number, SessionTemplate[]> = {
  1: [
    {
      title: 'Full Body',
      focus: 'Cuerpo completo y básicos',
      exercises: [
        { name: 'Prensa inclinada', muscleGroup: 'Piernas', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Press plano mancuernas', muscleGroup: 'Pecho', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Remo polea baja', muscleGroup: 'Espalda', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Peso muerto rumano', muscleGroup: 'Glúteos', targetSets: 3, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Elevaciones laterales', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      ],
    },
  ],
  2: [
    {
      title: 'Upper',
      focus: 'Tren superior',
      exercises: [
        { name: 'Press plano mancuernas', muscleGroup: 'Pecho', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Remo polea baja', muscleGroup: 'Espalda', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Press inclinado mancuernas', muscleGroup: 'Pecho', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Jalón pecho agarre ancho', muscleGroup: 'Espalda', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Curl EZ', muscleGroup: 'Bíceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Lower',
      focus: 'Pierna y glúteo',
      exercises: [
        { name: 'Prensa inclinada', muscleGroup: 'Piernas', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Peso muerto rumano', muscleGroup: 'Glúteos', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Extensión cuádriceps', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Femoral sentado', muscleGroup: 'Piernas', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Gemelos multipower', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      ],
    },
  ],
  3: [
    {
      title: 'Push',
      focus: 'Empuje y hombro',
      exercises: [
        { name: 'Press plano mancuernas', muscleGroup: 'Pecho', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Press inclinado mancuernas', muscleGroup: 'Pecho', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Press militar mancuernas', muscleGroup: 'Hombro', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Elevaciones laterales', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Tirón polea tríceps cuerda', muscleGroup: 'Tríceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Pull',
      focus: 'Espalda y bíceps',
      exercises: [
        { name: 'Remo polea baja', muscleGroup: 'Espalda', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Remo landmine', muscleGroup: 'Espalda', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Jalón pecho agarre ancho', muscleGroup: 'Espalda', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Curl EZ', muscleGroup: 'Bíceps', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 1 },
        { name: 'Curl martillo', muscleGroup: 'Bíceps', targetSets: 2, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Legs',
      focus: 'Piernas y core',
      exercises: [
        { name: 'Prensa inclinada', muscleGroup: 'Piernas', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Peso muerto rumano', muscleGroup: 'Glúteos', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Extensión cuádriceps', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Femoral sentado', muscleGroup: 'Piernas', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Plancha', muscleGroup: 'Core', targetSets: 3, minReps: 1, maxReps: 1, targetRir: 0 },
      ],
    },
  ],
  4: [
    {
      title: 'Upper A',
      focus: 'Empuje horizontal y tirón',
      exercises: [
        { name: 'Press plano mancuernas', muscleGroup: 'Pecho', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Remo polea baja', muscleGroup: 'Espalda', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Press inclinado mancuernas', muscleGroup: 'Pecho', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Jalón pecho agarre ancho', muscleGroup: 'Espalda', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Elevaciones laterales', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      ],
    },
    {
      title: 'Lower A',
      focus: 'Cuádriceps y glúteo',
      exercises: [
        { name: 'Prensa inclinada', muscleGroup: 'Piernas', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Peso muerto rumano', muscleGroup: 'Glúteos', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Extensión cuádriceps', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Femoral sentado', muscleGroup: 'Piernas', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Gemelos multipower', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      ],
    },
    {
      title: 'Upper B',
      focus: 'Tracción y hombro',
      exercises: [
        { name: 'Remo landmine', muscleGroup: 'Espalda', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Press militar mancuernas', muscleGroup: 'Hombro', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Pullover mancuerna', muscleGroup: 'Espalda', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 2 },
        { name: 'Pájaros banco inclinado', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Curl EZ', muscleGroup: 'Bíceps', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 1 },
      ],
    },
    {
      title: 'Lower B + brazos',
      focus: 'Piernas y accesorios',
      exercises: [
        { name: 'Femoral sentado', muscleGroup: 'Piernas', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Extensión cuádriceps', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Curl martillo', muscleGroup: 'Bíceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Fondos tríceps', muscleGroup: 'Tríceps', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 1 },
        { name: 'Plancha', muscleGroup: 'Core', targetSets: 3, minReps: 1, maxReps: 1, targetRir: 0 },
      ],
    },
  ],
  5: [
    {
      title: 'Push',
      focus: 'Pecho, hombro y tríceps',
      exercises: [
        { name: 'Press plano mancuernas', muscleGroup: 'Pecho', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Press inclinado mancuernas', muscleGroup: 'Pecho', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Press militar mancuernas', muscleGroup: 'Hombro', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Elevaciones laterales', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Tirón polea tríceps cuerda', muscleGroup: 'Tríceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Pull',
      focus: 'Espalda y bíceps',
      exercises: [
        { name: 'Remo polea baja', muscleGroup: 'Espalda', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Remo landmine', muscleGroup: 'Espalda', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Jalón pecho agarre ancho', muscleGroup: 'Espalda', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Curl EZ', muscleGroup: 'Bíceps', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 1 },
        { name: 'Curl martillo', muscleGroup: 'Bíceps', targetSets: 2, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Legs',
      focus: 'Piernas y glúteo',
      exercises: [
        { name: 'Prensa inclinada', muscleGroup: 'Piernas', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Peso muerto rumano', muscleGroup: 'Glúteos', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Extensión cuádriceps', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Femoral sentado', muscleGroup: 'Piernas', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Gemelos multipower', muscleGroup: 'Piernas', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      ],
    },
    {
      title: 'Upper técnico',
      focus: 'Recordatorio técnico y volumen moderado',
      exercises: [
        { name: 'Press plano mancuernas', muscleGroup: 'Pecho', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Remo polea baja', muscleGroup: 'Espalda', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Press militar mancuernas', muscleGroup: 'Hombro', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Pájaros banco inclinado', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Fondos tríceps', muscleGroup: 'Tríceps', targetSets: 2, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Brazos y core',
      focus: 'Accesorios, core y bombeo',
      exercises: [
        { name: 'Curl scott EZ', muscleGroup: 'Bíceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Press francés mancuernas', muscleGroup: 'Tríceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Elevaciones laterales', muscleGroup: 'Hombro', targetSets: 3, minReps: 15, maxReps: 18, targetRir: 1 },
        { name: 'Plancha', muscleGroup: 'Core', targetSets: 3, minReps: 1, maxReps: 1, targetRir: 0 },
        { name: 'Bici estática', muscleGroup: 'Cardio', targetSets: 1, minReps: 1, maxReps: 1, targetRir: 0 },
      ],
    },
  ],
  6: [
    {
      title: 'Push',
      focus: 'Pecho y tríceps',
      exercises: [
        { name: 'Press plano mancuernas', muscleGroup: 'Pecho', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Press inclinado mancuernas', muscleGroup: 'Pecho', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Tirón polea tríceps cuerda', muscleGroup: 'Tríceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Pull',
      focus: 'Espalda',
      exercises: [
        { name: 'Remo polea baja', muscleGroup: 'Espalda', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Remo landmine', muscleGroup: 'Espalda', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Jalón pecho agarre ancho', muscleGroup: 'Espalda', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 2 },
      ],
    },
    {
      title: 'Legs',
      focus: 'Piernas y glúteos',
      exercises: [
        { name: 'Prensa inclinada', muscleGroup: 'Piernas', targetSets: 4, minReps: 8, maxReps: 10, targetRir: 2 },
        { name: 'Peso muerto rumano', muscleGroup: 'Glúteos', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Femoral sentado', muscleGroup: 'Piernas', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Hombro',
      focus: 'Deltoides y estabilidad',
      exercises: [
        { name: 'Press militar mancuernas', muscleGroup: 'Hombro', targetSets: 4, minReps: 6, maxReps: 8, targetRir: 2 },
        { name: 'Elevaciones laterales', muscleGroup: 'Hombro', targetSets: 4, minReps: 12, maxReps: 15, targetRir: 1 },
        { name: 'Pájaros banco inclinado', muscleGroup: 'Hombro', targetSets: 3, minReps: 12, maxReps: 15, targetRir: 1 },
      ],
    },
    {
      title: 'Brazos',
      focus: 'Bíceps y tríceps',
      exercises: [
        { name: 'Curl EZ', muscleGroup: 'Bíceps', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 1 },
        { name: 'Curl martillo', muscleGroup: 'Bíceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
        { name: 'Fondos tríceps', muscleGroup: 'Tríceps', targetSets: 3, minReps: 8, maxReps: 10, targetRir: 1 },
        { name: 'Press francés mancuernas', muscleGroup: 'Tríceps', targetSets: 3, minReps: 10, maxReps: 12, targetRir: 1 },
      ],
    },
    {
      title: 'Recuperación activa',
      focus: 'Core y cardio suave',
      exercises: [
        { name: 'Plancha', muscleGroup: 'Core', targetSets: 3, minReps: 1, maxReps: 1, targetRir: 0 },
        { name: 'Bici estática', muscleGroup: 'Cardio', targetSets: 1, minReps: 1, maxReps: 1, targetRir: 0 },
      ],
    },
  ],
}

function getTemplatesForDays(trainingDaysPerWeek: number) {
  const normalizedDays = Math.max(1, Math.min(7, trainingDaysPerWeek))
  if (normalizedDays === 7) {
    return [
      ...TEMPLATE_LIBRARY[6],
      {
        title: 'Movilidad y paseo',
        focus: 'Recuperación activa suave',
        exercises: [
          { name: 'Plancha', muscleGroup: 'Core', targetSets: 2, minReps: 1, maxReps: 1, targetRir: 0 },
          { name: 'Senderismo', muscleGroup: 'Cardio', targetSets: 1, minReps: 1, maxReps: 1, targetRir: 0 },
        ],
      },
    ]
  }
  return TEMPLATE_LIBRARY[normalizedDays]
}

function resolvePreferredWeekdays(trainingDaysPerWeek: number, preferredWeekdays: Weekday[]) {
  const preferred = WEEKDAYS.filter((weekday) => preferredWeekdays.includes(weekday))
  const fallback = WEEKDAYS.filter((weekday) => !preferred.includes(weekday))
  return [...preferred, ...fallback].slice(0, trainingDaysPerWeek)
}

function matchesRestriction(restriction: ActiveRestriction, exerciseName: string, muscleGroup: MuscleGroup) {
  if (restriction.exerciseName && restriction.exerciseName === exerciseName) return true
  return restriction.notes?.toLowerCase().includes(muscleGroup.toLowerCase()) ?? false
}

function getRestrictionNote(restrictions: ActiveRestriction[], exerciseName: string, muscleGroup: MuscleGroup) {
  const match = restrictions.find((restriction) => matchesRestriction(restriction, exerciseName, muscleGroup))
  if (!match) return null
  const parts = [`Precaución por ${match.injuryName.toLowerCase()}`]
  if (match.loadReductionPercent) parts.push(`reduce ${match.loadReductionPercent}%`)
  if (match.loadReductionKg) parts.push(`reduce ${match.loadReductionKg} kg`)
  if (match.restrictionUntil) parts.push(`revisar hasta ${match.restrictionUntil}`)
  return parts.join(' · ')
}

function isProtectedExercise(restrictions: ActiveRestriction[], exerciseName: string, muscleGroup: MuscleGroup) {
  return Boolean(getRestrictionNote(restrictions, exerciseName, muscleGroup))
}

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
  exercise: { name: string; muscleGroup: string; targetSets: number; minReps: number; maxReps: number; targetRir: number },
  orderIndex: number,
  historyMap: ExerciseHistoryMap,
  weekIndex: number,
  totalWeeks: number,
  activeRestrictions: ActiveRestriction[]
): PlannedExerciseInput {
  const suggestedWeight = deriveSuggestedWeight(exercise.name, historyMap[exercise.name] ?? [])
  const isDeloadWeek = totalWeeks >= 4 && weekIndex === totalWeeks
  const muscleGroup = exercise.muscleGroup as MuscleGroup
  const isProtected = isProtectedExercise(activeRestrictions, exercise.name, muscleGroup)
  const protectionNote = getRestrictionNote(activeRestrictions, exercise.name, muscleGroup)
  const deloadSets = isDeloadWeek ? Math.max(2, exercise.targetSets - 1) : exercise.targetSets
  const protectedSets = isProtected ? Math.max(1, deloadSets - 1) : deloadSets
  const baseWeight = isDeloadWeek && suggestedWeight
    ? roundToNearestStep(suggestedWeight * 0.9, getDefaultStep(exercise.name, suggestedWeight))
    : suggestedWeight
  const protectedWeight = isProtected && baseWeight
    ? roundToNearestStep(baseWeight * 0.9, getDefaultStep(exercise.name, baseWeight))
    : baseWeight

  return {
    exerciseName: exercise.name,
    muscleGroup,
    orderIndex,
    targetSets: protectedSets,
    minReps: exercise.minReps,
    maxReps: exercise.maxReps,
    targetRir: exercise.targetRir,
    suggestedWeight: protectedWeight,
    notes: [isDeloadWeek ? 'Semana de descarga: baja un poco la carga y deja margen.' : null, protectionNote].filter(Boolean).join(' · ') || null,
  }
}

export function buildBlockBlueprint(profile: Profile, historyMap: ExerciseHistoryMap): TrainingBlockBlueprint {
  const weeks = profile.weeks ?? 4
  const startDate = profile.startDate ?? new Date().toISOString().split('T')[0]
  const goal = profile.goal?.trim() || 'Hipertrofia con progresión sostenible'
  const trainingDaysPerWeek = Math.max(1, Math.min(7, profile.trainingDaysPerWeek ?? 4))
  const preferredWeekdays = resolvePreferredWeekdays(trainingDaysPerWeek, profile.preferredWeekdays ?? ['Lunes', 'Miércoles', 'Viernes', 'Sábado'])
  const templates = getTemplatesForDays(trainingDaysPerWeek)
  const activeRestrictions = profile.activeRestrictions ?? []
  const sessions: PlannedSessionInput[] = []

  for (let weekIndex = 1; weekIndex <= weeks; weekIndex += 1) {
    templates.forEach((template, templateIndex) => {
      const dayLabel = preferredWeekdays[templateIndex] ?? WEEKDAYS[templateIndex]
      sessions.push({
        weekIndex,
        dayIndex: WEEKDAYS.indexOf(dayLabel) + 1,
        dayLabel,
        title: `${template.title} · Semana ${weekIndex}`,
        focus: weekIndex === weeks && weeks >= 4 ? `${template.focus} · Descarga` : template.focus,
        notes: weekIndex === weeks && weeks >= 4 ? 'Reduce esfuerzo percibido y prioriza técnica.' : null,
        exercises: template.exercises.map((exercise, index) =>
          buildExercisePlan(exercise, index + 1, historyMap, weekIndex, weeks, activeRestrictions)
        ),
      })
    })
  }

  return {
    title: `Bloque ${weeks} semanas · ${trainingDaysPerWeek} días`,
    goal,
    weeks,
    startDate,
    trainingDaysPerWeek,
    preferredWeekdays,
    notes: 'Bloque generado con frecuencia semanal configurable, control de fatiga y restricciones activas.',
    rationale:
      'La estructura reparte el trabajo según tus días disponibles y respeta las preferencias semanales para que el plan sea sostenible.',
    generatedBy: 'rules',
    sessions,
  }
}

export function summarizeHistoryForPrompt(historyMap: ExerciseHistoryMap) {
  return Object.entries(historyMap)
    .slice(0, 18)
    .map(([exercise, points]) => {
      const last = points.at(-1)
      if (!last) return `${exercise}: sin datos`
      return `${exercise}: último máximo ${last.maxWeight} kg, ${last.totalSets} series (${last.date})`
    })
    .join('\n')
}

export function getBlockDateRange(startDate: string, weeks: number) {
  return { startDate, endDate: endDateFrom(startDate, weeks) }
}
