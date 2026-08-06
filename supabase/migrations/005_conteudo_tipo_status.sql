-- ═══════════════════════════════════════════════════════════════════════
--  Esteira de Conteúdo — tipo do conteúdo + status de produção
--  + correção: nomes dos responsáveis visíveis para todos os usuários
--  Execute no Supabase SQL Editor (uma vez)
-- ═══════════════════════════════════════════════════════════════════════

-- ── Tipo do card (Post estático / Vídeo) ─────────────────────────────────
-- Nullable: os cards criados antes desta migration não têm tipo definido.
ALTER TABLE conteudo_cards
  ADD COLUMN IF NOT EXISTS tipo text
    CONSTRAINT conteudo_cards_tipo_chk CHECK (tipo IN ('estatico','video'));

-- ── Status de produção (Roteiro / Gravação / Edição) ─────────────────────
-- 'gravacao' só se aplica a vídeo — a UI controla; o banco só valida o valor.
ALTER TABLE conteudo_cards
  ADD COLUMN IF NOT EXISTS producao_status text
    CONSTRAINT conteudo_cards_producao_status_chk
    CHECK (producao_status IN ('roteiro','gravacao','edicao'));

-- ── Correção do bug dos nomes no kanban ──────────────────────────────────
-- Antes, um usuário comum só conseguia ler o próprio profile (RLS), então
-- o board não resolvia o nome dos responsáveis dos outros cards.
-- Esta policy libera LEITURA dos perfis ativos para qualquer autenticado;
-- escrita continua restrita a admin (policies existentes não mudam).
DROP POLICY IF EXISTS "profiles_select_ativos" ON profiles;
CREATE POLICY "profiles_select_ativos"
  ON profiles FOR SELECT
  TO authenticated USING (ativo = true);
