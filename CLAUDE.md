# CLAUDE.md

Contexto permanente para sessões do Claude Code neste repositório.

---

## Regras obrigatórias de conduta

Estas regras se aplicam a **toda e qualquer alteração** neste projeto, sem exceção:

1. **Explicar antes de agir**: antes de qualquer mudança no código, explicar o que será alterado, em qual arquivo e em qual parte específica.
2. **Avisar sobre riscos**: informar se a alteração pode quebrar algo ou afetar outro comportamento do sistema.
3. **Aguardar aprovação**: nunca executar alterações sem que o responsável pelo projeto confirme que pode prosseguir.
4. **Seguir este arquivo**: todas as decisões técnicas devem respeitar o contexto, padrões e pontos de atenção descritos neste CLAUDE.md.

---

## O que é o sistema

**Smart RYC — Dashboard de Marketing** é uma SPA (Single Page Application) em JavaScript (vanilla no core, Preact nos componentes) que consolida dados de vendas, leads de marketing e métricas de desempenho da equipe comercial da Smart Consig. O sistema permite importar planilhas de produção, classificar o status de cada venda/lead, acompanhar KPIs (ROI, CAC, taxa de conversão, funil), gerenciar metas, exibir rankings e controlar acesso por perfil de usuário.

**Usuários**: gestores de marketing, supervisores comerciais e admins da Smart Consig.  
**Problema central**: unificar dados de múltiplas origens (Smart interna, Ecorban, Meta Ads FB03/FB06) para distinguir vendas de marketing das orgânicas e calcular o retorno real das campanhas.

**Produto atual**: o sistema opera hoje exclusivamente com dados de **Servidor Público**. Outros produtos (CLT, INSS) podem ser incorporados no futuro, mas atualmente não são usados.

**Frequência de uso**: as planilhas são importadas várias vezes ao dia — em alguns dias mais de 3 importações.

---

## Stack completa

| Camada | Tecnologia |
|---|---|
| Frontend | JavaScript vanilla ES6+ no core (páginas via `renderXxx()`) + **Preact** para componentes `.jsx` isolados (`src/components/`) |
| Build | Vite 5.4.0 com plugin `@preact/preset-vite` (polling habilitado para Windows) |
| Estilo | CSS puro com variáveis CSS (tema claro/escuro) |
| Backend/DB | Supabase (PostgreSQL + Auth + Edge Functions) |
| Charts | Chart.js 4.4.0 (CDN) |
| Excel | xlsx 0.18.5 (npm) |
| Auth client | @supabase/supabase-js 2.x (CDN) |
| Deploy | Vercel |
| CDN de vídeo | Bunny.net (módulo Universidade) |

---

## Serviços e integrações

### Supabase
- **Auth**: login por e-mail/senha. Criação de usuários pelo admin (modal "Novo Usuário" em `admin-page.js`) via Edge Function `invite-user`, em **dois modos**:
  - **Senha direta** (padrão desde ago/2026): o admin define a senha inicial na hora; a função usa `auth.admin.createUser` com `email_confirm: true` e o usuário entra direto, sem e-mail. A resposta traz o marcador `mode: 'password'` — o frontend só confirma sucesso se ele vier (blindagem contra função desatualizada no painel).
  - **Convite por e-mail** (fluxo legado, mantido como opção): `inviteUserByEmail` → usuário recebe link → tela "definir senha" em `auth.js`. Se o e-mail já existir, envia link de redefinição.
