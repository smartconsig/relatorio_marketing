-- ═══════════════════════════════════════════════════════════════════════
--  Esteira de Conteúdo — kanban de criação de conteúdo
--  Execute no Supabase SQL Editor (uma vez)
-- ═══════════════════════════════════════════════════════════════════════

-- ── Cards ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conteudo_cards (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo         text        NOT NULL,
  descricao      text,
  coluna         text        NOT NULL DEFAULT 'ideias',
  canal          text,
  responsavel_id uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  data_alvo      date,
  link_url       text,
  em_ajuste      boolean     NOT NULL DEFAULT false,
  ajuste_motivo  text,
  ordem          numeric     NOT NULL DEFAULT 1000,
  coluna_desde   timestamptz NOT NULL DEFAULT now(),  -- base do "parado há X dias"
  resultado      jsonb       NOT NULL DEFAULT '{}',   -- métricas do post (fase 3)
  arquivado      boolean     NOT NULL DEFAULT false,
  criado_por     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conteudo_cards_coluna_chk CHECK (coluna IN (
    'ideias','planejado','producao','revisao','aprovacao','agendado','publicado'
  ))
);

CREATE INDEX IF NOT EXISTS conteudo_cards_board_idx
  ON conteudo_cards (arquivado, coluna, ordem);

-- ── Eventos (movimentações, aprovações e comentários) ────────────────────
-- Alimenta a timeline do card e as métricas de gargalo/retrabalho.
CREATE TABLE IF NOT EXISTS conteudo_eventos (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id    uuid        NOT NULL REFERENCES conteudo_cards(id) ON DELETE CASCADE,
  tipo       text        NOT NULL,
  de_coluna  text,
  para_coluna text,
  texto      text,
  autor_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conteudo_eventos_tipo_chk CHECK (tipo IN (
    'criado','movido','comentario','aprovado','reprovado','editado','arquivado'
  ))
);

CREATE INDEX IF NOT EXISTS conteudo_eventos_card_idx
  ON conteudo_eventos (card_id, created_at DESC);

-- ── updated_at automático ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION conteudo_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conteudo_cards_touch ON conteudo_cards;
CREATE TRIGGER conteudo_cards_touch
  BEFORE UPDATE ON conteudo_cards
  FOR EACH ROW EXECUTE FUNCTION conteudo_touch_updated_at();

-- ── RLS: somente usuários autenticados ───────────────────────────────────
ALTER TABLE conteudo_cards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteudo_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON conteudo_cards;
CREATE POLICY "auth_all" ON conteudo_cards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON conteudo_eventos;
CREATE POLICY "auth_all" ON conteudo_eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
