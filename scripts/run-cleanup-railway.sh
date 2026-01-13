#!/bin/bash

# Este script é projetado para ser executado no ambiente Railway, onde
# as variáveis de ambiente (DB e R2) devem estar configuradas.

SCRIPT_PATH="./scripts/cleanup-r2.js"

echo "Iniciando o script de limpeza de R2 no ambiente Railway..."

# Verifica se o script principal existe
if [ ! -f "$SCRIPT_PATH" ]; then
  echo "ERRO: Script de limpeza principal não encontrado em $SCRIPT_PATH"
  exit 1
fi

# Executa o script de limpeza com Node.js
# Ele irá se conectar ao DB e R2 usando as variáveis de ambiente do Railway.
# Se o DB falhar, ele tentará apagar todos os arquivos monitorados no R2.
node "$SCRIPT_PATH"

if [ $? -eq 0 ]; then
  echo "---"
  echo "✅ Limpeza de R2 finalizada com sucesso (ou falha segura se credenciais ausentes)."
else
  echo "---"
  echo "❌ O script de limpeza retornou um erro fatal. Verifique o log acima."
fi