- **Database**: tabelas abaixo; RLS habilitado
- **Edge Functions** (em `supabase/functions/`): `smart-sync` (busca leads da API Smart Consig), `invite-user`, `delete-user`, `kolmeya-reports` (relatórios de SMS Kolmeya). A função `meta-ads` é invocada pelo código (`sb.functions.invoke('meta-ads')`) mas **não está versionada no repo** — vive apenas no painel do Supabase
- ⚠️ **Deploy de Edge Function é manual**: o push na `main` só publica o frontend (Vercel). Qualquer mudança em `supabase/functions/*` precisa ser reimplantada à mão no painel do Supabase (Edge Functions → função → Code → colar → Deploy) ou via `supabase functions deploy <nome>` — senão produção continua rodando a versão antiga
- **Snapshots**: o estado completo da aplicação é serializado em JSON e salvo na tabela `snapshots` a cada 2 segundos (debounced) após qualquer classificação ou alteração. Desde 29/08/2026 o payload vai **comprimido com gzip nativo** (prefixo `gz1:`, ~92% menor; helpers em `src/utils/gzip.js`) e a leitura aceita os dois formatos; o cache do localStorage usa a mesma compressão. ⚠️ O snapshot está em processo de aposentadoria — ver seção **"Migração do snapshot (Fase 3)"**
- Credenciais do cliente (anon key) estão **hardcoded** em `src/services/supabase.js` — não colocar em `.env`
- Secrets das Edge Functions (SMART_USERNAME, SMART_PASSWORD, SERVICE_ROLE_KEY, KOLMEYA_TOKEN, entre outros) ficam no painel do Supabase

### Vercel
- Deploy automático via `vercel.json` (installCommand: `npm install`, buildCommand: `npm run build`, outputDirectory: `dist`)
- Variáveis de ambiente da Vercel: apenas `VITE_BUNNY_RO_KEY` e `BUNNY_API_KEY` (módulo Universidade) — configuradas **no painel da Vercel**, não no `vercel.json`

### Meta Ads
- Integração direta com a API da Meta via Edge Function `meta-ads` no Supabase
- Sincronização disparada pelo usuário na interface, passando o intervalo de datas do filtro ativo
- Dados retornados (investimento, leads, breakdown diário) ficam em `state.metaAds`

### API Smart Consig (interna)
- **Não utilizada atualmente** — os dados do sistema Smart são carregados manualmente via planilha Excel

### Kolmeya (SMS)
- Provedor de disparo de SMS marketing; a integração puxa **relatórios de volume de SMS** por período
- Cliente em `src/services/kolmeya.js` → Edge Function `kolmeya-reports` → API `kolmeya.com.br/api/v1/sms/reports/quantity-jobs`
- Sincronização por período no formato `YYYY-MM`, derivado do filtro de datas ativo (`state.filterDates`)
- Secret `KOLMEYA_TOKEN` fica no painel do Supabase

### Bunny.net
- CDN de vídeo para o módulo Universidade
- `VITE_BUNNY_RO_KEY` (leitura, exposto no frontend) e `BUNNY_API_KEY` (escrita, server-side)

---

## Tabelas Supabase

| Tabela | Finalidade |
|---|---|
| `auth.users` | Credenciais de login (gerenciado pelo Supabase Auth) |
| `profiles` | Metadados do usuário: nome, email, grupo_id, ativo |
| `grupos_acesso` | Definição de papéis; coluna `permissoes` (JSONB) |
| `snapshots` | Estado serializado da aplicação (JSON pesado) |
| `classifications` | Overrides manuais de status por CPF |
| `quitacoes_clientes` | Registros de quitação/pagamento |
| `propostas` | Fase 3: 1 linha por proposta do import (`cpf`/`sale_date` indexados + entry completa em `data` jsonb); substituída inteira a cada import via `import_id` |
| `smart_leads` | Fase 3: leads Smart em forma reduzida (operador, time, estágio, andamento, data), 1 linha por lead; substituída a cada import |
| `import_meta` | Fase 3: linha única com o `import_id` ativo (ponteiro), diagnóstico, agregados e quem/quando importou |
| `divergencias_confirmadas` | Divergências confirmadas, 1 linha por CPF (antes só existiam dentro do snapshot) |
| `vendor_mappings` | Mapeamento de nomes de vendedor Ecorban↔Smart (antes só no snapshot) |
| `parceiros_data` | Ranking de Parceiros: uma única linha com o ranking inteiro em JSON (mesmo padrão de `bsc_data`) |
| `conteudo_cards` | Cards da Esteira de Conteúdo (kanban de criação) |
| `conteudo_eventos` | Histórico do card: movimentações, aprovações e comentários |
| `conteudo_anexos` | Metadados das artes anexadas aos cards |
| `bm_contas` | Central de BMs: uma linha por Business Manager (toggle ativa + motivo) |
| `bm_numeros` | Números oficiais de cada BM: status, qualidade (manual), tier |
| `bm_eventos` | Histórico das BMs/números: criação, banimento, troca de qualidade |
| tabelas `uni_*` | Módulo Universidade: cursos, exames, gamificação |

