# Lua Gestação — Contexto do Projeto

## Visão Geral
SPA single-file (`index.html` ~4300 linhas). Backend 100% Supabase (Auth + Postgres + Realtime).
Sem build, sem bundler — abre direto no browser. Deploy via Vercel (conectado ao GitHub, deploy automático no push para main). Domínio: luamaterna.com.

## Arquitetura

### Papéis de usuário
- **gestante** — usa o app para contrações, diário, plano de parto, conteúdos, chat IA, marketplace
- **doula** — painel com dashboard, lista de clientes, agenda, biblioteca, FAQ
- **admin** — painel oculto (`/admin`) para gerenciar usuários e conteúdos

### Tabelas Supabase
| Tabela | Descrição |
|---|---|
| `usuarios` | Perfil do usuário. `id = auth.uid()`. Campos: `nome, email, tipo (gestante/doula), doula_id, whatsapp, cidade, especialidades, bio` |
| `solicitacoes` | Vínculo gestante↔doula. Campos: `gestante_id, doula_id, gestante_nome, status (pendente/aceita/recusada), criado_em` |
| `contracoes` | Histórico de contrações da gestante. Campos: `gestante_id, inicio, fim, duracao_ms, intervalo_ms` |
| `biblioteca` | Materiais da doula (PDF, vídeo, link). Gerenciada pelo admin |

### FKs importantes
- `solicitacoes.gestante_id` e `solicitacoes.doula_id` referenciam **`auth.users(id)`** (não `usuarios`) — gestante pode existir em auth sem ter linha em `usuarios`

## Regras de RLS conhecidas
- **Doula NÃO pode fazer UPDATE em `usuarios` de outra pessoa** — tentativa de atualizar `doula_id` na linha da gestante falha silenciosamente
- **Fonte de verdade para vínculo gestante↔doula é `solicitacoes`** (status `aceita`), não `usuarios.doula_id`
- `contracoes` precisa de política SELECT para doula via join com `solicitacoes`

## Fluxo de vínculo gestante↔doula
1. Gestante abre marketplace → clica "Escolher" → `vincularDoula()` insere em `solicitacoes` (status `pendente`)
2. Doula vê solicitação no painel → clica "Aceitar" → `aceitarSolicitacao()` atualiza status para `aceita`
3. Gestante recebe notificação via Realtime → `currentDoulaId` é atualizado em memória
4. No reload, `carregarUsuario()` sincroniza `currentDoulaId` via query em `solicitacoes` (status `aceita`) se `usuarios.doula_id` estiver vazio

## Funções principais

### Auth / Sessão
- `fazerLogin()` / `fazerCadastro()` / `fazerLogout()`
- `carregarUsuario(user)` — popula estado global após login. Verifica solicitação pendente e doula vinculada
- `entrarNoApp(tipo, nome)` — renderiza UI do papel correto e dispara os carregamentos

### Gestante
- `carregarMarketplace()` / `renderDoulas()` — lista doulas disponíveis
- `vincularDoula(doulaId, nomeDoula, btnRef)` — envia solicitação
- `mostrarCardAguardando(nomeDoula)` — exibe estado de espera
- `iniciarRealtimeSolicitacoesGestante(solId)` — escuta aceite/recusa em tempo real
- `carregarMinhaDoula()` — carrega info da doula vinculada na sidebar
- `timerAction()` / `renderContractions()` — timer de contrações (salva em `contracoes`)
- `atualizarDashboardGestante(dpp)` — calcula semana gestacional a partir da DPP
- `enviarMensagemIA(msg)` — chat via `/api/chat` (Vercel serverless, chave OpenAI protegida)

### Doula
- `carregarSolicitacoesDoula()` — lista pendentes, atualiza badge e banner
- `aceitarSolicitacao(solId, gestanteId, gestanteNome)` — aceita e tenta atualizar `usuarios` (não-crítico se falhar por RLS)
- `carregarClientesDoula()` — busca clientes via `solicitacoes` (status `aceita`), NÃO via `usuarios.doula_id`
- `iniciarRealtimeDoula(gestanteId)` — escuta contrações da gestante em tempo real
- `iniciarRealtimeSolicitacoesDoula()` — escuta novas solicitações

## Estado global relevante
```js
currentUserId      // auth.uid()
currentDoulaId     // id da doula vinculada (gestante) ou null
currentNome        // nome do usuário logado
currentSolicitacaoPendente  // { id, doulaId, nomeDoula } — solicitação em aberto
realtimeChannel             // canal de contrações
realtimeChannelSolicitacoes // canal de solicitações
```

## Padrões do código
- Sem framework — JS vanilla, funções globais, DOM direto
- Supabase JS v2 via CDN (`supabase.createClient`)
- `.maybeSingle()` para queries que podem retornar 0 linhas (`.single()` causa erro 406)
- Erros de RLS geralmente falham silenciosamente (sem `throw`) — checar se update afetou 0 linhas
- Realtime via `db.channel(...).on('postgres_changes', ...)` 

## O que ignorar no console
- Erros do Spotify (`spclient.wg.spotify.com`, `widevine`) — DRM interno, sem solução
- Avisos de LF/CRLF do git no Windows — inofensivo
