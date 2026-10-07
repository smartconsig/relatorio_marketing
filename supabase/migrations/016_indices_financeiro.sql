-- ════════════════════════════════════════════════════════════════════════
-- 016 — Índices para a ordenação da Liberação e da Quitação de Boleto (out/2026)
--
-- As telas leem a tabela inteira em páginas de 1000, ORDENADAS. Sem índice na
-- ordem usada, o banco ordena a tabela toda a cada página. Estes índices deixam
-- a leitura rápida e estável conforme a base cresce.
-- O QUE FAZ: só cria índices (não muda dado nem regra). Pode rodar a qualquer hora.
-- COMO DESFAZER: DROP INDEX IF EXISTS <nome>; (os 3 nomes abaixo)
-- ════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS liberacao_margem_master_ordem_idx
  ON liberacao_margem_master (data_quitado DESC, created_at DESC, id);

CREATE INDEX IF NOT EXISTS quitacao_boletos_ordem_idx
  ON quitacao_boletos (created_at DESC, id);

CREATE INDEX IF NOT EXISTS boleto_docs_ordem_idx
  ON boleto_docs (created_at, id);
