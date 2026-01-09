import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.warn('⚠️  DATABASE_URL not set. Database features will be disabled.')
  console.warn('   Set DATABASE_URL in your .env file to enable database.')
}

// Detect environment
const isLocal = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
const isRailwayInternal = connectionString?.includes('railway.internal')
const useSSL = connectionString && !isLocal && !isRailwayInternal

// Create connection pool
export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 20,
    })
  : null

// Test connection on startup
if (pool) {
  pool
    .query('SELECT NOW() as current_time, version() as pg_version')
    .then((res) => {
      console.log('✅ Database connected successfully')
      console.log(`   Time: ${res.rows[0].current_time}`)
      console.log(`   PostgreSQL: ${res.rows[0].pg_version.split(',')[0]}`)
    })
    .catch((err) => {
      console.error('❌ Database connection failed:', err.message)
      console.error('   Check your DATABASE_URL in .env')
    })
}

// Query helper function
export function query(text, params) {
  if (!pool) {
    throw new Error('Database not configured. Set DATABASE_URL in your .env file.')
  }
  return pool.query(text, params)
}

// Transaction helper
export async function transaction(callback) {
  if (!pool) {
    throw new Error('Database not configured')
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (pool) {
    console.log('\n🛑 Closing database connections...')
    await pool.end()
    console.log('✅ Database connections closed')
  }
  process.exit(0)
})

export default pool
