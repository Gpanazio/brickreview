#!/usr/bin/env node

/**
 * Script de diagnóstico para encontrar FFmpeg no Railway
 * Executa este script no Railway para descobrir onde o FFmpeg está instalado
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🔍 Diagnóstico FFmpeg\n');

// 1. Verificar variáveis de ambiente
console.log('1️⃣  Variáveis de ambiente:');
console.log('   FFMPEG_PATH:', process.env.FFMPEG_PATH || '(não definida)');
console.log('   FFPROBE_PATH:', process.env.FFPROBE_PATH || '(não definida)');
console.log('   PATH:', process.env.PATH?.split(':').slice(0, 5).join(':'), '...\n');

// 2. Tentar which
console.log('2️⃣  Tentando comando "which":');
try {
  const ffmpegWhich = execSync('which ffmpeg', { encoding: 'utf8' }).trim();
  console.log('   ✅ ffmpeg:', ffmpegWhich);
} catch {
  console.log('   ❌ ffmpeg não encontrado via which')
}

try {
  const ffprobeWhich = execSync('which ffprobe', { encoding: 'utf8' }).trim();
  console.log('   ✅ ffprobe:', ffprobeWhich);
} catch {
  console.log('   ❌ ffprobe não encontrado via which')
}
console.log();

// 3. Verificar caminhos comuns
console.log('3️⃣  Verificando caminhos comuns:');
const commonPaths = [
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
];

for (const path of commonPaths) {
  if (fs.existsSync(path)) {
    console.log(`   ✅ ${path} existe`);
  } else {
    console.log(`   ❌ ${path} não existe`);
  }
}
console.log();

// 4. Procurar no /nix/store (Railway/Nixpacks)
console.log('4️⃣  Procurando no /nix/store:');
if (fs.existsSync('/nix/store')) {
  console.log('   ℹ️  /nix/store existe, procurando FFmpeg...');
  try {
    const result = execSync('find /nix/store -name ffmpeg -type f 2>/dev/null | head -3', {
      encoding: 'utf8',
      timeout: 10000
    }).trim();

    if (result) {
      console.log('   ✅ Encontrados:');
      result.split('\n').forEach(line => console.log('      -', line));
    } else {
      console.log('   ❌ Nenhum ffmpeg encontrado no /nix/store');
    }
  } catch (err) {
    console.log('   ❌ Erro ao procurar:', err.message);
  }
} else {
  console.log('   ℹ️  /nix/store não existe (não é um ambiente Nixpacks)');
}
console.log();

// 5. Listar pacotes nix instalados
console.log('5️⃣  Verificando instalação do Nixpacks:');
try {
  const nixProfile = execSync('ls -la /nix/var/nix/profiles/default/bin/ 2>/dev/null | grep -E "ffmpeg|ffprobe"', {
    encoding: 'utf8'
  }).trim();

  if (nixProfile) {
    console.log('   ✅ Encontrados no profile padrão:');
    console.log(nixProfile.split('\n').map(l => '      ' + l).join('\n'));
  }
} catch {
  console.log('   ℹ️  Não foi possível listar o profile do Nix')
}

console.log('\n✨ Diagnóstico completo!')
