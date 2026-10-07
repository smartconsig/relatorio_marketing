-- ════════════════════════════════════════════════════════════════════════
-- 015 — Resíduo dentro da Liberação de Margem (Fase 3 do redesenho, out/2026)
--
-- Regras combinadas com o responsável em 06/10/2026:
--   • O cliente NÃO sai mais da Liberação: o resíduo vira um status da linha.
--   • 4 etapas: Pendente (parceiro, com VALOR e ENQUADRADA? obrigatórios)
--               → Solicitado (parceiro) → Enviado (SÓ Smart) → Pago (parceiro).
--     A Smart (admin ou quem tem residuos_editar) pode fazer todas.
--   • Ao pagar: obs ganha "RESÍDUO PAGO em dd/mm/aaaa" (como antes).
--   • Todos veem o status; o alerta de 7 dias úteis é calculado na tela.
--   • Resíduos antigos: abertos continuam no status que estavam; os já pagos
--     aparecem como "Resíduo pago".
--
-- O QUE FAZ (só acrescenta; não apaga dado nenhum):
--   1. residuos: status novo 'residuo_enviado' + valor_pendente, enquadrada, data_enviado
--   2. liberacao_margem_master: colunas residuo_* (status e datas visíveis ao parceiro)
--   3. trigger que impede editar residuo_* por fora das funções
--   4. funções liberacao_residuo_iniciar / liberacao_residuo_avancar
--   5. trigger de exclusão do resíduo passa a limpar também as colunas novas
--   6. preenche as colunas novas a partir do histórico (abertos e pagos)
--
-- COMO RODAR: SQL Editor do Supabase → colar TUDO → Run. Rodar e logo em
-- seguida publicar o site (o site antigo ainda esconde a linha "em resíduo").
-- COMO DESFAZER: bloco "ROLLBACK" no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. residuos ────────────────────────────────────────────────────────────
ALTER TABLE residuos DROP CONSTRAINT IF EXISTS residuos_status_chk;
ALTER TABLE residuos ADD CONSTRAINT residuos_status_chk CHECK (status IN (
  'residuo_pendente', 'residuo_solicitado', 'residuo_enviado', 'residuo_pago'));
ALTER TABLE residuos ADD COLUMN IF NOT EXISTS valor_pendente numeric;
ALTER TABLE residuos ADD COLUMN IF NOT EXISTS enquadrada     boolean;
ALTER TABLE residuos ADD COLUMN IF NOT EXISTS data_enviado   date;

-- Protege também a data nova
CREATE OR REPLACE FUNCTION residuo_protege_update()
RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.residuo_rpc', true), '') <> '1' THEN
    IF NEW.status          IS DISTINCT FROM OLD.status
    OR NEW.valor_pago      IS DISTINCT FROM OLD.valor_pago
    OR NEW.data_pendente   IS DISTINCT FROM OLD.data_pendente
    OR NEW.data_solicitado IS DISTINCT FROM OLD.data_solicitado
    OR NEW.data_enviado    IS DISTINCT FROM OLD.data_enviado
    OR NEW.data_pago       IS DISTINCT FROM OLD.data_pago THEN
      RAISE EXCEPTION 'RESIDUO_STATUS_SOMENTE_RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. liberacao_margem_master: espelho do resíduo na linha ────────────────
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_id              uuid;
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_status          text;  -- pendente|solicitado|enviado|pago
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_valor           numeric;
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_enquadrada      boolean;
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_data_pendente   date;
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_data_solicitado date;
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_data_enviado    date;
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_data_pago       date;
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS residuo_valor_pago      numeric;

ALTER TABLE liberacao_margem_master DROP CONSTRAINT IF EXISTS liberacao_residuo_status_chk;
ALTER TABLE liberacao_margem_master ADD CONSTRAINT liberacao_residuo_status_chk
  CHECK (residuo_status IS NULL OR residuo_status IN ('pendente', 'solicitado', 'enviado', 'pago'));

-- ── 3. residuo_* da liberação só mudam pelas funções ──────────────────────
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
    OR NEW.residuo_data_enviado    IS DISTINCT FROM OLD.residuo_data_enviado
    OR NEW.residuo_data_pago       IS DISTINCT FROM OLD.residuo_data_pago
    OR NEW.residuo_valor_pago      IS DISTINCT FROM OLD.residuo_valor_pago THEN
      RAISE EXCEPTION 'RESIDUO_STATUS_SOMENTE_RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS liberacao_protege_residuo ON liberacao_margem_master;
CREATE TRIGGER liberacao_protege_residuo
  BEFORE UPDATE ON liberacao_margem_master
  FOR EACH ROW EXECUTE FUNCTION liberacao_protege_residuo();

