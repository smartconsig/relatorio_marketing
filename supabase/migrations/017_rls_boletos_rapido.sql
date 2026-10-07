-- ════════════════════════════════════════════════════════════════════════
-- 017 — Regras de acesso (RLS) da Quitação de Boleto sem checagem por linha (out/2026)
--
-- PROBLEMA: as policies chamavam is_admin_user() / empresa_do_usuario() direto,
-- e o Postgres reexecutava as duas funções (cada uma lê profiles + grupos_acesso)
-- PARA CADA LINHA. Medido em 07/10/2026: 3.523 boletos em 11,4 s e boleto_docs
-- estourando o statement timeout (erro 500).
-- CORREÇÃO: envolver as chamadas em (SELECT ...). O Postgres passa a calcular
-- uma vez por consulta (initPlan) e reaproveitar. Padrão recomendado pelo
-- Supabase e já usado nas tabelas uni_*.
-- O QUE MUDA: só a velocidade. A REGRA É A MESMA (admin vê tudo; parceiro só a
-- própria empresa; excluir/importar só admin).
-- Tudo numa transação: não existe instante com a tabela sem policy.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── quitacao_boletos ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "boletos_select" ON quitacao_boletos;
CREATE POLICY "boletos_select" ON quitacao_boletos
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_user()) OR empresa_parceira = (SELECT empresa_do_usuario()));

DROP POLICY IF EXISTS "boletos_insert" ON quitacao_boletos;
CREATE POLICY "boletos_insert" ON quitacao_boletos
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_user()) OR empresa_parceira = (SELECT empresa_do_usuario()));

DROP POLICY IF EXISTS "boletos_update" ON quitacao_boletos;
CREATE POLICY "boletos_update" ON quitacao_boletos
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_user()) OR empresa_parceira = (SELECT empresa_do_usuario()))
  WITH CHECK ((SELECT is_admin_user()) OR empresa_parceira = (SELECT empresa_do_usuario()));

DROP POLICY IF EXISTS "boletos_delete" ON quitacao_boletos;
CREATE POLICY "boletos_delete" ON quitacao_boletos
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_user()));

-- ── boleto_docs ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "boleto_docs_select" ON boleto_docs;
CREATE POLICY "boleto_docs_select" ON boleto_docs
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_user()) OR empresa_parceira = (SELECT empresa_do_usuario()));

DROP POLICY IF EXISTS "boleto_docs_insert" ON boleto_docs;
CREATE POLICY "boleto_docs_insert" ON boleto_docs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_user()));

DROP POLICY IF EXISTS "boleto_docs_delete" ON boleto_docs;
CREATE POLICY "boleto_docs_delete" ON boleto_docs
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_user()));

-- ── Download dos PDFs (bucket boletos-docs) ────────────────────────────
DROP POLICY IF EXISTS "boletos_docs_storage_select" ON storage.objects;
CREATE POLICY "boletos_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'boletos-docs' AND (
      (SELECT is_admin_user()) OR EXISTS (
        SELECT 1 FROM boleto_docs d
        WHERE d.storage_path = storage.objects.name
          AND d.empresa_parceira = (SELECT empresa_do_usuario())
      )
    )
  );

COMMIT;

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (volta exatamente às policies das migrations 006 e 012):
-- BEGIN;
-- DROP POLICY IF EXISTS "boletos_select" ON quitacao_boletos;
-- CREATE POLICY "boletos_select" ON quitacao_boletos FOR SELECT TO authenticated
--   USING (is_admin_user() OR empresa_parceira = empresa_do_usuario());
-- DROP POLICY IF EXISTS "boletos_insert" ON quitacao_boletos;
-- CREATE POLICY "boletos_insert" ON quitacao_boletos FOR INSERT TO authenticated
--   WITH CHECK (is_admin_user() OR empresa_parceira = empresa_do_usuario());
-- DROP POLICY IF EXISTS "boletos_update" ON quitacao_boletos;
-- CREATE POLICY "boletos_update" ON quitacao_boletos FOR UPDATE TO authenticated
--   USING (is_admin_user() OR empresa_parceira = empresa_do_usuario())
--   WITH CHECK (is_admin_user() OR empresa_parceira = empresa_do_usuario());
-- DROP POLICY IF EXISTS "boletos_delete" ON quitacao_boletos;
-- CREATE POLICY "boletos_delete" ON quitacao_boletos FOR DELETE TO authenticated
--   USING (is_admin_user());
-- DROP POLICY IF EXISTS "boleto_docs_select" ON boleto_docs;
-- CREATE POLICY "boleto_docs_select" ON boleto_docs FOR SELECT TO authenticated
--   USING (is_admin_user() OR empresa_parceira = empresa_do_usuario());
-- DROP POLICY IF EXISTS "boleto_docs_insert" ON boleto_docs;
-- CREATE POLICY "boleto_docs_insert" ON boleto_docs FOR INSERT TO authenticated
--   WITH CHECK (is_admin_user());
-- DROP POLICY IF EXISTS "boleto_docs_delete" ON boleto_docs;
-- CREATE POLICY "boleto_docs_delete" ON boleto_docs FOR DELETE TO authenticated
--   USING (is_admin_user());
-- DROP POLICY IF EXISTS "boletos_docs_storage_select" ON storage.objects;
-- CREATE POLICY "boletos_docs_storage_select" ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'boletos-docs' AND (is_admin_user() OR EXISTS (
--     SELECT 1 FROM boleto_docs d WHERE d.storage_path = storage.objects.name
--       AND d.empresa_parceira = empresa_do_usuario())));
-- COMMIT;
-- ════════════════════════════════════════════════════════════════════════
