import type {
  BlockReview,
  CompletedSetInput,
  ExerciseRecommendation,
  ProgressionDecision,
  SessionReason,
  SessionStatus,
} from '@/lib/training/types'

type EvaluationInput = {
  exerciseName: string
  targetSets: number
  minReps: number
  maxReps: number
  targetRir: number | null
  suggestedWeight: number | null
  sessionStatus: Exclude<SessionStatus, 'planned'>
  sessionReason?: SessionReason | null
  loadReductionPercent?: number | null
  loadReductionKg?: number | null
  injuryName?: string | null
  sets: CompletedSetInput[]
}

type ReviewSignal = {
  decision: ProgressionDecision
  energy: number | null
  sessionStatus: Exclude<SessionStatus, 'planned'>
  protectedAdjustment: boolean
}

function getDefaultIncrement(exerciseName: string, weight: number | null) {
  const currentWeight = weight ?? 0
  const lower = exerciseName.toLowerCase()

  if (lower.includes('curl') || lower.includes('laterales') || lower.includes('pájaros') || lower.includes('tríceps')) {
    return currentWeight >= 12 ? 1 : 0.5
  }

  if (lower.includes('press') || lower.includes('remo') || lower.includes('jalón') || lower.includes('prensa') || lower.includes('peso muerto')) {
    return currentWeight >= 60 ? 2.5 : 1.25
  }

  return currentWeight >= 20 ? 1 : 0.5
}

