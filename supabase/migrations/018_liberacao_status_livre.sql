-- ════════════════════════════════════════════════════════════════════════
-- 018 — Liberação: status "Resíduo anexado" + mudar status livremente (out/2026)
--
-- Regras combinadas com o responsável em 08/10/2026:
--   • Novo passo do resíduo depois do solicitado: Pendente → Solicitado →
--     ANEXADO → Enviado → Pago → OK. "Anexado" é só status (parceiro ou Smart).
--   • Parceiro dono e Smart podem levar o cliente para QUALQUER status, inclusive
--     pular etapas ou voltar. Exceções: "Resíduo enviado" continua SÓ Smart, e
--     TIRAR o OK também é SÓ Smart (agora protegido no banco, não só na tela).
--   • Entrar em resíduo sem valor/enquadrada informados pede os dois (como hoje).
--   • Ir para "Pago" grava a data (base do alerta de 7 dias úteis) e acrescenta
--     "RESÍDUO PAGO em dd/mm/aaaa" na observação, como antes.
--   Smart = is_admin_user() OU tem_permissao('residuos_editar').
--
-- O QUE FAZ (só acrescenta; não apaga nem muda dado nenhum):
--   1. status 'anexado' liberado nas duas tabelas + coluna da data
--   2. triggers de proteção passam a vigiar a data nova
--   3. trigger novo: só a Smart tira o OK (aprovado true → false)
--   4. função nova liberacao_mudar_status (as antigas ficam no banco, sem uso)
-- COMO RODAR: SQL Editor do Supabase → colar TUDO → Run. Antes de publicar o site.
-- COMO DESFAZER: bloco "ROLLBACK" no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Status e data novos ───────────────────────────────────────────────
ALTER TABLE residuos DROP CONSTRAINT IF EXISTS residuos_status_chk;
ALTER TABLE residuos ADD CONSTRAINT residuos_status_chk CHECK (status IN (
  'residuo_pendente', 'residuo_solicitado', 'residuo_anexado', 'residuo_enviado', 'residuo_pago'));
ALTER TABLE residuos ADD COLUMN IF NOT EXISTS data_anexado date;

ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_data_anexado date;
ALTER TABLE liberacao_margem_master DROP CONSTRAINT IF EXISTS liberacao_residuo_status_chk;
ALTER TABLE liberacao_margem_master ADD CONSTRAINT liberacao_residuo_status_chk
  CHECK (residuo_status IS NULL OR residuo_status IN ('pendente', 'solicitado', 'anexado', 'enviado', 'pago'));

-- ── 2. Proteções vigiam a data nova ──────────────────────────────────────
CREATE OR REPLACE FUNCTION residuo_protege_update()
RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.residuo_rpc', true), '') <> '1' THEN
    IF NEW.status          IS DISTINCT FROM OLD.status
    OR NEW.valor_pago      IS DISTINCT FROM OLD.valor_pago
    OR NEW.data_pendente   IS DISTINCT FROM OLD.data_pendente
    OR NEW.data_solicitado IS DISTINCT FROM OLD.data_solicitado
    OR NEW.data_anexado    IS DISTINCT FROM OLD.data_anexado
    OR NEW.data_enviado    IS DISTINCT FROM OLD.data_enviado
    OR NEW.data_pago       IS DISTINCT FROM OLD.data_pago THEN
      RAISE EXCEPTION 'RESIDUO_STATUS_SOMENTE_RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION liberacao_protege_residuo()
RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.residuo_rpc', true), '') <> '1' THEN
    IF NEW.residuo_id              IS DISTINCT FROM OLD.residuo_id
    OR NEW.residuo_status          IS DISTINCT FROM OLD.residuo_status
    OR NEW.residuo_valor           IS DISTINCT FROM OLD.residuo_valor
    OR NEW.residuo_enquadrada      IS DISTINCT FROM OLD.residuo_enquadrada
    OR NEW.residuo_data_pendente   IS DISTINCT FROM OLD.residuo_data_pendente
    OR NEW.residuo_data_solicitado IS DISTINCT FROM OLD.residuo_data_solicitado
    OR NEW.residuo_data_anexado    IS DISTINCT FROM OLD.residuo_data_anexado
    OR NEW.residuo_data_enviado    IS DISTINCT FROM OLD.residuo_data_enviado
    OR NEW.residuo_data_pago       IS DISTINCT FROM OLD.residuo_data_pago
    OR NEW.residuo_valor_pago      IS DISTINCT FROM OLD.residuo_valor_pago THEN
      RAISE EXCEPTION 'RESIDUO_STATUS_SOMENTE_RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Só a Smart tira o OK ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION liberacao_protege_ok()
