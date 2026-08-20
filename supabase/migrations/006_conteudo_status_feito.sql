-- ═══════════════════════════════════════════════════════════════════════
--  Esteira de Conteúdo — novo status de produção "Feito"
--  Fluxo passa a ser: Roteiro → [Gravação] → Edição → Feito
--  Execute no Supabase SQL Editor (uma vez), ANTES do deploy do front
-- ═══════════════════════════════════════════════════════════════════════

-- Troca a trava criada na 005 por uma que aceita também 'feito'.
ALTER TABLE conteudo_cards
  DROP CONSTRAINT IF EXISTS conteudo_cards_producao_status_chk;

ALTER TABLE conteudo_cards
  ADD CONSTRAINT conteudo_cards_producao_status_chk
  CHECK (producao_status IN ('roteiro','gravacao','edicao','feito'));
