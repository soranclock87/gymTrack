import { buildBlockBlueprint, summarizeHistoryForPrompt } from '@/lib/training/planner'
import type { BlockReview, ExerciseProgressPoint, TrainingBlockBlueprint } from '@/lib/training/types'

type CoachGenerationInput = {
  goal?: string
  weeks?: number
  startDate?: string
  historyMap: Record<string, ExerciseProgressPoint[]>
  review?: BlockReview | null
}

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

function getModelConfig() {
  const baseUrl = process.env.OPENAI_BASE_URL?.replace(/\/$/, '') || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const apiKey = process.env.OPENAI_API_KEY?.trim() || ''
  const isLocal =
    baseUrl.includes('127.0.0.1') ||
    baseUrl.includes('localhost') ||
    baseUrl.includes('0.0.0.0') ||
    baseUrl.includes('11434')

  return {
    baseUrl,
    model,
    apiKey,
    isLocal,
  }
}

function extractJsonObject(content: string) {
  const firstBrace = content.indexOf('{')
  const lastBrace = content.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }

  return content.slice(firstBrace, lastBrace + 1)
}

async function callOpenAiCompatible(prompt: string) {
  const { apiKey, baseUrl, model, isLocal } = getModelConfig()
  if (!apiKey && !isLocal) return null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const body: Record<string, unknown> = {
    model,
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content:
          'Eres un coach de fuerza e hipertrofia. Responde solo con JSON válido. Diseña bloques simples, realistas y conservadores para un usuario recreativo.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  }

  if (isLocal) {
    body.format = 'json'
  } else {
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Error llamando al modelo: ${response.status}`)
  }

  const json = (await response.json()) as OpenAIChatResponse
  return json.choices?.[0]?.message?.content ?? null
}

function validateBlueprint(value: unknown): TrainingBlockBlueprint | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as TrainingBlockBlueprint

  if (!candidate.title || !candidate.goal || !candidate.weeks || !candidate.startDate || !Array.isArray(candidate.sessions)) {
    return null
  }

  return candidate
}

export async function generateCoachBlock(input: CoachGenerationInput): Promise<{ blueprint: TrainingBlockBlueprint; source: 'ai' | 'rules' }> {
  const fallback = buildBlockBlueprint(
    {
      goal: input.goal,
      weeks: input.weeks,
      startDate: input.startDate,
    },
    input.historyMap
  )

  const { apiKey, isLocal } = getModelConfig()
  if (!apiKey && !isLocal) {
    return { blueprint: fallback, source: 'rules' }
  }

  const prompt = `
Genera un bloque de entrenamiento en JSON con estas propiedades exactas:
- title
- goal
- weeks
- startDate
- notes
- rationale
- generatedBy
- sessions: array de objetos con weekIndex, dayIndex, dayLabel, title, focus, notes y exercises
- exercises: array de objetos con exerciseName, muscleGroup, orderIndex, targetSets, minReps, maxReps, targetRir, suggestedWeight y notes

Restricciones:
- Devuelve 4 sesiones por semana.
- Usa semanas numeradas desde 1.
- Si hay signos de fatiga, mete descarga en la última semana.
- Mantén nombres de ejercicios en español.
- No inventes RM ni cargas absurdas.
- generatedBy debe ser "ai".

Objetivo: ${input.goal ?? 'Hipertrofia con progresión sostenible'}
Semanas: ${input.weeks ?? 4}
Fecha de inicio: ${input.startDate ?? new Date().toISOString().split('T')[0]}

Histórico resumido:
${summarizeHistoryForPrompt(input.historyMap)}

Revisión del bloque previo:
${input.review ? JSON.stringify(input.review) : 'Sin revisión previa'}
`.trim()

  try {
    const content = await callOpenAiCompatible(prompt)
    if (!content) {
      return { blueprint: fallback, source: 'rules' }
    }

    const rawJson = extractJsonObject(content)
    if (!rawJson) {
      return { blueprint: fallback, source: 'rules' }
    }

    const parsed = JSON.parse(rawJson)
    const blueprint = validateBlueprint(parsed)
    if (!blueprint) {
      return { blueprint: fallback, source: 'rules' }
    }

    blueprint.generatedBy = 'ai'
    return { blueprint, source: 'ai' }
  } catch {
    return { blueprint: fallback, source: 'rules' }
  }
}