-- ── 4a. Colocar em resíduo pendente (valor e enquadrada obrigatórios) ────
CREATE OR REPLACE FUNCTION liberacao_residuo_iniciar(p_liberacao_id text, p_valor numeric, p_enquadrada boolean)
RETURNS json AS $$
DECLARE
  l      liberacao_margem_master%ROWTYPE;
  v_id   uuid;
  v_cpf  text;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'RESIDUO_VALOR_OBRIGATORIO'; END IF;
  IF p_enquadrada IS NULL THEN RAISE EXCEPTION 'RESIDUO_ENQUADRADA_OBRIGATORIA'; END IF;

  SELECT * INTO l FROM liberacao_margem_master WHERE id::text = p_liberacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESIDUO_LIBERACAO_NAO_ENCONTRADA'; END IF;
  IF NOT (is_admin_user() OR tem_permissao('residuos_editar')
          OR (l.empresa_parceira IS NOT NULL AND l.empresa_parceira = empresa_do_usuario())) THEN
    RAISE EXCEPTION 'RESIDUO_SEM_PERMISSAO';
  END IF;
  IF coalesce(l.aprovado, false) THEN RAISE EXCEPTION 'RESIDUO_LIBERACAO_OK'; END IF;
  IF l.residuo_status IN ('pendente', 'solicitado', 'enviado') THEN RAISE EXCEPTION 'RESIDUO_JA_EXISTE'; END IF;

  v_cpf := lpad(regexp_replace(coalesce(l.cpf, ''), '\D', '', 'g'), 11, '0');
  IF v_cpf !~ '^[0-9]{11}$' OR v_cpf = '00000000000' THEN RAISE EXCEPTION 'RESIDUO_CPF_INVALIDO'; END IF;

  INSERT INTO residuos (liberacao_id, cpf, nome, convenio, produto, empresa_parceira, saldo_devedor, troco, obs,
                        status, valor_pendente, enquadrada, data_pendente, criado_por)
  VALUES (l.id::text, v_cpf, l.nome, l.convenio, l.produto, l.empresa_parceira, l.saldo_devedor, l.troco, l.obs,
          'residuo_pendente', p_valor, p_enquadrada, v_hoje, auth.uid())
  RETURNING id INTO v_id;

  PERFORM set_config('app.residuo_rpc', '1', true);
  UPDATE liberacao_margem_master SET
    em_residuo = false,
    residuo_id = v_id, residuo_status = 'pendente', residuo_valor = p_valor, residuo_enquadrada = p_enquadrada,
    residuo_data_pendente = v_hoje, residuo_data_solicitado = NULL, residuo_data_enviado = NULL,
    residuo_data_pago = NULL, residuo_valor_pago = NULL
  WHERE id = l.id;

  RETURN json_build_object('ok', true, 'residuo_id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4b. Avançar: pendente→solicitado (parceiro) → enviado (Smart) → pago (parceiro)
CREATE OR REPLACE FUNCTION liberacao_residuo_avancar(p_liberacao_id text, p_novo text, p_valor_pago numeric DEFAULT NULL)
RETURNS json AS $$
DECLARE
  l       liberacao_margem_master%ROWTYPE;
  v_hoje  date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_smart boolean := is_admin_user() OR tem_permissao('residuos_editar');
  v_dono  boolean;
BEGIN
  SELECT * INTO l FROM liberacao_margem_master WHERE id::text = p_liberacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESIDUO_LIBERACAO_NAO_ENCONTRADA'; END IF;
  v_dono := v_smart OR (l.empresa_parceira IS NOT NULL AND l.empresa_parceira = empresa_do_usuario());
  IF NOT v_dono THEN RAISE EXCEPTION 'RESIDUO_SEM_PERMISSAO'; END IF;

  IF NOT ((p_novo = 'solicitado' AND l.residuo_status = 'pendente')
       OR (p_novo = 'enviado'    AND l.residuo_status = 'solicitado')
       OR (p_novo = 'pago'       AND l.residuo_status = 'enviado')) THEN
    RAISE EXCEPTION 'RESIDUO_TRANSICAO_INVALIDA';
  END IF;
  IF p_novo = 'enviado' AND NOT v_smart THEN RAISE EXCEPTION 'RESIDUO_SOMENTE_SMART'; END IF;

  PERFORM set_config('app.residuo_rpc', '1', true);

  UPDATE residuos SET
    status          = 'residuo_' || p_novo,
    data_solicitado = CASE WHEN p_novo = 'solicitado' THEN v_hoje ELSE data_solicitado END,
    data_enviado    = CASE WHEN p_novo = 'enviado'    THEN v_hoje ELSE data_enviado END,
    data_pago       = CASE WHEN p_novo = 'pago'       THEN v_hoje ELSE data_pago END,
    valor_pago      = CASE WHEN p_novo = 'pago' THEN coalesce(p_valor_pago, valor_pendente, valor_pago) ELSE valor_pago END
  WHERE id = l.residuo_id;

  UPDATE liberacao_margem_master SET
    residuo_status          = p_novo,
    residuo_data_solicitado = CASE WHEN p_novo = 'solicitado' THEN v_hoje ELSE residuo_data_solicitado END,
    residuo_data_enviado    = CASE WHEN p_novo = 'enviado'    THEN v_hoje ELSE residuo_data_enviado END,
    residuo_data_pago       = CASE WHEN p_novo = 'pago'       THEN v_hoje ELSE residuo_data_pago END,
    residuo_valor_pago      = CASE WHEN p_novo = 'pago' THEN coalesce(p_valor_pago, residuo_valor) ELSE residuo_valor_pago END,
    obs = CASE WHEN p_novo = 'pago'
               THEN btrim(coalesce(nullif(btrim(coalesce(obs, '')), '') || ' · ', '') || 'RESÍDUO PAGO em ' || to_char(v_hoje, 'DD/MM/YYYY'))
               ELSE obs END
  WHERE id = l.id;

  RETURN json_build_object('ok', true, 'status', p_novo);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION liberacao_residuo_iniciar(text, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION liberacao_residuo_avancar(text, text, numeric) TO authenticated;

-- ── 5. Excluir o resíduo (admin) limpa também as colunas novas ──────────
CREATE OR REPLACE FUNCTION residuo_solta_liberacao()
RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'residuo_pago' THEN
    PERFORM set_config('app.residuo_rpc', '1', true);
    UPDATE liberacao_margem_master SET
      em_residuo = false,
      residuo_id = NULL, residuo_status = NULL, residuo_valor = NULL, residuo_enquadrada = NULL,
      residuo_data_pendente = NULL, residuo_data_solicitado = NULL, residuo_data_enviado = NULL,
      residuo_data_pago = NULL, residuo_valor_pago = NULL
    WHERE id::text = OLD.liberacao_id AND (residuo_id = OLD.id OR residuo_id IS NULL);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Preenche a partir do histórico ─────────────────────────────────────
DO $$
BEGIN
  PERFORM set_config('app.residuo_rpc', '1', true);

  -- Abertos (pendente/solicitado): voltam a aparecer na Liberação com o status
  UPDATE liberacao_margem_master l SET
    em_residuo = false,
    residuo_id = r.id,
    residuo_status = replace(r.status, 'residuo_', ''),
    residuo_valor = r.valor_pendente,
    residuo_enquadrada = r.enquadrada,
    residuo_data_pendente = r.data_pendente,
    residuo_data_solicitado = r.data_solicitado,
    residuo_data_enviado = r.data_enviado
  FROM residuos r
  WHERE r.liberacao_id = l.id::text
    AND r.status IN ('residuo_pendente', 'residuo_solicitado', 'residuo_enviado');

  -- Já pagos: o mais recente de cada linha vira "Resíduo pago"
  UPDATE liberacao_margem_master l SET
    residuo_id = r.id,
    residuo_status = 'pago',
    residuo_valor = r.valor_pendente,
    residuo_enquadrada = r.enquadrada,
    residuo_data_pendente = r.data_pendente,
    residuo_data_solicitado = r.data_solicitado,
    residuo_data_enviado = r.data_enviado,
    residuo_data_pago = r.data_pago,
    residuo_valor_pago = r.valor_pago
  FROM (
    SELECT DISTINCT ON (liberacao_id) *
    FROM residuos
    WHERE status = 'residuo_pago'
    ORDER BY liberacao_id, data_pago DESC NULLS LAST, updated_at DESC
  ) r
  WHERE r.liberacao_id = l.id::text
    AND l.residuo_status IS NULL;
END $$;

-- Conferência rápida depois de rodar (só leitura):
--   SELECT residuo_status, count(*) FROM liberacao_margem_master GROUP BY 1 ORDER BY 1;

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (só se precisar desfazer; os resíduos na tabela residuos ficam):
--   DROP FUNCTION IF EXISTS liberacao_residuo_iniciar(text, numeric, boolean);
--   DROP FUNCTION IF EXISTS liberacao_residuo_avancar(text, text, numeric);
--   DROP TRIGGER  IF EXISTS liberacao_protege_residuo ON liberacao_margem_master;
--   DROP FUNCTION IF EXISTS liberacao_protege_residuo();
--   -- linhas com resíduo aberto voltam a ficar escondidas na tela antiga:
--   UPDATE liberacao_margem_master SET em_residuo = true WHERE residuo_status IN ('pendente','solicitado','enviado');
--   ALTER TABLE liberacao_margem_master DROP CONSTRAINT IF EXISTS liberacao_residuo_status_chk,
--     DROP COLUMN IF EXISTS residuo_id, DROP COLUMN IF EXISTS residuo_status, DROP COLUMN IF EXISTS residuo_valor,
--     DROP COLUMN IF EXISTS residuo_enquadrada, DROP COLUMN IF EXISTS residuo_data_pendente,
--     DROP COLUMN IF EXISTS residuo_data_solicitado, DROP COLUMN IF EXISTS residuo_data_enviado,
--     DROP COLUMN IF EXISTS residuo_data_pago, DROP COLUMN IF EXISTS residuo_valor_pago;
--   (o status 'residuo_enviado' só pode sair do CHECK se nenhuma linha estiver nele)
-- ════════════════════════════════════════════════════════════════════════
