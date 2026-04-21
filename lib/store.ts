export type ExerciseSet = {
  reps: number
  weight: number
  notes?: string
}

export type ExerciseLog = {
  id: string
  name: string
  sets: ExerciseSet[]
  cardioMinutes?: number
}

export type WorkoutLog = {
  id: string
  date: string // ISO
  day: string  // "Lunes - Tren superior A"
  exercises: ExerciseLog[]
  cardioMinutes: number
  cardioType: string
  notes: string
  durationMinutes: number
}

export type BodyWeightEntry = {
  id: string
  date: string
  weight: number
  notes?: string
}

// ── WORKOUT LOGS ──────────────────────────────────────────
export function getWorkouts(): WorkoutLog[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('gym_workouts') || '[]')
  } catch { return [] }
}

export function saveWorkout(w: WorkoutLog) {
  const all = getWorkouts()
  const idx = all.findIndex(x => x.id === w.id)
  if (idx >= 0) all[idx] = w
  else all.unshift(w)
  localStorage.setItem('gym_workouts', JSON.stringify(all))
}

export function deleteWorkout(id: string) {
  const all = getWorkouts().filter(w => w.id !== id)
  localStorage.setItem('gym_workouts', JSON.stringify(all))
}

// ── BODY WEIGHT ────────────────────────────────────────────
export function getWeights(): BodyWeightEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('gym_bodyweight') || '[]')
  } catch { return [] }
}

export function saveWeight(e: BodyWeightEntry) {
  const all = getWeights()
  const idx = all.findIndex(x => x.id === e.id)
  if (idx >= 0) all[idx] = e
  else all.unshift(e)
  all.sort((a, b) => b.date.localeCompare(a.date))
  localStorage.setItem('gym_bodyweight', JSON.stringify(all))
}

export function deleteWeight(id: string) {
  const all = getWeights().filter(w => w.id !== id)
  localStorage.setItem('gym_bodyweight', JSON.stringify(all))
}

// ── PLAN ───────────────────────────────────────────────────
export const PLAN_DAYS = [
  {
    day: 'Lunes',
    title: 'Tren superior A',
    type: 'fuerza',
    exercises: [
      'Press plano mancuernas',
      'Remo polea baja',
      'Press inclinado mancuernas',
      'Jalón pecho agarre ancho',
      'Elevaciones laterales',
      'Pájaros banco',
    ],
    cardio: 'Bici zona 2 · 40 min',
  },
  {
    day: 'Martes',
    title: 'Pádel + Gym',
    type: 'padel',
    exercises: [
      'Curl EZ',
      'Curl martillo',
      'Tirón polea tríceps cuerda',
      'Fondos tríceps',
      'Press francés',
    ],
    cardio: 'Pádel 1–1.5h (cardio cubierto)',
  },
  {
    day: 'Miércoles',
    title: 'Piernas adaptado',
    type: 'fuerza',
    exercises: [
      'Femoral sentado',
      'Prensa pies altos',
      'Extensión cuádriceps',
      'Hip thrust',
      'Peso muerto rumano',
      'Gemelos multipower',
    ],
    cardio: 'Bici suave · 30 min',
  },
  {
    day: 'Jueves',
    title: 'Pádel + Gym',
    type: 'padel',
    exercises: [
      'Remo landmine',
      'Remo polea 1 mano',
      'Pullover mancuerna',
      'Jalón estrecho',
      'Remo barra agarre supino',
      'Hiperextensiones',
    ],
    cardio: 'Pádel 1–1.5h + bici opcional 20 min',
  },
  {
    day: 'Viernes',
    title: 'Tracción',
    type: 'fuerza',
    exercises: [
      'Remo landmine',
      'Remo polea 1 mano',
      'Pullover mancuerna',
      'Jalón estrecho',
      'Remo barra agarre supino',
      'Hiperextensiones',
    ],
    cardio: 'Elíptica o bici · 40 min',
  },
  {
    day: 'Sábado',
    title: 'Brazos + Hombro',
    type: 'fuerza',
    exercises: [
      'Curl EZ',
      'Curl martillo',
      'Curl scott EZ',
      'Tirón polea tríceps cuerda',
      'Fondos tríceps + press francés',
      'Press militar mancuernas',
    ],
    cardio: 'Bici o elíptica · 40 min',
  },
  {
    day: 'Domingo',
    title: 'Activo libre',
    type: 'activo',
    exercises: [],
    cardio: 'Playa, senderismo, paseo',
  },
]

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}
