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

    // Se as tabelas existem, verificamos se a brickreview_shares e as views necessárias existem
    if (tablesExist && process.env.RESET_DB !== 'true') {
      const shareTableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'brickreview_shares'
        ) as exists
      `)

      const requiredViews = [
        'brickreview_projects_with_stats',
        'brickreview_videos_with_stats',
        'brickreview_comments_with_user',
        'brickreview_folders_with_stats',
      ]

      const viewsCheck = await query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_name = ANY($1)
      `, [requiredViews])

      const existingViews = new Set(viewsCheck.rows.map(row => row.table_name))
      const missingViews = requiredViews.filter(view => !existingViews.has(view))

      if (shareTableCheck.rows[0].exists && missingViews.length === 0) {
        console.log('✅ Database schema already initialized. Skipping setup.')
        return
      }

      if (!shareTableCheck.rows[0].exists) {
        console.log('📦 Main tables exist but brickreview_shares is missing. Updating schema...')
      }

      if (missingViews.length > 0) {
        console.log('📦 Main tables exist but some views are missing. Updating schema...')
        console.log('   Missing views:', missingViews.join(', '))
      }
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

    // First, force drop all views to avoid column rename conflicts
    // This must be done separately before running the main SQL
    try {
      await query(`
        DROP VIEW IF EXISTS brickreview_projects_with_stats CASCADE;
        DROP VIEW IF EXISTS brickreview_videos_with_stats CASCADE;
        DROP VIEW IF EXISTS brickreview_comments_with_user CASCADE;
        DROP VIEW IF EXISTS brickreview_folders_with_stats CASCADE;
      `)
      console.log('🗑️  Dropped existing views to avoid conflicts')
    } catch (viewError) {
      // Ignore errors if views don't exist
      console.log('⚠️  Could not drop views (may not exist):', viewError.message)
    }

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
