import { Pool } from 'pg';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Configura o caminho do .env para o diretório raiz do projeto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// --- Configurações de Conexão e Segurança ---

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// Prefixos permitidos para varredura (conforme as rotas analisadas)
const ALLOWED_PREFIXES = [
  'files/',
  'videos/',
  'proxies/',
  'thumbnails/',
  'project-covers/'
];

// --- Inicialização de Clientes ---

let r2Client = null;
if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
  r2Client = new S3Client({
    region: 'auto',
    // CORREÇÃO RADICAL: Usando concatenação para evitar erro de parsing do template literal
    endpoint: 'https://' + R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
} else {
  console.warn('⚠️  AVISO: Configuração do R2 incompleta. A verificação do R2 será ignorada.');
}

let dbPool = null;
if (DATABASE_URL) {
  dbPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  console.log('✅ Pool do PostgreSQL inicializada.');
} else {
  console.warn('⚠️  AVISO: DATABASE_URL não encontrada. A verificação do Banco de Dados será ignorada.');
}

// --- Funções de Banco de Dados ---

/**
 * Consulta e retorna todas as chaves R2 válidas referenciadas no banco.
 * @returns {Set<string>} Conjunto de chaves R2 válidas.
 */
async function getDatabaseWhitelist() {
  if (!dbPool) return new Set();

  console.log('🔍 Buscando chaves válidas (Whitelist) no banco de dados...');
  
  const validKeys = new Set();

  try {
    // 1. Arquivos (Tabela: brickreview_files)
    const filesQuery = await dbPool.query(`
      SELECT 
        r2_key, 
        thumbnail_r2_key 
      FROM brickreview_files 
      WHERE r2_key IS NOT NULL
    `);
    filesQuery.rows.forEach(row => {
      if (row.r2_key) validKeys.add(row.r2_key);
      if (row.thumbnail_r2_key) validKeys.add(row.thumbnail_r2_key);
    });

    // 2. Vídeos (Tabela: brickreview_videos)
    const videosQuery = await dbPool.query(`
      SELECT 
        r2_key, 
        thumbnail_r2_key, 
        proxy_r2_key 
      FROM brickreview_videos 
      WHERE r2_key IS NOT NULL
    `);
    videosQuery.rows.forEach(row => {
      if (row.r2_key) validKeys.add(row.r2_key);
      if (row.thumbnail_r2_key) validKeys.add(row.thumbnail_r2_key);
      if (row.proxy_r2_key) validKeys.add(row.proxy_r2_key);
    });

    // 3. Projetos (Tabela: brickreview_projects)
    const projectsQuery = await dbPool.query(`
      SELECT 
        cover_image_r2_key 
      FROM brickreview_projects 
      WHERE cover_image_r2_key IS NOT NULL
    `);
    projectsQuery.rows.forEach(row => {
      if (row.cover_image_r2_key) validKeys.add(row.cover_image_r2_key);
    });

    console.log('✅ Encontradas ' + validKeys.size + ' chaves únicas no banco de dados.');
    return validKeys;

  } catch (error) {
    console.error('❌ Erro ao consultar o banco de dados para construir a whitelist:', error);
    // Se falhar, retornamos um set vazio, mas o script deve prosseguir para a listagem do R2 se possível.
    return new Set();
  }
}

// --- Funções de R2 ---

/**
 * Lista todos os objetos no bucket R2, aplicando filtro de prefixo e retornando as chaves.
 * @returns {Promise<Set<string>>} Conjunto de todas as chaves R2 filtradas.
 */
async function listR2Objects() {
  if (!r2Client) return new Set();

  console.log('🔍 Listando objetos no bucket \'' + R2_BUCKET_NAME + '\' com prefixos permitidos...');
  
  const allKeys = new Set();
  let isTruncated = true;
  let continuationToken = undefined;

  try {
    while (isTruncated) {
      const result = await r2Client.send(new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: '', // Lista tudo sob o bucket
        ContinuationToken: continuationToken,
      }));

      if (result.Contents) {
        result.Contents.forEach(item => {
          const key = item.Key;
          // Aplica o filtro de prefixo de segurança
          const isKeyAllowed = ALLOWED_PREFIXES.some(prefix => key.startsWith(prefix));

          if (isKeyAllowed) {
            allKeys.add(key);
          }
        });
      }

      isTruncated = result.IsTruncated;
      continuationToken = result.NextContinuationToken;
      
      if (isTruncated) {
        // Segurança: evita logar token inteiro se for muito longo
        console.log('...continuando listagem, token: ' + (continuationToken ? continuationToken.substring(0, 10) : 'undefined') + '...');
      }
    }
    
    console.log('✅ Listagem completa. Encontradas ' + allKeys.size + ' chaves R2 válidas (filtradas por prefixo).');
    return allKeys;

  } catch (error) {
    console.error('❌ Erro crítico ao listar objetos do R2:', error);
    return new Set();
  }
}