**Storage**: bucket privado `conteudo-anexos` guarda as imagens da Esteira de Conteúdo (leitura só por URL assinada, 1h). Outros buckets: `quitacoes-docs` e `avatars` (público — logos dos parceiros em `avatars/parceiros/<slug>.jpg` e a logo da empresa em `assets/logo.png`).

> ⚠️ **`bm_*` (Central de BMs)**: migration versionada em `supabase/migrations/004_bms.sql`, mas **precisa ser rodada à mão no SQL Editor do Supabase** ao subir a feature — o app não cria tabela sozinho.

> ✅ **Fase 3 (`propostas`, `smart_leads`, `import_meta`, `divergencias_confirmadas`, `vendor_mappings`)**: migration `007_propostas.sql` **já rodada em produção em 29/08/2026** e validada (primeiro import populou ~7.030 propostas).

> ⚠️ **Migrations parcialmente incompletas**: `profiles` e `grupos_acesso` (em `001_user_management.sql`), as tabelas `uni_*` e as tabelas `conteudo_*` (em `002_conteudo.sql`, `003_conteudo_anexos.sql`, `005_conteudo_tipo_status.sql` e `006_conteudo_status_feito.sql`) têm migration versionada. `quitacoes_clientes` tem SQL solto em `supabase/quitacoes_clientes.sql` (fora de `migrations/`). **`snapshots` e `classifications` não têm SQL versionado nenhum** — foram criadas manualmente pelo painel do Supabase. Ao recriar o ambiente do zero, essas duas precisam ser criadas à mão.

---

## Estrutura de pastas

