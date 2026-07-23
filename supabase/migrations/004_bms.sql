-- ═══════════════════════════════════════════════════════════════════════
--  Central de BMs — controle de Business Managers e números oficiais
--  Execute no Supabase SQL Editor (uma vez)
-- ═══════════════════════════════════════════════════════════════════════

-- ── BMs (Business Managers) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bm_contas (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome            text        NOT NULL,
  bm_id_meta      text,                                  -- ID numérico da BM na Meta
  ativa           boolean     NOT NULL DEFAULT true,     -- o liga/desliga da interface
  motivo_inativa  text,                                  -- só faz sentido quando ativa = false
  observacao      text,
  data_criacao_bm date,                                  -- quando a BM foi criada na Meta
  arquivada       boolean     NOT NULL DEFAULT false,
  criado_por      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bm_contas_motivo_chk CHECK (
    motivo_inativa IS NULL OR motivo_inativa IN ('banida','desativada','em_analise')
  )
);

CREATE INDEX IF NOT EXISTS bm_contas_lista_idx ON bm_contas (arquivada, ativa, nome);

-- ── Números oficiais ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bm_numeros (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  bm_id         uuid        NOT NULL REFERENCES bm_contas(id) ON DELETE CASCADE,
  numero        text        NOT NULL,
  nome_exibicao text,                                    -- display name aprovado na Meta
  status        text        NOT NULL DEFAULT 'ativo',
  qualidade     text        NOT NULL DEFAULT 'na',       -- espelha o painel da Meta (manual)
  tier          text        NOT NULL DEFAULT 'na',       -- limite de conversas em 24h
  data_ativacao date,
  observacao    text,
  criado_por    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bm_numeros_status_chk    CHECK (status    IN ('ativo','banido','restrito','desconectado')),
  CONSTRAINT bm_numeros_qualidade_chk CHECK (qualidade IN ('alta','media','baixa','na')),
  CONSTRAINT bm_numeros_tier_chk      CHECK (tier      IN ('250','1000','10000','100000','ilimitado','na'))
);

CREATE INDEX IF NOT EXISTS bm_numeros_bm_idx ON bm_numeros (bm_id, created_at);

-- ── Eventos ──────────────────────────────────────────────────────────────
-- Sem isto só existe a foto de hoje. É o log que responde "quantos números
-- perdi no mês", "quanto tempo um número dura até banir" e "o banimento veio
-- depois da qualidade cair?".
CREATE TABLE IF NOT EXISTS bm_eventos (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  bm_id      uuid        REFERENCES bm_contas(id)  ON DELETE CASCADE,
  numero_id  uuid        REFERENCES bm_numeros(id) ON DELETE SET NULL,
  tipo       text        NOT NULL,
  de         text,
  para       text,
  texto      text,
  autor_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bm_eventos_tipo_chk CHECK (tipo IN (
    'bm_criada','bm_desativada','bm_reativada','bm_editada',
    'numero_add','numero_status','numero_qualidade','numero_editado','numero_removido',
    'nota'
  ))
);

CREATE INDEX IF NOT EXISTS bm_eventos_bm_idx  ON bm_eventos (bm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bm_eventos_num_idx ON bm_eventos (numero_id, created_at DESC);

-- ── updated_at automático ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bm_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bm_contas_touch ON bm_contas;
CREATE TRIGGER bm_contas_touch
  BEFORE UPDATE ON bm_contas
  FOR EACH ROW EXECUTE FUNCTION bm_touch_updated_at();

DROP TRIGGER IF EXISTS bm_numeros_touch ON bm_numeros;
CREATE TRIGGER bm_numeros_touch
  BEFORE UPDATE ON bm_numeros
  FOR EACH ROW EXECUTE FUNCTION bm_touch_updated_at();

-- ── RLS: somente usuários autenticados ───────────────────────────────────
ALTER TABLE bm_contas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_numeros ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON bm_contas;
CREATE POLICY "auth_all" ON bm_contas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON bm_numeros;
CREATE POLICY "auth_all" ON bm_numeros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON bm_eventos;
CREATE POLICY "auth_all" ON bm_eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
