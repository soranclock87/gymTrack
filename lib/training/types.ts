export type MuscleGroup =
  | 'Pecho'
  | 'Espalda'
  | 'Hombro'
  | 'Bíceps'
  | 'Tríceps'
  | 'Piernas'
  | 'Glúteos'
  | 'Core'
  | 'Cardio'

export type BlockStatus = 'draft' | 'active' | 'completed' | 'archived'

export type ProgressionDecision = 'increase' | 'hold' | 'decrease' | 'deload'

export type ExerciseCatalogEntry = {
  id?: number
  name: string
  muscleGroup: MuscleGroup
  movementPattern?: string | null
  equipment?: string | null
  isCompound?: boolean
}

export type PlannedExerciseInput = {
  exerciseName: string
  muscleGroup: MuscleGroup
  orderIndex: number
  targetSets: number
  minReps: number
  maxReps: number
  targetRir: number | null
  suggestedWeight: number | null
  notes?: string | null
}

export type PlannedSessionInput = {
  weekIndex: number
  dayIndex: number
  dayLabel: string
  title: string
  focus: string
  notes?: string | null
  exercises: PlannedExerciseInput[]
}

export type TrainingBlockBlueprint = {
  title: string
  goal: string
  weeks: number
  startDate: string
  notes?: string | null
  rationale?: string | null
  generatedBy: 'rules' | 'ai'
  sessions: PlannedSessionInput[]
}

export type PlannedExercise = PlannedExerciseInput & {
  id: number
  sessionId: number
  exerciseId: number | null
}

export type PlannedSession = Omit<PlannedSessionInput, 'exercises'> & {
  id: number
  blockId: number
  status: 'planned' | 'completed' | 'skipped'
  completedSessionId: number | null
  exercises: PlannedExercise[]
}

export type TrainingBlock = {
  id: number
  title: string
  goal: string
  startDate: string
  endDate: string
  weeks: number
  status: BlockStatus
  notes: string | null
  rationale: string | null
  generatedBy: 'rules' | 'ai'
  createdAt: string
  sessions: PlannedSession[]
}

export type CompletedSetInput = {
  setIndex: number
  reps: number
  weight: number
  rir?: number | null
  isWarmup?: boolean
  notes?: string | null
}

export type CompletedExerciseInput = {
  plannedExerciseId?: number | null
  exerciseName: string
  muscleGroup: MuscleGroup
  notes?: string | null
  sets: CompletedSetInput[]
}

export type CompletedSessionInput = {
  plannedSessionId?: number | null
  performedAt: string
  durationMinutes?: number | null
  energy?: number | null
  notes?: string | null
  exercises: CompletedExerciseInput[]
}

export type ExerciseProgressPoint = {
  date: string
  maxWeight: number
  totalSets: number
}

export type ExerciseRecommendation = {
  exerciseName: string
  decision: ProgressionDecision
  nextWeight: number | null
  reason: string
  increment: number
}

export type BlockReview = {
  summary: string
  readiness: 'high' | 'moderate' | 'low'
  deloadRecommended: boolean
  actions: string[]
}