```
relatorio_marketing/
├── index.html                # Shell HTML; carrega Chart.js/supabase e Google Fonts via CDN; nav sidebar
├── demo.html                 # Página de demo isolada dos componentes Preact (src/components/)
├── regras.html               # Página estática de regras/documentação (legado, fora do build Vite)
├── vite.config.js            # Vite com plugin preact() e polling (Windows); sem alias @/
├── package.json
├── vercel.json
├── api/
│   └── bunny-create.js       # Função serverless Vercel (usa BUNNY_API_KEY server-side)
├── public/
│   └── template_liberacao.xlsx # Template de planilha de liberação de margem
├── supabase/
│   ├── functions/            # Edge Functions: smart-sync, invite-user, delete-user, kolmeya-reports
│   ├── migrations/           # SQL de criação de tabelas e RLS
│   │                         # 002, 003, 005, 006 (Esteira de Conteúdo), 004 (BMs)
│   └── quitacoes_clientes.sql # SQL solto (fora de migrations/) da tabela quitacoes_clientes
├── src/
│   ├── main.js               # Ponto de entrada; expõe funções no window.*
│   ├── navigation.js         # Roteamento, sidebar, hide/show por permissão
│   ├── state.js              # Objeto global `state` (único source of truth em memória)
│   ├── data/
│   │   └── changelog.json    # Histórico de versões exibido na UI
│   ├── components/           # Componentes Preact (.jsx) reutilizáveis
│   │   ├── Badge.jsx          # Badge de status de venda/lead
│   │   ├── Badge.demo.jsx     # Montagem de demo (usada por demo.html)
│   │   ├── FilterButtons.jsx  # Botões de filtro
│   │   └── ui.js             # Helpers de UI dos componentes
│   ├── config/
│   │   └── status.js         # Sets STATUS_* (PAID/ALMOST_PAID/APPROVED/REJECTED) + HIERARCHY (desatualizado)
│   ├── core/
│   │   ├── buildResult.js    # Transforma Excel bruto em entries tipadas
│   │   ├── calcKPIs.js       # ROI, CAC, conversão, métricas principais
│   │   ├── calcFunil.js      # Análise de funil de vendas
│   │   ├── calcPerfil.js     # Clusterização de perfil de cliente
│   │   ├── parseBSC.js       # Parse do Balanced Scorecard
│   │   ├── parseParceiros.js # Parse do CSV "Relatório de produção - Parceiros"
│   │   └── storage.js        # Persistência em localStorage
│   ├── services/
│   │   ├── auth.js           # Login, logout, sessão, loadUserProfile
│   │   ├── supabase.js       # Inicialização do cliente Supabase (credenciais hardcoded)
│   │   ├── snapshot.js       # Save/load de snapshot no Supabase (debounced 2s)
│   │   ├── meta-ads.js       # Sync Meta Ads via Edge Function
│   │   ├── kolmeya.js        # Sync relatórios de SMS via Edge Function kolmeya-reports
│   │   ├── permissions.js    # can() + objeto perm com atalhos (perm.isAdmin()…)
│   │   ├── classifications.js# Overrides de status por CPF
│   │   ├── goals-svc.js      # Metas de KPI
│   │   ├── quitacoes-service.js # Serviço de quitações
│   │   ├── parceiros-svc.js  # Ranking de Parceiros: load/save do JSON na tabela parceiros_data
│   │   ├── propostas-store.js# Fase 3: dual-write do import nas tabelas propostas/smart_leads/import_meta
│   │   ├── conteudo-svc.js   # Esteira de Conteúdo: cards, eventos e anexos (sem snapshot)
│   │   ├── bm-svc.js         # Central de BMs: BMs, números oficiais e eventos (sem snapshot)
│   │   ├── bsc-svc.js        # Balanced Scorecard service
│   │   ├── action-log.js     # Log de eventos do sistema
│   │   └── session-timeout.js# Auto-logout por inatividade
│   ├── pages/                # Uma função renderXxx() por página
│   │   ├── import-page.js    # Upload e processamento de Excel
│   │   ├── overview.js       # Dashboard de KPIs
│   │   ├── ranking.js        # Rankings e funil
│   │   ├── perfil.js         # Segmentação de clientes
│   │   ├── procv.js          # Revisão de classificação de marketing
│   │   ├── clientes.js       # Lista de clientes
│   │   ├── review.js         # Classificação de status desconhecidos
│   │   ├── propostas.js      # Propostas de marketing
│   │   ├── goals-page.js     # Configuração de metas
│   │   ├── bsc-page.js       # BSC (Balanced Scorecard)
│   │   ├── liberacao-page.js # Liberação de margem
│   │   ├── quitacoes-page.js # Gestão de quitações
│   │   ├── parceiros-page.js # Ranking de Parceiros (pódio + lista + overlay "Top Parceiros")
│   │   ├── conteudo-page.js  # Esteira de Conteúdo (kanban de criação)
│   │   ├── bm-page.js        # Central de BMs (controle de banimento de números)
│   │   ├── divergences.js    # Divergências de dados
│   │   ├── history-panel.js  # Log de alterações
│   │   ├── admin-page.js     # Gestão de usuários e grupos
│   │   ├── universidade.js   # Módulo de treinamento corporativo
│   │   ├── uni-admin.js      # Criação de cursos
│   │   └── uni-gamificacao.js# Configurações de gamificação
│   ├── utils/
│   │   ├── currency.js       # Formatação e parse de BRL
│   │   ├── gzip.js           # Compressão gzip nativa (snapshot + cache local)
│   │   ├── date.js           # Manipulação de datas e filtros por intervalo
│   │   ├── string.js         # Normalização de strings
│   │   ├── cpf.js            # Formatação e validação de CPF
│   │   ├── ui.js             # Toast, loading, utilitários DOM
│   │   ├── mobile.js         # Handlers mobile
│   │   └── confirm.js        # Diálogos de confirmação modal
│   └── styles/
│       ├── base.css          # Reset, grid de layout, tipografia
│       ├── theme.css         # Variáveis CSS, tema claro/escuro
│       ├── components.css    # Componentes compartilhados
│       ├── sidebar.css       # Sidebar e navegação
│       ├── mobile.css        # Overrides responsivos
│       └── [feature].css     # Um arquivo por feature de maior porte
```

