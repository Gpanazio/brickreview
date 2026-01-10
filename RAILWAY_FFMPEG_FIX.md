# Correção do FFmpeg no Railway

Este documento explica como o problema de detecção do FFmpeg e FFprobe foi resolvido no ambiente de produção do Railway e como garantir que ele não volte a ocorrer.

## O Problema

O Railway usa Nixpacks para criar imagens de container. Frequentemente, os binários do FFmpeg instalados via Nix não são expostos corretamente no `PATH` do sistema ou são instalados em caminhos não-padrão dentro do `/nix/store`, fazendo com que a aplicação não consiga encontrá-los.

Sintomas:
- Erro `⚠️ ffmpeg não encontrado no sistema` nos logs
- Falha ao gerar thumbnails
- Falha ao processar vídeos

## A Solução (Implementada)

A solução definitiva consiste em uma abordagem de "defesa em profundidade" com três camadas de redundância:

### 1. Instalação Híbrida (APT + Nix)
No arquivo `nixpacks.toml`, configuramos para tentar instalar o FFmpeg usando ambos os gerenciadores de pacotes:

```toml
[phases.setup]
# Tenta via Nix (backup)
nixPkgs = ['nodejs', 'ffmpeg-full']
# Tenta via APT (principal - instala em /usr/bin)
aptPkgs = ['ffmpeg']
```

O método **APT** é o preferido pois instala os binários em `/usr/bin/ffmpeg`, um local padrão que raramente falha.

### 2. Script de Inicialização Inteligente (`railway-start.sh`)
O script de boot da aplicação foi fortificado para procurar os binários em múltiplos locais:

1. Verifica o `PATH` do sistema (`which ffmpeg`)
2. Verifica locais padrão absolutos (`/usr/bin`, `/usr/local/bin`)
3. Faz uma busca profunda no `/nix/store`
4. Faz uma busca global no sistema (`find / -name ffmpeg`)
5. Como último recurso, tenta instalar via `apt-get` em tempo de execução (se for root)

### 3. Configuração de Boot
O `package.json` e o `nixpacks.toml` foram configurados para forçar o uso do script `railway-start.sh` em vez de iniciar o node diretamente:

```json
"scripts": {
  "start": "chmod +x railway-start.sh && ./railway-start.sh"
}
```

## Como Manter

Para garantir que o problema não retorne:

1. **Nunca remova** a linha `aptPkgs = ['ffmpeg']` do `nixpacks.toml`.
2. **Sempre use** o `railway-start.sh` como comando de inicialização.
3. Se for adicionar novas dependências de sistema, prefira adicionar em `aptPkgs` se possível.

## Diagnóstico

Se o problema voltar, verifique os logs de inicialização. O script agora emite logs detalhados:
- `✅ FFmpeg encontrado: [caminho]`
- `🧪 Testando execução do FFmpeg...`

Se vir `⚠️ FFmpeg não encontrado`, o script listará automaticamente o conteúdo de diretórios chave para ajudar no debug.