function roundToIncrement(value: number, increment: number) {
  return Math.round(value / increment) * increment
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function evaluateExercisePerformance(input: EvaluationInput): ExerciseRecommendation {
  const workingSets = input.sets.filter((set) => !set.isWarmup)
  const increment = getDefaultIncrement(input.exerciseName, input.suggestedWeight)
  const baseWeight = input.suggestedWeight ?? average(workingSets.map((set) => set.weight)) ?? null
  const protectedAdjustment =
    input.sessionStatus === 'adapted' ||
    Boolean(input.injuryName) ||
    Boolean((input.loadReductionPercent ?? 0) > 0) ||
    Boolean((input.loadReductionKg ?? 0) > 0) ||
    input.sessionReason === 'lesion' ||
    input.sessionReason === 'fatiga'

  if (input.sessionStatus === 'skipped') {
    return {
      exerciseName: input.exerciseName,
      decision: 'hold',
      nextWeight: baseWeight,
      reason: 'Sesión saltada: no se usa como señal de progreso ni de retroceso.',
      increment,
      protectedAdjustment: true,
    }
  }

  if (!workingSets.length) {
    return {
      exerciseName: input.exerciseName,
      decision: 'hold',
      nextWeight: baseWeight,
      reason: 'No hay series efectivas registradas; mantén la carga hasta tener una referencia real.',
      increment,
      protectedAdjustment,
    }
  }

  const topSets = workingSets.slice(0, input.targetSets)
  const successSets = topSets.filter((set) => set.reps >= input.minReps).length
  const avgReps = average(topSets.map((set) => set.reps)) ?? 0
  const avgRir = average(topSets.map((set) => set.rir).filter((value): value is number => value !== null && value !== undefined))

  if (baseWeight === null) {
    return {
      exerciseName: input.exerciseName,
      decision: 'hold',
      nextWeight: null,
      reason: 'Sin referencia previa de peso; usa esta sesión como punto de partida.',
      increment,
      protectedAdjustment,
    }
  }

  if (protectedAdjustment) {
    return {
      exerciseName: input.exerciseName,
      decision: 'hold',
      nextWeight: roundToIncrement(baseWeight, increment),
      reason: 'Sesión adaptada por fatiga o lesión: se conserva la referencia sin penalizar el seguimiento normal.',
      increment,
      protectedAdjustment: true,
    }
  }

  const metTopRange = successSets === Math.min(input.targetSets, topSets.length) && avgReps >= input.maxReps - 0.25
  const underRecovered = avgRir !== null && input.targetRir !== null ? avgRir < input.targetRir - 1 : false
  const underperformed = successSets <= Math.floor(input.targetSets / 2) || avgReps < input.minReps - 1

  if (metTopRange && !underRecovered) {
    return {
      exerciseName: input.exerciseName,
      decision: 'increase',
      nextWeight: roundToIncrement(baseWeight + increment, increment),
      reason: 'Has completado el rango alto con margen suficiente; toca subir ligeramente la carga.',
      increment,
      protectedAdjustment: false,
    }
  }

  if (underperformed || underRecovered) {
    return {
      exerciseName: input.exerciseName,
      decision: 'decrease',
      nextWeight: roundToIncrement(Math.max(0, baseWeight - increment), increment),
      reason: 'La sesión quedó por debajo del objetivo o con demasiada fatiga; conviene bajar un paso.',
      increment,
      protectedAdjustment: false,
    }
  }

  return {
    exerciseName: input.exerciseName,
    decision: 'hold',
    nextWeight: roundToIncrement(baseWeight, increment),
    reason: 'El rendimiento ha sido correcto pero todavía no justifica subir carga.',
    increment,
    protectedAdjustment: false,
  }
}

export function reviewBlockProgress(signals: ReviewSignal[]): BlockReview {
  const relevantSignals = signals.filter((signal) => signal.sessionStatus !== 'skipped')
  const energyValues = signals
    .map((signal) => signal.energy)
    .filter((value): value is number => value !== null && value !== undefined)
  const avgEnergy = average(energyValues) ?? 3
  const decreases = relevantSignals.filter((signal) => signal.decision === 'decrease' && !signal.protectedAdjustment).length
  const increases = relevantSignals.filter((signal) => signal.decision === 'increase').length
  const protectedSignals = relevantSignals.filter((signal) => signal.protectedAdjustment).length
  const totalSignals = relevantSignals.length || 1
  const decreaseRatio = decreases / totalSignals
  const increaseRatio = increases / totalSignals
  const protectedRatio = protectedSignals / totalSignals
  const deloadRecommended = decreaseRatio >= 0.35 || avgEnergy <= 2.2 || protectedRatio >= 0.4

  if (deloadRecommended) {
    return {
      summary:
        protectedRatio >= 0.4
          ? 'El bloque ha tenido muchas adaptaciones por fatiga o lesión. Conviene proteger la siguiente fase con descarga y menor agresividad.'
          : 'Hay signos de fatiga acumulada. Conviene entrar en una semana de descarga antes del siguiente bloque.',
      readiness: 'low',
      deloadRecommended: true,
      actions: [
        'Reduce el volumen un 25-35% en la primera semana del siguiente bloque.',
        'Baja la carga de los básicos alrededor de un 8-10%.',
        'Prioriza técnica, sueño y margen en recámara.',
      ],
    }
  }

  if (increaseRatio >= 0.45 && avgEnergy >= 3) {
    return {
      summary: 'El bloque ha ido bien y puedes seguir progresando con una subida moderada de carga o volumen.',
      readiness: 'high',
      deloadRecommended: false,
      actions: [
        'Mantén la misma estructura una rotación más.',
        'Añade una pequeña subida de carga en los básicos principales.',
        'Conserva el volumen de accesorios si sigues recuperando bien.',
      ],
    }
  }

  return {
    summary:
      protectedSignals > 0
        ? 'El bloque ha sido útil, pero hubo adaptaciones por fatiga o lesión. Mejor consolidar antes de volver a apretar.'
        : 'La respuesta al bloque ha sido intermedia: mejor consolidar y progresar con ajustes pequeños.',
    readiness: 'moderate',
    deloadRecommended: false,
    actions: [
      'Mantén la mayoría de ejercicios.',
      'Sube carga solo en los movimientos que cerraron el rango alto.',
      'No añadas volumen extra hasta confirmar recuperación estable.',
    ],
  }
}