---

## Fluxo de dados

1. **Login**: `auth.js` → Supabase Auth → `state.currentUser` populado com perfil e permissões do grupo
2. **Import**: `import-page.js` recebe Excel → `buildResult.js` normaliza e tipifica → `state.result.entries[]`
3. **Snapshot**: ao login, compara timestamp local com Supabase; se desatualizado, carrega snapshot completo e mescla com estado local
4. **Renderização**: páginas renderizam sob demanda na navegação; todas chamam `renderAll()` para sincronizar com `state`
5. **Persistência**: qualquer classificação → debounce de 2s → `snapshot.js` → Supabase tabela `snapshots`

---

## Migração do snapshot (Fase 3) — EM ANDAMENTO

O snapshot (estado inteiro numa única linha da tabela `snapshots`) está sendo substituído por tabelas normalizadas. Plano acordado com o responsável em 29/08/2026, execução em etapas reversíveis:

| Etapa | O quê | Status |
|---|---|---|
| Fase 1a | Snapshot comprimido com gzip (`gz1:`), hash pula save sem mudança | ✅ produção 29/08/2026 (commit `700c01fd`) |
| Fase 1b | Cache localStorage comprimido; `loadState()` virou async | ✅ produção 29/08/2026 (commit `e3de3b32`) |
| Etapa A | Dual-write: import grava fichas (`propostas`/`smart_leads`/`import_meta`) além do snapshot, não-fatal; divergências e vendor mappings gravam nas tabelas no ato | ✅ produção 29/08/2026 (commit `a5af2d6a`), migration 007 rodada e validada (~7.030 fichas) |
| Etapa B0 | Leitura sombra: login monta estado pelas fichas em paralelo e compara com o snapshot (console + action-log); migration 008 acrescenta contagens esperadas no `import_meta` (defesa contra upload interrompido e imports simultâneos) | ⏳ próxima — **conferência agendada para ~05/09/2026** |
| Etapa B1 | Virada: fichas viram a fonte de leitura; snapshot vira reserva (fallback se contagem não bater) e continua sendo gravado | após 1–2 dias de B0 limpa |
| Etapa C | Remove escrita/leitura do snapshot; clique salva só a linha dele; adicionar **revalidação automática a cada 30s** das `classifications` (pedido do responsável, padrão da Esteira) | após ~1 semana de B1 limpa |

**Desenho da Etapa A** (`src/services/propostas-store.js`): sem chave natural de proposta — cada import insere as linhas com um `import_id` novo → aponta `import_meta.import_id` → apaga as linhas do import anterior. Leitores futuros filtram pelo `import_id` do ponteiro e nunca veem mistura. Decisões humanas (classificações, divergências, mapeamentos) ficam em tabelas próprias e são mescladas por cima na montagem — clique em "É Marketing" **não** mexe na tabela `propostas`.

**Checagens de saúde da Etapa A** (fazer antes da B0): contagem de `propostas` estável em ~7 mil a cada import (não acumulando), um único `import_id` por vez, sem `console.warn` de `replaceImportData` nos imports da semana.

**Pendência paralela — tela de Tráfego**: desenhada (formulário no card de importação + página com visão de planilha + tabela `trafego_diario`), aguardando 2 decisões do responsável: (1) dado digitado vira fonte oficial de investimento/leads no `calcKPIs.js`? (2) CAC/ROAS com ou sem os 13% de imposto? A planilha de referência é "Investimento em Mídia - Setor Marketing.xlsx" (5 campos digitados/dia; CPL, CTR e investimento+imposto são derivados).

---

## Conceitos-chave do domínio

