-- ═══════════════════════════════════════════════════════════════════════
--  Fase 3 / Etapa B0 — contagens esperadas do import no import_meta
--  Defesa contra upload interrompido e imports simultâneos: o leitor
--  compara a contagem real das linhas com a esperada antes de confiar.
--  Execute no Supabase SQL Editor (uma vez), ANTES do deploy do frontend.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE import_meta
  ADD COLUMN IF NOT EXISTS propostas_count   int,
  ADD COLUMN IF NOT EXISTS smart_leads_count int;
