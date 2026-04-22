import { Pool, type QueryResult, type QueryResultRow } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __gymTrackerPgPool: Pool | undefined
}

function getConnectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  )
}

function normalizeConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('channel_binding')
    return url.toString()
  } catch {
    return connectionString
  }
}

function createPool() {
  const rawConnectionString = getConnectionString()

  if (!rawConnectionString) {
    throw new Error("No se ha encontrado ninguna variable POSTGRES_* en el entorno.")
  }

  const connectionString = normalizeConnectionString(rawConnectionString)
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

  return new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  })
}

function getPool() {
  if (!global.__gymTrackerPgPool) {
    global.__gymTrackerPgPool = createPool()
  }

  return global.__gymTrackerPgPool
}

type SqlResult<T extends QueryResultRow> = QueryResult<T>

export async function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: Array<string | number | boolean | null | undefined>
): Promise<SqlResult<T>> {
  const text = strings.reduce((acc, part, index) => {
    if (index === 0) return part
    return `${acc}$${index}${part}`
  }, '')

  return getPool().query<T>(text, values)
}