**Entry**: registro de venda/lead (sempre construído a partir de uma linha **Ecorban**) com campos como: `_idx` (índice da linha, não `id`), `cpf`, `phone`, `saleDate`, `valor`, `rawStatus` (status bruto), `statusCat` (pago/quase pago/aprovado/reprovado/desconhecido), `isMarketing`, `loja`, `vendedor` (vendedor da venda; há também `smartOperador` do lado Smart), `ecorbanOrigem`, `origem`/`audiencia` (origem vinda do Smart, `null` se não houver match), `matchMethod` (`cpf`|`telefone`). **Smart, Ecorban, FB03/FB06 são fontes de dados, não valores de um único campo `origem`** — os leads de Facebook ficam num array separado `result.facebook` marcados com `_bm: 'BM-03'|'BM-06'`.

**StatusCat**: categorização derivada do `rawStatus` mapeado nos sets de `config/status.js`. Status não mapeados recebem `statusCat = 'desconhecido'` e são revisados manualmente na aba **review** (`review` é a página, não a categoria).

**Critério de marketing**: a decisão primária é `ecorbanOrigem === 'MARKETING'` (`buildResult.js`). O **Smart Signal apenas sinaliza/confirma**, não decide.

**Smart Signal**: presença do lead no banco da Smart Consig (por origem + audiência) comparada com os dados de venda. Retorna 4 estados: `confirmed`, `doubt`, `contradiction` e `not_found`. Usado para detectar divergências e reforçar a classificação de marketing.

**reverseCandidate / "Marketing Perdido"**: quando a linha Ecorban **não** está marcada como MARKETING mas o Smart confirma que é marketing, a Entry é marcada como candidata reversa (`buildResult.js`). É a base da aba "Marketing Perdido".

**reviewReason / precedência de overrides**: overrides manuais têm prioridade absoluta. `classifications.js` grava `reviewReason` com valores especiais (`'manual'`, `'reclassified'`) que vencem qualquer reclassificação automática ao rebuildar o `state.result`.

**Esteira de Conteúdo**: kanban da produção de conteúdo do time de marketing, em 7 etapas — `ideias`, `planejado`, `producao`, `revisao`, `aprovacao`, `agendado`, `publicado`. Pontos de desenho que não são óbvios lendo o código:
- **"Ajuste" é um estado, não uma coluna**: card reprovado volta para *Em produção* com `em_ajuste = true` e o motivo em `ajuste_motivo`. A taxa de retrabalho sai do log de eventos, não de uma coluna própria.
- **`conteudo_eventos` é a fonte de tudo**: histórico do card, chat (tipo `comentario`) e as futuras métricas de gargalo saem da mesma tabela, em ordem cronológica.
- **`coluna_desde`** é reiniciado a cada troca de etapa — é a base do "parado há X dias" e do tempo médio por etapa.
- **Tipo + status de produção**: card pode ter `tipo` (`estatico` | `video`) e `producao_status` — fluxo `roteiro` → `gravacao` (só vídeo) → `edicao` → `feito`. As listas vivem em `STATUS_PROD`/`statusDoTipo()` (`conteudo-svc.js`), mas o banco também valida via CHECK constraint (`005` e `006`) — **adicionar status novo exige migration + rodar o SQL à mão antes do deploy do front**. Cores dos chips: roteiro azul, gravação roxo, edição verde, feito teal (`conteudo.css`).
- **Filtros da toolbar**: dropdown de responsável ("Todos", "Só os meus", um item por colaborador **que tem card no quadro**, "Sem responsável" se houver card órfão) + dropdown de canal; combinam entre si e não persistem (F5 volta para "Todos").
- **Permissões próprias**: `conteudo_visualizar`, `conteudo_editar` e `conteudo_aprovar`; admin tem as três por padrão.

**Central de BMs**: controle das Business Managers da API oficial da Meta/WhatsApp e dos seus números oficiais — nasceu da dor de banimento. Padrão igual ao da Esteira: grava direto no Supabase (sem snapshot), revalida a cada 30s e ao focar a aba. Pontos de desenho:
- **Toggle liga/desliga com motivo**: desligar uma BM (`ativa = false`) exige um motivo (`banida` / `desativada` / `em_analise`) — é o que separa "a Meta baniu" de "parei de usar" na análise. Religar é 1 clique.
- **`bm_eventos` é a fonte do histórico**: criação, banimento e cada troca de status/qualidade de número viram evento — é o que responde "quantos números perdi no mês" e "quanto tempo dura até banir".
- **Qualidade é manual**: o campo `qualidade` do número é preenchido à mão olhando o painel da Meta; o campo já está pronto para uma futura automação via Edge Function + token WhatsApp Business, sem migração nova.
- **Permissões próprias**: `bm_visualizar` e `bm_editar`; admin tem as duas. Excluir BM/número é só admin.

