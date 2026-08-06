-- ═══════════════════════════════════════════════════════════════════════
--  Conjunto de Perfil — perfil de Facebook que administra as BMs
--  Hierarquia: Perfil → BMs → Números
--  Execute no Supabase SQL Editor (uma vez), ANTES do deploy do código
-- ═══════════════════════════════════════════════════════════════════════

-- ── Perfis ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bm_perfis (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome           text        NOT NULL,
  ativa          boolean     NOT NULL DEFAULT true,      -- o liga/desliga da interface
  motivo_inativa text,                                   -- só faz sentido quando ativa = false
  observacao     text,
  arquivada      boolean     NOT NULL DEFAULT false,
  criado_por     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bm_perfis_motivo_chk CHECK (
    motivo_inativa IS NULL OR motivo_inativa IN ('banido','desativado','em_analise')
  )
);

CREATE INDEX IF NOT EXISTS bm_perfis_lista_idx ON bm_perfis (arquivada, ativa, nome);

-- ── BM passa a pertencer a um perfil ─────────────────────────────────────
ALTER TABLE bm_contas
  ADD COLUMN IF NOT EXISTS perfil_id uuid REFERENCES bm_perfis(id) ON DELETE CASCADE;

-- Backfill: BMs já cadastradas caem num perfil provisório, a ser
-- redistribuído manualmente pela interface depois.
DO $$
DECLARE v_perfil uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM bm_contas WHERE perfil_id IS NULL) THEN
    SELECT id INTO v_perfil FROM bm_perfis WHERE nome = 'Perfil não atribuído' LIMIT 1;
    IF v_perfil IS NULL THEN
      INSERT INTO bm_perfis (nome, observacao)
      VALUES ('Perfil não atribuído',
              'Criado automaticamente na migração — mova cada BM para o perfil correto')
      RETURNING id INTO v_perfil;
    END IF;
    UPDATE bm_contas SET perfil_id = v_perfil WHERE perfil_id IS NULL;
  END IF;
END $$;

ALTER TABLE bm_contas ALTER COLUMN perfil_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS bm_contas_perfil_idx ON bm_contas (perfil_id, nome);

-- ── Eventos: nível de perfil ─────────────────────────────────────────────
ALTER TABLE bm_eventos
  ADD COLUMN IF NOT EXISTS perfil_id uuid REFERENCES bm_perfis(id) ON DELETE CASCADE;

ALTER TABLE bm_eventos DROP CONSTRAINT IF EXISTS bm_eventos_tipo_chk;
ALTER TABLE bm_eventos ADD CONSTRAINT bm_eventos_tipo_chk CHECK (tipo IN (
  'bm_criada','bm_desativada','bm_reativada','bm_editada','bm_movida',
  'numero_add','numero_status','numero_qualidade','numero_editado','numero_removido',
  'perfil_criado','perfil_desativado','perfil_reativado','perfil_editado',
  'nota'
));

CREATE INDEX IF NOT EXISTS bm_eventos_perfil_idx ON bm_eventos (perfil_id, created_at DESC);

-- ── updated_at automático (reusa a função criada na 004) ─────────────────
DROP TRIGGER IF EXISTS bm_perfis_touch ON bm_perfis;
CREATE TRIGGER bm_perfis_touch
  BEFORE UPDATE ON bm_perfis
  FOR EACH ROW EXECUTE FUNCTION bm_touch_updated_at();

-- ── RLS: somente usuários autenticados ───────────────────────────────────
ALTER TABLE bm_perfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON bm_perfis;
CREATE POLICY "auth_all" ON bm_perfis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
