-- ═══════════════════════════════════════════════════════════════════════
--  Fase 3 / Etapa A — dados do import em linhas (substitui o snapshot único)
--  Execute no Supabase SQL Editor (uma vez), ANTES do deploy do frontend
-- ═══════════════════════════════════════════════════════════════════════

-- ── Propostas: 1 linha por proposta do Ecorban ───────────────────────────
-- O conteúdo da entry fica em `data` (jsonb) para o schema não congelar os
-- ~35 campos do buildResult; cpf e sale_date são espelhados em colunas
-- próprias só para índice/consulta. A cada import as linhas novas entram
-- com um import_id novo e as do import anterior são removidas em seguida —
-- leitores usam o import_id apontado por import_meta e nunca veem mistura.
CREATE TABLE IF NOT EXISTS propostas (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  import_id uuid  NOT NULL,
  cpf       text,
  sale_date date,
  data      jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS propostas_import_idx ON propostas (import_id);
CREATE INDEX IF NOT EXISTS propostas_cpf_idx    ON propostas (cpf);
CREATE INDEX IF NOT EXISTS propostas_date_idx   ON propostas (sale_date);

-- ── Leads Smart (forma reduzida, a mesma que o snapshot guarda hoje) ─────
CREATE TABLE IF NOT EXISTS smart_leads (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  import_id uuid  NOT NULL,
  data      jsonb NOT NULL   -- { operador, time, estagio, andamento, dataCriacao }
);

CREATE INDEX IF NOT EXISTS smart_leads_import_idx ON smart_leads (import_id);

-- ── Metadados do import (linha única) ────────────────────────────────────
-- import_id aqui é o ponteiro oficial: só aponta para o import novo depois
-- que todas as linhas dele já subiram.
CREATE TABLE IF NOT EXISTS import_meta (
  id                int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  import_id         uuid NOT NULL,
  diag              jsonb,
  unknown_statuses  jsonb,
  facebook          jsonb,
  smart_by_operador jsonb,
  smart_by_time     jsonb,
  updated_by        text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Decisões de usuário que hoje só vivem no snapshot ────────────────────
CREATE TABLE IF NOT EXISTS divergencias_confirmadas (
  cpf            text PRIMARY KEY,
  confirmado_por text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_mappings (
  ecorban_nome text PRIMARY KEY,
  smart_nome   text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── RLS: somente usuários autenticados (mesmo padrão das demais tabelas) ─
ALTER TABLE propostas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_meta              ENABLE ROW LEVEL SECURITY;
ALTER TABLE divergencias_confirmadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_mappings          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON propostas;
CREATE POLICY "auth_all" ON propostas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON smart_leads;
CREATE POLICY "auth_all" ON smart_leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON import_meta;
CREATE POLICY "auth_all" ON import_meta
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON divergencias_confirmadas;
CREATE POLICY "auth_all" ON divergencias_confirmadas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON vendor_mappings;
CREATE POLICY "auth_all" ON vendor_mappings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
