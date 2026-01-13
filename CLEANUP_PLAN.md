# 🧹 Plano de Limpeza de Código v2.0 (Otimizado)

**Status:** Pronto para Execução
**Prioridade:** Crítica (Bloqueia Refatoração v0.6)
**Estimativa:** 2-3 horas

---

## 📋 Etapa 0: Pré-requisitos e Segurança
- [ ] **Backup**: Garantir que o código atual está commitado em uma branch segura (ex: `main` ou `backup-pre-cleanup`).
- [ ] **Smoke Test**: Rodar `npm run dev` e verificar se o upload e o player básico funcionam antes de tocar em qualquer coisa.

## 📦 Etapa 1: Higiene de Dependências (Package.json)
*Reduzir o bundle size e preparar o ambiente de formatação.*

- [ ] **Remover Pacotes Obsoletos**:
    - `npm uninstall plyr-react react-aptor` (O projeto usa `plyr` nativo e `aptor` não é usado).
- [ ] **Instalar Ferramentas de Dev**:
    - `npm install -D prettier`

## 🎨 Etapa 2: Padronização e Formatação (Automático)
*Normalizar o código antes de ler a lógica.*

- [ ] **Configurar Prettier**: Criar arquivo `.prettierrc` (já criado).
- [ ] **Formatação em Massa**:
    - `npx prettier --write "src/**/*.{js,jsx,css}" "server/**/*.js"`
- [ ] **Linting Inicial**:
    - `npm run lint -- --fix` (Resolve problemas simples de espaçamento e imports).

## 🛠️ Etapa 3: Correções Manuais Críticas (Lógica)
*Resolver os erros que o `--fix` não consegue.*

- [ ] **CreateFolderDialog.jsx**:
    - **Erro:** `setState` dentro de `useEffect` sem condições adequadas.
    - **Ação:** Refatorar para usar valor inicial ou `useMemo` se necessário, evitando loops de renderização.
- [ ] **VideoPlayer.jsx**:
    - Remover variáveis não usadas (ex: `savedTime`).
- [ ] **Server/Scripts**:
    - `server/routes/cleanup-r2.js`: Remover import `fs` não usado.
    - `server/routes/videos.js`: Remover variável `downloadType`.

## 🧹 Etapa 4: Limpeza de Ruído (Logs)
*Limpar a saída do console para facilitar o debug futuro.*

- [ ] **Frontend (`src/`)**:
    - Remover `console.log` de debug em `VideoPlayer.jsx`, `App.jsx`, `ProjectDetailPage.jsx`.
    - Manter apenas `console.error` em blocos `catch`.
- [ ] **Backend (`server/`)**:
    - **MANTER**: Logs de startup (`index.js`), conexão DB (`db.js`) e progresso do FFmpeg (`video.js`).
    - Remover: Logs de dados brutos de requisições excessivamente verbosos.

## 🔮 Etapa 5: Remoção de "Magic Strings"
*Preparar para o Design System.*

- [ ] **Cores de Desenho**:
    - Criar `src/constants/drawing.js` (já criado).
    - Substituir arrays de cores hardcoded `['#FF0000', ...]` no `VideoPlayer.jsx` pela constante importada.
- [ ] **CSS Variables**:
    - Verificar `VideoPlayer.css` e substituir `#DC2626` por variáveis CSS globais se possível, ou garantir consistência com o Tailwind (`text-red-600`).

## 📂 Etapa 6: Organização Estrutural
*Arrumar a casa.*

- [ ] **Scripts Soltos**:
    - Mover `diagnose-ffmpeg.js` da raiz para a pasta `scripts/`.
- [ ] **CSS Isolado**:
    - Avaliar mover `VideoPlayer.css` para `src/components/player/styles/` se planejar dividir o player.

## ✅ Etapa 7: Validação Final
1. `npm run lint` deve retornar **zero erros**.
2. `npm run build` deve compilar sem warnings críticos.
3. Teste manual: Upload de vídeo -> Playback -> Desenho -> Comentário.
