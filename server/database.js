import { pool, query } from './db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function initDatabase() {
  if (!pool) {
    console.error('\n❌ ERRO CRÍTICO: DATABASE_URL não configurada!')
    console.error('╔═══════════════════════════════════════════════════════════╗')
    console.error('║  O servidor NÃO PODE INICIAR sem conexão com o banco!  ║')
    console.error('╚═══════════════════════════════════════════════════════════╝')
    console.error('\n💡 Solução:')
    console.error('   1. Certifique-se que o arquivo .env existe no diretório server/')
    console.error('   2. O arquivo .env deve conter a variável DATABASE_URL')
    console.error('   3. Exemplo:')
    console.error('      DATABASE_URL=postgresql://user:pass@host:port/database\n')

    throw new Error('DATABASE_URL não configurada. O servidor não pode funcionar sem banco de dados.')
  }

  try {
    // Verifica se as tabelas principais já existem
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'brickreview_projects'
      ) as exists
    `)

    const tablesExist = tableCheck.rows[0].exists

    // Se as tabelas existem, verificamos se a brickreview_shares também existe
    if (tablesExist && process.env.RESET_DB !== 'true') {
      const shareTableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'brickreview_shares'
        ) as exists
      `)
      
      if (shareTableCheck.rows[0].exists) {
        console.log('✅ Database schema already initialized. Skipping setup.')
        return
      }
      console.log('📦 Main tables exist but brickreview_shares is missing. Updating schema...')
    }

    console.log('🔄 Initializing database schema...')

    // Check if master_users table exists
    const masterUsersCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'master_users'
      ) as exists
    `)

    if (!masterUsersCheck.rows[0].exists) {
      throw new Error('master_users table not found')
    }

    const sqlFile = path.join(__dirname, 'database.sql')
    if (!fs.existsSync(sqlFile)) return

    const sql = fs.readFileSync(sqlFile, 'utf8')

    // Execute setup
    await query(sql)
    console.log('✅ Database schema initialized successfully')

    // Log table statistics
    const stats = await query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE tablename LIKE 'brickreview_%' OR tablename = 'master_users'
      ORDER BY tablename
    `)

    console.log('\n📊 Database tables:')
    stats.rows.forEach(row => {
      const icon = row.tablename === 'master_users' ? '🔗' : '📦'
      console.log(`   ${icon} ${row.tablename} (${row.size})`)
    })
    console.log('')

  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message)

    if (error.message.includes('master_users')) {
      console.error('\n💡 Solution:')
      console.error('   1. Use the same DATABASE_URL as brickprojects or BrickAI')
      console.error('   2. Or create master_users table first:')
      console.error('      CREATE TABLE master_users (')
      console.error('        id SERIAL PRIMARY KEY,')
      console.error('        username VARCHAR(100) UNIQUE NOT NULL,')
      console.error('        email VARCHAR(255) UNIQUE NOT NULL,')
      console.error('        password_hash VARCHAR(255) NOT NULL,')
      console.error('        role VARCHAR(50) DEFAULT \'admin\',')
      console.error('        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      console.error('      );')
    }

    throw error
  }
}

// Helper para verificar se o banco está pronto
export async function isDatabaseReady() {
  if (!pool) return false

  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'brickreview_projects'
      ) as exists
    `)
    return result.rows[0].exists
  } catch (error) {
    return false
  }
}

export default { initDatabase, isDatabaseReady }
