-- ═══════════════════════════════════════════════════════════════════════
--  Tráfego (Ads) — dados diários digitados pelo time de tráfego
--  Substitui a planilha "Investimento em Mídia" e a API do Meta como fonte
--  oficial de investimento/leads dos KPIs.
--  Execute no Supabase SQL Editor (uma vez), ANTES do deploy do frontend.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trafego_diario (
  dia          date PRIMARY KEY,
  investimento numeric(12,2) NOT NULL DEFAULT 0,   -- sem imposto (igual ao painel do Meta)
  leads        int           NOT NULL DEFAULT 0,
  cliques      int           NOT NULL DEFAULT 0,
  impressoes   int           NOT NULL DEFAULT 0,
  alcance      int           NOT NULL DEFAULT 0,
  updated_by   text,
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE trafego_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON trafego_diario;
CREATE POLICY "auth_all" ON trafego_diario
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