RETURNS trigger AS $$
BEGIN
  IF coalesce(OLD.aprovado, false) AND NOT coalesce(NEW.aprovado, false)
     AND NOT (is_admin_user() OR tem_permissao('residuos_editar')) THEN
    RAISE EXCEPTION 'LIBERACAO_OK_SOMENTE_SMART';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS liberacao_protege_ok ON liberacao_margem_master;
CREATE TRIGGER liberacao_protege_ok
  BEFORE UPDATE OF aprovado ON liberacao_margem_master
  FOR EACH ROW EXECUTE FUNCTION liberacao_protege_ok();

-- ── 4. Mudar status (qualquer → qualquer, com as exceções acima) ─────────
-- p_novo: pendente | res_pendente | res_solicitado | res_anexado | res_enviado | res_pago | ok
-- p_valor/p_enquadrada: obrigatórios só se o cliente ainda não tem resíduo informado.
CREATE OR REPLACE FUNCTION liberacao_mudar_status(
  p_liberacao_id text, p_novo text,
  p_valor numeric DEFAULT NULL, p_enquadrada boolean DEFAULT NULL, p_valor_pago numeric DEFAULT NULL
) RETURNS json AS $$
DECLARE
  l       liberacao_margem_master%ROWTYPE;
  v_hoje  date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_smart boolean := is_admin_user() OR tem_permissao('residuos_editar');
  v_atual text;
  v_st    text;
  v_id    uuid;
  v_cpf   text;
  v_valor numeric;
  v_enq   boolean;