**Ranking de Parceiros**: ranking das produções por parceiro, alimentado por um **CSV** próprio ("Relatório de produção - Parceiros", separador `;`, codificação windows-1252) importado na tela — **não** vem do fluxo de Excel/Ecorban do resto do sistema. Pontos de desenho:
- **Parser dedicado** (`parseParceiros.js`): colunas de valores em R$ (`reprovado`, `clienteDesistiu`, `pendencia`, `riscoPerda`, `emAndamento`, `integrado`, `projecao`) + `rank` (coluna RANKING da planilha, já ordenada por INTEGRADO). Rodapé "TOTAL" e linhas "STATUS" são ignorados.
- **Persistência estilo `bsc_data`**: o ranking inteiro é serializado em JSON numa única linha da tabela `parceiros_data` (`parceiros-svc.js`), além de um cache em `localStorage` (`sc_parceiros_v1`). Ao abrir, mostra o local na hora e depois substitui pelo do Supabase se for mais novo (compara `importedAt`).
- **Sem "nota"**: diferente do BSC, parceiro não tem score — o ranking é por posição/valor Integrado. Logos ficam no bucket público `avatars/parceiros/<slug>.jpg` (editáveis pela UI) com fallback de iniciais.
- **"Mostrar valores"** (`_showValues`, padrão desligado): a tela nasce limpa para print/TV; o toggle revela as métricas em R$.
- **Overlay "Top Parceiros"**: tela cheia estilo "modo TV" do BSC (fundo branco fixo, cabeçalho + relógio, pódio 2º-1º-3º + grid dos demais, **só posição, sem R$**), com botões de quantidade **Top 10 / 25 / 50** (desabilita a opção maior que o total). Só exibição — não persiste nada. Sai no `✕` ou `Esc`.

**Permissões**: cada grupo tem um JSON de permissões (`grupos_acesso.permissoes`). A função `can('chave')` verifica acesso e o objeto `perm` expõe atalhos semânticos nomeados (`perm.isAdmin()`, `perm.visaoGeral()`, `perm.procvConfirmar()`, …). `navigation.js` esconde/mostra elementos da UI com base nisso.

---

## Comandos essenciais

```bash
# Instalar dependências
npm install

# Dev server (localhost:5173)
npm run dev

# Build de produção
npm run build

# Preview do build local
npm run preview
```

O dev server usa polling de arquivos (`usePolling: true`) — necessário no Windows para hot reload funcionar corretamente.

---

## Convenções e padrões

- **Core sem framework, componentes em Preact**: as páginas (`src/pages/*.js`) manipulam o DOM diretamente (`innerHTML`, `querySelector`, `addEventListener`); componentes reutilizáveis novos ficam em `src/components/*.jsx` usando Preact (JSX com `class=`, não `className`)
- **Uma função por página**: cada `src/pages/*.js` exporta `renderNomeDaPagina()` e é exposta em `window.renderNomeDaPagina` via `main.js`
- **Estado global**: `state` (importado de `state.js`) é o único source of truth em memória; não há store reativo
- **Nomenclatura**: camelCase para variáveis e funções; kebab-case para arquivos CSS e IDs HTML; snake_case nas colunas do banco
- **CPF como chave**: CPFs são normalizados (só dígitos) em `utils/cpf.js` antes de qualquer comparação — nunca comparar strings brutas
- **CSS por feature**: cada feature grande tem seu próprio `.css` em `src/styles/`; a maioria é importada em `main.js` (exceção: `admin.css` é carregado direto no `<head>` do `index.html`)
- **Sem TypeScript no frontend**: o app é JS/JSX; TypeScript só aparece nas Edge Functions do Supabase (Deno, `.ts`). Sem JSDoc sistemático

---

## Pontos de atenção

