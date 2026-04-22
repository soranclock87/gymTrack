import type { ExerciseReference } from '@/lib/training/types'

type WgerExerciseInfo = {
  id: number
  category?: { name?: string | null } | null
  equipment?: Array<{ name?: string | null }>
  images?: Array<{ image?: string | null; is_main?: boolean }>
  translations?: Array<{
    language?: number
    name?: string | null
    description?: string | null
  }>
}

type WgerPage = {
  count: number
  next: string | null
  results: WgerExerciseInfo[]
}

const WGER_BASE_URL = 'https://wger.de/api/v2/exerciseinfo/'
const SPANISH_LANGUAGE_ID = 4
const CACHE_TTL_MS = 1000 * 60 * 60 * 12

let exerciseCache:
  | {
      expiresAt: number
      exercises: WgerExerciseInfo[]
    }
  | null = null

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripHtml(value: string | null | undefined) {
  if (!value) return null
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreNameMatch(requestedName: string, candidateName: string) {
  const requested = normalizeText(requestedName)
  const candidate = normalizeText(candidateName)

  if (!requested || !candidate) return 0
  if (requested === candidate) return 100
  if (candidate.includes(requested) || requested.includes(candidate)) return 75

  const requestedTokens = new Set(requested.split(' '))
  const candidateTokens = new Set(candidate.split(' '))
  let overlap = 0

  requestedTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlap += 1
  })

  const tokenScore = (overlap / Math.max(requestedTokens.size, candidateTokens.size)) * 60
  return tokenScore
}

async function fetchAllWgerExercises(): Promise<WgerExerciseInfo[]> {
  if (exerciseCache && exerciseCache.expiresAt > Date.now()) {
    return exerciseCache.exercises
  }

  const exercises: WgerExerciseInfo[] = []
  let nextUrl: string | null = `${WGER_BASE_URL}?limit=200`

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`No se pudo consultar wger (${response.status})`)
    }

    const data = (await response.json()) as WgerPage
    exercises.push(...data.results)
    nextUrl = data.next
  }

  exerciseCache = {
    exercises,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }

  return exercises
}

function pickBestTranslation(exercise: WgerExerciseInfo, requestedName: string) {
  const translations = exercise.translations ?? []
  let best:
    | {
        score: number
        name: string
        description: string | null
      }
    | undefined

  for (const translation of translations) {
    const name = translation.name?.trim()
    if (!name) continue

    let score = scoreNameMatch(requestedName, name)
    if (translation.language === SPANISH_LANGUAGE_ID) score += 10
    if (score <= 0) continue

    if (!best || score > best.score) {
      best = {
        score,
        name,
        description: stripHtml(translation.description),
      }
    }
  }

  return best
}

function buildReference(requestedName: string, exercises: WgerExerciseInfo[]): ExerciseReference | null {
  let best:
    | {
        exercise: WgerExerciseInfo
        score: number
        matchedName: string
        description: string | null
      }
    | undefined

  for (const exercise of exercises) {
    const translation = pickBestTranslation(exercise, requestedName)
    if (!translation) continue
    if (!best || translation.score > best.score) {
      best = {
        exercise,
        score: translation.score,
        matchedName: translation.name,
        description: translation.description,
      }
    }
  }

  if (!best || best.score < 24) return null

  const image = best.exercise.images?.find((item) => item.is_main && item.image)?.image ?? best.exercise.images?.[0]?.image ?? null

  return {
    requestedName,
    matchedName: best.matchedName,
    description: best.description,
    imageUrl: image,
    category: best.exercise.category?.name ?? null,
    equipment: (best.exercise.equipment ?? []).map((item) => item.name?.trim()).filter((value): value is string => Boolean(value)),
    source: 'wger',
  }
}

export async function getExerciseReferences(names: string[]) {
  const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)))
  if (!uniqueNames.length) return {}

  const exercises = await fetchAllWgerExercises()
  const entries = uniqueNames.map((name) => [name, buildReference(name, exercises)] as const)

  return Object.fromEntries(entries) as Record<string, ExerciseReference | null>
}