BEGIN
  IF p_novo NOT IN ('pendente', 'res_pendente', 'res_solicitado', 'res_anexado', 'res_enviado', 'res_pago', 'ok') THEN
    RAISE EXCEPTION 'RESIDUO_TRANSICAO_INVALIDA';
  END IF;

  SELECT * INTO l FROM liberacao_margem_master WHERE id::text = p_liberacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESIDUO_LIBERACAO_NAO_ENCONTRADA'; END IF;
  IF NOT (v_smart OR (l.empresa_parceira IS NOT NULL AND l.empresa_parceira = empresa_do_usuario())) THEN
    RAISE EXCEPTION 'RESIDUO_SEM_PERMISSAO';
  END IF;

  v_atual := CASE WHEN coalesce(l.aprovado, false) THEN 'ok'
                  WHEN l.residuo_status IS NULL THEN 'pendente'
                  ELSE 'res_' || l.residuo_status END;
  IF v_atual = p_novo THEN RETURN json_build_object('ok', true, 'status', p_novo, 'sem_mudanca', true); END IF;
  IF v_atual = 'ok' AND NOT v_smart THEN RAISE EXCEPTION 'LIBERACAO_OK_SOMENTE_SMART'; END IF;
  IF p_novo = 'res_enviado' AND NOT v_smart THEN RAISE EXCEPTION 'RESIDUO_SOMENTE_SMART'; END IF;

  PERFORM set_config('app.residuo_rpc', '1', true);

  -- OK: liga o aprovado e mantém o resíduo como histórico na linha
  IF p_novo = 'ok' THEN
    UPDATE liberacao_margem_master SET aprovado = true WHERE id = l.id;
    RETURN json_build_object('ok', true, 'status', p_novo);
  END IF;

  -- Pendente: sem OK e sem resíduo em andamento (valor/enquadrada ficam guardados)
  IF p_novo = 'pendente' THEN
    UPDATE liberacao_margem_master SET aprovado = false, residuo_status = NULL WHERE id = l.id;
    RETURN json_build_object('ok', true, 'status', p_novo);
  END IF;

  -- Algum status de resíduo
  v_st    := substr(p_novo, 5);
  v_valor := coalesce(p_valor, l.residuo_valor);
  v_enq   := coalesce(p_enquadrada, l.residuo_enquadrada);
  IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'RESIDUO_VALOR_OBRIGATORIO'; END IF;
  IF v_enq IS NULL THEN RAISE EXCEPTION 'RESIDUO_ENQUADRADA_OBRIGATORIA'; END IF;

  SELECT id INTO v_id FROM residuos WHERE id = l.residuo_id;
  IF v_id IS NULL THEN
    v_cpf := lpad(regexp_replace(coalesce(l.cpf, ''), '\D', '', 'g'), 11, '0');
    IF v_cpf !~ '^[0-9]{11}$' OR v_cpf = '00000000000' THEN RAISE EXCEPTION 'RESIDUO_CPF_INVALIDO'; END IF;
    INSERT INTO residuos (liberacao_id, cpf, nome, convenio, produto, empresa_parceira, saldo_devedor, troco, obs,
                          status, valor_pendente, enquadrada, data_pendente, criado_por)
    VALUES (l.id::text, v_cpf, l.nome, l.convenio, l.produto, l.empresa_parceira, l.saldo_devedor, l.troco, l.obs,
            'residuo_pendente', v_valor, v_enq, v_hoje, auth.uid())
    RETURNING id INTO v_id;
  END IF;

  UPDATE residuos SET
    status          = 'residuo_' || v_st,
    valor_pendente  = v_valor,
    enquadrada      = v_enq,
    data_pendente   = CASE WHEN v_st = 'pendente'   THEN v_hoje ELSE coalesce(data_pendente, v_hoje) END,
    data_solicitado = CASE WHEN v_st = 'solicitado' THEN v_hoje ELSE data_solicitado END,
    data_anexado    = CASE WHEN v_st = 'anexado'    THEN v_hoje ELSE data_anexado END,
    data_enviado    = CASE WHEN v_st = 'enviado'    THEN v_hoje ELSE data_enviado END,
    data_pago       = CASE WHEN v_st = 'pago'       THEN v_hoje ELSE data_pago END,
    valor_pago      = CASE WHEN v_st = 'pago' THEN coalesce(p_valor_pago, v_valor) ELSE valor_pago END
  WHERE id = v_id;

  UPDATE liberacao_margem_master SET
    aprovado                = false,
    em_residuo              = false,
    residuo_id              = v_id,
    residuo_status          = v_st,
    residuo_valor           = v_valor,
    residuo_enquadrada      = v_enq,
    residuo_data_pendente   = CASE WHEN v_st = 'pendente'   THEN v_hoje ELSE coalesce(residuo_data_pendente, v_hoje) END,
    residuo_data_solicitado = CASE WHEN v_st = 'solicitado' THEN v_hoje ELSE residuo_data_solicitado END,
    residuo_data_anexado    = CASE WHEN v_st = 'anexado'    THEN v_hoje ELSE residuo_data_anexado END,
    residuo_data_enviado    = CASE WHEN v_st = 'enviado'    THEN v_hoje ELSE residuo_data_enviado END,
    residuo_data_pago       = CASE WHEN v_st = 'pago'       THEN v_hoje ELSE residuo_data_pago END,
    residuo_valor_pago      = CASE WHEN v_st = 'pago' THEN coalesce(p_valor_pago, v_valor) ELSE residuo_valor_pago END,
    obs = CASE WHEN v_st = 'pago'
               THEN btrim(coalesce(nullif(btrim(coalesce(obs, '')), '') || ' · ', '') || 'RESÍDUO PAGO em ' || to_char(v_hoje, 'DD/MM/YYYY'))
               ELSE obs END
  WHERE id = l.id;

  RETURN json_build_object('ok', true, 'status', p_novo);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION liberacao_mudar_status(text, text, numeric, boolean, numeric) TO authenticated;

COMMIT;

-- Conferência rápida depois de rodar (só leitura):
--   SELECT residuo_status, aprovado, count(*) FROM liberacao_margem_master GROUP BY 1, 2 ORDER BY 1, 2;

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (só se precisar desfazer; só funciona se NINGUÉM estiver em "anexado"):
-- BEGIN;
-- DROP FUNCTION IF EXISTS liberacao_mudar_status(text, text, numeric, boolean, numeric);
-- DROP TRIGGER  IF EXISTS liberacao_protege_ok ON liberacao_margem_master;
-- DROP FUNCTION IF EXISTS liberacao_protege_ok();
-- ALTER TABLE liberacao_margem_master DROP CONSTRAINT IF EXISTS liberacao_residuo_status_chk;
-- ALTER TABLE liberacao_margem_master ADD CONSTRAINT liberacao_residuo_status_chk
--   CHECK (residuo_status IS NULL OR residuo_status IN ('pendente', 'solicitado', 'enviado', 'pago'));
-- ALTER TABLE residuos DROP CONSTRAINT IF EXISTS residuos_status_chk;
-- ALTER TABLE residuos ADD CONSTRAINT residuos_status_chk CHECK (status IN (
--   'residuo_pendente', 'residuo_solicitado', 'residuo_enviado', 'residuo_pago'));
-- (as colunas residuo_data_anexado / data_anexado podem ficar — não atrapalham)
-- COMMIT;
-- ════════════════════════════════════════════════════════════════════════