// --- Função Principal de Limpeza ---

async function cleanupR2() {
  console.log('--- INICIANDO SCRIPT DE LIMPEZA R2 (DRY RUN) ---');
  
  const dbWhitelist = await getDatabaseWhitelist();
  const r2Keys = await listR2Objects();

  if (!r2Client) {
      console.log('🛑 R2 não configurado. Nenhuma operação de listagem de objetos realizada.');
      // Fecha o pool do DB se existir, mesmo que R2 tenha falhado
      if (dbPool) await dbPool.end();
      return;
  }
  
  if (!dbPool && r2Keys.size > 0) {
      console.warn('⚠️  AVISO: Banco de dados não acessível. Não é possível determinar quais arquivos apagar. Listando apenas arquivos R2 dentro dos prefixos permitidos.');
      console.log('Arquivos encontrados (todos seriam órfãos se o DB estivesse funcionando):');
      console.log(Array.from(r2Keys).sort().join('\\n'));
  }
  
  // Comparação: Chaves no R2 - Chaves no DB
  const orphanedKeys = Array.from(r2Keys).filter(key => !dbWhitelist.has(key));
  
  console.log('\\n--- RESULTADO DO DRY RUN (ARQUIVOS ÓRFÃOS IDENTIFICADOS) ---');
  console.log('Total de chaves R2 dentro dos prefixos: ' + r2Keys.size);
  console.log('Total de chaves no DB: ' + dbWhitelist.size);
  console.log('Total de arquivos órfãos (sem registro no DB): ' + orphanedKeys.length);
  console.log('-----------------------------------------------------');
  
  if (orphanedKeys.length > 0) {
    console.log('CHAVES R2 CANDIDATAS À EXCLUSÃO (DRY RUN):');
    orphanedKeys.forEach(key => console.log(key));
    console.log('\\n⚠️  NENHUM ARQUIVO FOI DELETADO. Para deletar, remova o comentário da função "deleteOrphanedObjects" e rode o script novamente.');
  } else {
    console.log('🎉 Nenhum arquivo órfão encontrado dentro dos prefixos permitidos.');
  }

  // Função de exclusão real (descomentar para ativar)
  /*
  if (orphanedKeys.length > 0) {
    console.log('\\n--- INICIANDO EXCLUSÃO REAL ---');
    await deleteOrphanedObjects(orphanedKeys);
  }
  */

  // Fechar pools
  if (dbPool) await dbPool.end();
  console.log('\\n--- SCRIPT DE LIMPEZA CONCLUÍDO ---');
}

/**
 * Exclui os objetos do R2 em lote.
 * ATENÇÃO: Esta função é destrutiva e está comentada por segurança.
 * @param {string[]} keysToDelete - Array de chaves a serem deletadas.
 */
async function deleteOrphanedObjects(keysToDelete) {
    if (!r2Client || !R2_BUCKET_NAME) return;

    console.log('\\n🚨 DELETANDO ' + keysToDelete.length + ' OBJETOS DO R2...');

    // O S3/R2 aceita até 1000 objetos por requisição de DeleteObjects
    const BATCH_SIZE = 1000;
    for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
        const batch = keysToDelete.slice(i, i + BATCH_SIZE);
        
        const objectsToDelete = batch.map(key => ({ Key: key }));
        
        try {
            await r2Client.send(new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: {
                    Objects: objectsToDelete,
                    Quiet: false
                }
            }));
            console.log('   -> Lote deletado com sucesso (objetos ' + (i + 1) + ' a ' + Math.min(i + BATCH_SIZE, keysToDelete.length) + ')');
        } catch (error) {
            console.error('❌ Erro ao deletar lote de objetos (índices ' + i + ' a ' + (i + BATCH_SIZE - 1) + '):', error);
        }
    }
    console.log('✅ Exclusão de objetos do R2 concluída.');
}


cleanupR2().catch(err => {
  console.error('\\n--- FALHA FATAL NA EXECUÇÃO DO SCRIPT ---', err);
  if (dbPool) dbPool.end();
  process.exit(1);
});