- **Credenciais hardcoded**: URL e anon key do Supabase estão em `src/services/supabase.js` diretamente — é intencional (anon key é pública), mas não adicionar service role key aqui
- **Snapshot pode ser grande**: o JSON em `snapshots` cresce com o volume de dados; se exceder quota do localStorage, o app exibe aviso de toast
- **Estado não é reativo**: alterar `state.x` não dispara re-render automaticamente; é necessário chamar a função de render manualmente
- **Parsing de Excel é frágil**: `buildResult.js` depende de colunas com nomes exatos nas planilhas importadas; mudança de layout quebra o import silenciosamente
- **Classificações por CPF**: `classifications.js` salva overrides no Supabase e os mescla sobre o estado local — cuidado ao limpar/rebuildar `state.result` sem replicar as classificações
- **Tema claro/escuro**: controlado pelo atributo `data-theme="light"` no elemento raiz (`<html>`), gravado em `localStorage` na chave `sc_theme` — **não** por classe no `<body>`. O CSS usa as variáveis de `theme.css`; ao adicionar novos componentes, sempre usar as variáveis, nunca cores fixas
- **Esteira de Conteúdo não passa pelo snapshot**: grava direto em `conteudo_cards`/`conteudo_eventos`/`conteudo_anexos` a cada ação, e revalida sozinha a cada 30s e ao focar a aba. É o padrão a seguir em features novas — ver a seção do bug recorrente abaixo
- **Branches**: trabalhe **sempre na `main`** (worktree em `.claude/worktrees/interesting-burnell-728cd3`). Na UI do Claude Code, selecione `main` + ☑ worktree ao abrir o projeto. ⚠️ **`refactor/modular` é uma branch MORTA** — snapshot do app monolítico antigo (só `index.html`, parado em 05/mai, de antes da modularização); `main` descende dela e está centenas de commits à frente. Nunca editar. Se o Git abriu em `refactor/modular`, você está no lugar errado
- **Deploy via Vercel**: o app em produção é servido pela Vercel a partir da branch `main`. Commits feitos apenas localmente **não aparecem em produção** — sempre fazer `git push origin main` após o commit para que a Vercel dispare o deploy automaticamente. O source da branch `main` fica no worktree `.claude/worktrees/interesting-burnell-728cd3`; commits nessa pasta precisam ser pushados para o repositório remoto `https://github.com/smartconsig/relatorio_marketing.git`
- **Hierarquia de lojas desatualizada**: o objeto `HIERARCHY` em `src/config/status.js` contém lojas e supervisores que não refletem a realidade atual — não usar como referência

### Bug recorrente crítico — persistência de dados

O bug mais frequente no histórico deste projeto é: **dado salvo apenas no localStorage (navegador), sem persistir no Supabase**. Isso causa dois problemas graves:
- O dado some quando o usuário dá F5
- O dado não aparece para outros usuários em outros computadores

Isso aconteceu repetidamente, especialmente na funcionalidade de classificação de marketing (botões "É Marketing / Não é Marketing"). O git registra ao menos 3 correções diferentes para variações desse mesmo problema.

**Regra**: qualquer funcionalidade que salva uma decisão do usuário (classificação, confirmação, override) **deve obrigatoriamente persistir no Supabase**. Nunca depender apenas de localStorage para dados que precisam sobreviver a um F5 ou ser visíveis para outros usuários.

---

## O que ainda precisa ser preenchido manualmente

- **Decisões de arquitetura**: o core nasceu em JS vanilla e o Preact foi adotado depois para componentes `.jsx` — qual o plano? Migrar as páginas para Preact aos poucos ou manter o híbrido?
- **Permissões mapeadas**: lista completa das chaves de permissão existentes em `grupos_acesso.permissoes` e o que cada uma libera na interface (pode ser extraído do código)
- **Hierarquia de lojas atualizada**: o objeto `HIERARCHY` em `src/config/status.js` está desatualizado — substituir pela estrutura real de lojas, supervisores e gerentes
- **Sincronização Meta Ads**: a sincronização é sempre manual (disparada pelo usuário) ou há alguma automação?
