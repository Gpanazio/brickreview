# Como Corrigir FFmpeg no Railway

## Problema
O FFmpeg está instalado via `nixpacks.toml` mas não está sendo encontrado pelo Node.js.

## Solução 1: Adicionar Variáveis de Ambiente no Railway (RECOMENDADO)

1. Abra o painel do Railway
2. Vá para o seu projeto BrickReview
3. Clique na aba **Variables**
4. Adicione estas variáveis:

```
FFMPEG_PATH=/nix/var/nix/profiles/default/bin/ffmpeg
FFPROBE_PATH=/nix/var/nix/profiles/default/bin/ffprobe
```

5. Salve e aguarde o redeploy automático

## Solução 2: Diagnóstico (se a Solução 1 não funcionar)

Se a Solução 1 não funcionar, precisamos descobrir onde o FFmpeg realmente está:

1. No painel do Railway, vá para a aba **Deployments**
2. Clique no deployment mais recente
3. Clique em **View Logs**
4. No canto superior direito, clique em **Shell** para abrir um terminal
5. Execute:

```bash
node diagnose-ffmpeg.js
```

6. Copie a saída completa e me envie
7. Com essas informações, saberei o caminho exato do FFmpeg

## Solução 3: Variáveis Alternativas

Se os caminhos acima não funcionarem, tente estas alternativas:

### Opção A - Binários diretos do Nix Store:
```
FFMPEG_PATH=/nix/store/HASH-ffmpeg-VERSION/bin/ffmpeg
FFPROBE_PATH=/nix/store/HASH-ffmpeg-VERSION/bin/ffprobe
```
(Substitua HASH e VERSION pelos valores reais encontrados no diagnóstico)

### Opção B - Deixar o sistema encontrar:
Não configure as variáveis e o código tentará encontrar automaticamente.
Mas isso é mais lento e menos confiável.

## Por que isso é necessário?

O Nixpacks instala o FFmpeg no `/nix/store`, mas o caminho exato inclui um hash único.
As variáveis de ambiente dizem ao Node.js exatamente onde procurar, evitando buscas lentas.

## Como Verificar se Funcionou

Após adicionar as variáveis e fazer o redeploy:

1. Vá para os logs do Railway
2. No início dos logs, você deve ver:

```
✅ ffmpeg path configurado via env: /nix/var/nix/profiles/default/bin/ffmpeg
✅ ffprobe path configurado via env: /nix/var/nix/profiles/default/bin/ffprobe
```

3. Faça upload de um novo vídeo
4. Você deve ver nos logs:

```
📊 Obtendo metadados do vídeo: temp-uploads/video-123.mp4
✅ Metadados obtidos: { duration: 120, width: 1920, height: 1080, fps: 30 }
🖼️ Gerando thumbnail...
✅ Thumbnail gerada localmente: thumbnails/thumb-abc.jpg
✅ Thumbnail enviada para R2: https://...
```

## Ainda Não Funcionou?

Execute o `diagnose-ffmpeg.js` no Railway e me envie a saída completa.
