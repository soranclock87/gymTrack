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

export type Weekday =
  | 'Lunes'
  | 'Martes'
  | 'Miércoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sábado'
  | 'Domingo'

export type SessionStatus = 'planned' | 'completed' | 'skipped' | 'adapted'

export type SessionReason =
  | 'fatiga'
  | 'lesion'
  | 'viaje'
  | 'falta_de_tiempo'
  | 'trabajo'
  | 'otro'

export type InjurySeverity = 'leve' | 'moderada' | 'alta'

export type TrainingEventType = 'skip' | 'adaptation' | 'injury' | 'plan_reset' | 'plan_deleted'

export type TrainingPreferences = {
  trainingDaysPerWeek: number
  preferredWeekdays: Weekday[]
}

export type ExerciseCatalogEntry = {
  id?: number
  name: string
  muscleGroup: MuscleGroup
  movementPattern?: string | null
  equipment?: string | null
  isCompound?: boolean
}

export type ExerciseReference = {
  requestedName: string
  matchedName: string | null
  description: string | null
  imageUrl: string | null
  category: string | null
  equipment: string[]
  source: 'wger'
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
  dayLabel: Weekday
  title: string
  focus: string
  notes?: string | null
  exercises: PlannedExerciseInput[]
}

export type TrainingBlockBlueprint = TrainingPreferences & {
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
  status: SessionStatus
  completedSessionId: number | null
  exercises: PlannedExercise[]
}

export type TrainingBlock = TrainingPreferences & {
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
  adjustmentReason?: SessionReason | null
  loadReductionPercent?: number | null
  loadReductionKg?: number | null
  injuryName?: string | null
  injurySeverity?: InjurySeverity | null
  restrictionUntil?: string | null
  notes?: string | null
  sets: CompletedSetInput[]
}

export type CompletedSessionInput = {
  plannedSessionId?: number | null
  performedAt: string
  sessionStatus: Exclude<SessionStatus, 'planned'>
  reason?: SessionReason | null
  durationMinutes?: number | null
  energy?: number | null
  injuryName?: string | null
  injurySeverity?: InjurySeverity | null
  restrictionUntil?: string | null
  loadReductionPercent?: number | null
  loadReductionKg?: number | null
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
  protectedAdjustment?: boolean
}

export type BlockReview = {
  summary: string
  readiness: 'high' | 'moderate' | 'low'
  deloadRecommended: boolean
  actions: string[]
}

export type TrainingEvent = {
  id: number
  date: string
  eventType: TrainingEventType
  reason: SessionReason | null
  sessionStatus: Exclude<SessionStatus, 'planned'> | null
  exerciseName: string | null
  injuryName: string | null
  injurySeverity: InjurySeverity | null
  restrictionUntil: string | null
  loadReductionPercent: number | null
  loadReductionKg: number | null
  notes: string | null
}

export type ActiveRestriction = {
  exerciseName: string | null
  injuryName: string
  injurySeverity: InjurySeverity | null
  reason: SessionReason | null
  restrictionUntil: string | null
  notes: string | null
  loadReductionPercent: number | null
  loadReductionKg: number | null
}

export type CompletedSessionSummary = {
  id: number
  performedAt: string
  title: string
  dayLabel: string | null
  sessionStatus: Exclude<SessionStatus, 'planned'>
  reason: SessionReason | null
  durationMinutes: number | null
  energy: number | null
  notes: string | null
  injuryName: string | null
  injurySeverity: InjurySeverity | null
  restrictionUntil: string | null
  loadReductionPercent: number | null
  loadReductionKg: number | null
  exercises: string[]
}
