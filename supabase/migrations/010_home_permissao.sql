-- ═══════════════════════════════════════════════════════════════════════
--  Home (tela de boas-vindas) — liga a permissão em todos os grupos
--  Execute no Supabase SQL Editor (uma vez), junto com o deploy do frontend
-- ═══════════════════════════════════════════════════════════════════════

UPDATE grupos_acesso
SET permissoes = permissoes || '{"home": true}'::jsonb;
