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

**Originais:**
| Tabela | Descrição |
|---|---|
| `usuarios` | Perfil do usuário. `id = auth.uid()`. Campos: `nome, email, tipo (gestante/doula), doula_id, whatsapp, cidade, especialidades, bio` |
| `solicitacoes` | Vínculo gestante↔doula. Campos: `gestante_id, doula_id, gestante_nome, status (pendente/aceita/recusada), criado_em` |
| `contracoes` | Histórico de contrações da gestante. Campos: `gestante_id, inicio, fim, duracao_ms, intervalo_ms` |
| `biblioteca` | Materiais da doula (PDF, vídeo, link). Gerenciada pelo admin |

**Criadas (existem no Supabase):**
| Tabela | Campos principais |
|---|---|
| `clientes_doula` | `doula_id, nome, telefone, dpp, semanas_gestacional, tipo_parto, hospital, medico, historico_gestacional, estado_emocional, observacoes, criado_em` |
| `consultas_doula` | `doula_id, cliente_nome, cliente_externo_id, gestante_id, data_hora, tipo, observacoes` |
| `registros_atendimento` | `doula_id, cliente_nome, cliente_externo_id, gestante_id, data, tipo, anotacoes, evolucao, criado_em` |
| `registros_posparto` | `doula_id, cliente_nome, cliente_externo_id, gestante_id, data_visita, dias_posparto, amamentacao, recuperacao, observacoes_bebe, evolucao, criado_em` |
| `mensagens` | `gestante_id, doula_id, remetente_tipo, texto, criado_em` |
| `reportes` | `gestante_id, gestante_nome, usuario_nome, tipo_usuario, mensagem_lua, descricao, lido, resposta, criado_em` |
| `sessoes` | `user_id, tipo, inicio, fim, duracao_ms, nome, email` |
| `convites_pai` | `gestante_id, codigo, usado` |
| `diario_gestante` | `gestante_id, conteudo, humor, semana, criado_em` |
| `diario_pai` | `pai_id, categoria, conteudo, humor, criado_em` |
| `backup_doulas` | `doula_id, backup_email, perm_agenda, perm_chat, perm_registros` |

**Também existem no Supabase:**
| Tabela | Campos principais |
|---|---|
| `contratos_doula` | `doula_id, cliente_nome, cliente_externo_id, gestante_id, valor, parcelas, status, contrato_url, criado_em` |
| `avaliacoes_doula` | `gestante_id, doula_id, gestante_nome, nota, tipo_parto, comentario, cidade, modalidade, data_parto, criado_em` |
| `configuracoes` | `chave (PK), valor` — usada para `admin_senha` |

**Tabelas da Lua Pós-Parto (view-pos / view-pos-doula):**
| Tabela | Campos principais |
|---|---|
| `pos_bebes` | `mae_id (PK), nome, data_nascimento` — único por gestante (upsert) |
| `pos_dentes` | `id, mae_id, dente_id, data_nascimento` — registro de dente nascido |
| `pos_marcos` | `mae_id, mes, marco, conquistado` — marcos de desenvolvimento (upsert, conflict em `mae_id,mes,marco`) |
| `pos_amamentacao` | `mae_id, tipo, lado, duracao_seg, volume_ml, criado_em` |
| `pos_sono` | `mae_id, tipo, inicio, fim, duracao_min, qualidade` |
| `pos_fraldas` | `mae_id, tipo, consistencia, criado_em` |

### FKs importantes
- `solicitacoes.gestante_id` e `solicitacoes.doula_id` referenciam **`auth.users(id)`** (não `usuarios`) — gestante pode existir em auth sem ter linha em `usuarios`

## Vínculo Gestante Pós ↔ Doula Pós
- Reutiliza a tabela `solicitacoes` — `gestante_id` é a gestante pós (`tipo='pos'`), `doula_id` é a doula pós (`tipo='pos_doula'`)
- Gestante pós encontra doula pós via marketplace no dashboard (filtra `usuarios` onde `tipo='pos_doula'`)
- Doula pós vê e aceita/recusa na seção Clientes do painel
- Dados de bebê (`pos_bebes`, `pos_dentes`, `pos_marcos`) são compartilhados: doula lê/escreve usando `mae_id = gestante_id`
- **RLS necessária para funcionar**: nas tabelas `pos_bebes`, `pos_dentes` e `pos_marcos`, criar políticas que permitam SELECT/INSERT/DELETE quando existe `solicitacoes` aceita entre `mae_id` e a doula logada

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
