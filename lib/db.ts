import { sql } from '@vercel/postgres'

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
  const result = await sql`
    SELECT date, MAX(weight) as max_weight, SUM(sets) as total_sets
    FROM exercise_logs
    WHERE exercise = ${exercise}
    GROUP BY date
    ORDER BY date ASC
    LIMIT 30
  `
  return result.rows
}

export async function addExerciseLog(
  date: string, exercise: string, muscleGroup: string,
  sets: number, reps: number, weight: number, notes?: string
) {
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
    SELECT DISTINCT exercise, muscle_group FROM exercise_logs ORDER BY exercise
  `
  return result.rows
}
