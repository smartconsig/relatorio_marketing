-- ════════════════════════════════════════════════════════════════════════
-- 019 — Quitação de Boleto: respaldo BOLETO + reprovação automática +
--       solicitar de novo cliente reprovado (out/2026)
--
-- Regras combinadas com o responsável em 08/10/2026:
--   • Dois respaldos: o de FATURA (migration 014, colunas respaldo_*) e o novo de
--     BOLETO ("Relatório Boleto Smart": aba CPFs + aba Contratos). Os dois só
--     aparecem na EXPORTAÇÃO. Só a Smart (admin) importa; o novo substitui o antigo;
--     grava nas propostas abertas do CPF (boleto solicitado / enviado).
--   • Respaldo boleto com status "Sem contratos" e mensagem "Nenhum contrato
--     encontrado…" REPROVA o cliente na hora (motivo = a mensagem).
--   • Cliente REPROVADO pode ser solicitado de novo (por qualquer parceiro ou pela
--     Smart), depois de confirmar que está ciente. O MESMO registro é reaberto:
--     volta para "Solicitar boleto" com os dados novos, guarda quando/por que tinha
--     sido reprovado, e os boletos/faturas anexados continuam lá.
--
-- O QUE FAZ (só acrescenta; não apaga nem muda dado nenhum existente):
--   1. colunas do respaldo boleto e do histórico de reprovação
--   2. trigger de proteção do respaldo passa a vigiar as colunas novas
--   3. função boleto_importar_respaldo_boleto (Smart)
--   4. função boleto_reprovados_existentes (consulta antes de cadastrar)
--   5. função boleto_reabrir_reprovado
-- COMO RODAR: SQL Editor do Supabase → colar TUDO → Run. Antes de publicar o site.
-- COMO DESFAZER: bloco "ROLLBACK" no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Colunas novas ─────────────────────────────────────────────────────
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_boleto_protocolo text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_boleto_status    text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_boleto_mensagem  text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_boleto_alerta    text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_boleto_contratos jsonb;   -- [{contrato, modalidade, empregador, matricula, parcela, saldo, resultado, erro}]
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_boleto_em        timestamptz;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_boleto_por       uuid;

ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS reprovado_antes_em      date;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS reprovado_antes_motivo  text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS reprovado_antes_empresa text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS reaberto_em             timestamptz;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS reaberto_por            uuid;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS reaberturas             int NOT NULL DEFAULT 0;

-- ── 2. Respaldo e histórico só mudam pelas funções ───────────────────────
CREATE OR REPLACE FUNCTION boleto_protege_respaldo()
RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.boleto_respaldo_rpc', true), '') <> '1' THEN
    IF NEW.respaldo_protocolo        IS DISTINCT FROM OLD.respaldo_protocolo
    OR NEW.respaldo_status           IS DISTINCT FROM OLD.respaldo_status
    OR NEW.respaldo_detalhes         IS DISTINCT FROM OLD.respaldo_detalhes
    OR NEW.respaldo_obs              IS DISTINCT FROM OLD.respaldo_obs
    OR NEW.respaldo_em               IS DISTINCT FROM OLD.respaldo_em
    OR NEW.respaldo_por              IS DISTINCT FROM OLD.respaldo_por
    OR NEW.respaldo_boleto_protocolo IS DISTINCT FROM OLD.respaldo_boleto_protocolo
    OR NEW.respaldo_boleto_status    IS DISTINCT FROM OLD.respaldo_boleto_status
    OR NEW.respaldo_boleto_mensagem  IS DISTINCT FROM OLD.respaldo_boleto_mensagem
    OR NEW.respaldo_boleto_alerta    IS DISTINCT FROM OLD.respaldo_boleto_alerta
    OR NEW.respaldo_boleto_contratos IS DISTINCT FROM OLD.respaldo_boleto_contratos
    OR NEW.respaldo_boleto_em        IS DISTINCT FROM OLD.respaldo_boleto_em
    OR NEW.respaldo_boleto_por       IS DISTINCT FROM OLD.respaldo_boleto_por
    OR NEW.reprovado_antes_em        IS DISTINCT FROM OLD.reprovado_antes_em
    OR NEW.reprovado_antes_motivo    IS DISTINCT FROM OLD.reprovado_antes_motivo
    OR NEW.reprovado_antes_empresa   IS DISTINCT FROM OLD.reprovado_antes_empresa
    OR NEW.reaberto_em               IS DISTINCT FROM OLD.reaberto_em
    OR NEW.reaberto_por              IS DISTINCT FROM OLD.reaberto_por
    OR NEW.reaberturas               IS DISTINCT FROM OLD.reaberturas THEN
      RAISE EXCEPTION 'BOLETO_RESPALDO_SOMENTE_RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Importa o respaldo BOLETO de UM CPF (e reprova se "sem contratos") ─
CREATE OR REPLACE FUNCTION boleto_importar_respaldo_boleto(
  p_cpf text, p_protocolo text, p_status text, p_mensagem text, p_alerta text, p_contratos jsonb
) RETURNS json AS $$
DECLARE
  v_cpf      text := lpad(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), 11, '0');
  v_hoje     date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_reprovar boolean := lower(btrim(coalesce(p_status, ''))) = 'sem contratos'
                        AND lower(coalesce(p_mensagem, '')) LIKE 'nenhum contrato encontrado%';
  v_n   int;
  v_rep int := 0;
BEGIN
  IF NOT is_admin_user() THEN RAISE EXCEPTION 'BOLETO_SOMENTE_ADMIN'; END IF;
  IF v_cpf !~ '^[0-9]{11}$' OR v_cpf = '00000000000' THEN RAISE EXCEPTION 'BOLETO_CPF_INVALIDO'; END IF;

  PERFORM set_config('app.boleto_respaldo_rpc', '1', true);
  PERFORM set_config('app.boleto_rpc', '1', true);

  UPDATE quitacao_boletos SET
    respaldo_boleto_protocolo = nullif(btrim(p_protocolo), ''),
    respaldo_boleto_status    = nullif(btrim(p_status), ''),
    respaldo_boleto_mensagem  = nullif(btrim(p_mensagem), ''),
    respaldo_boleto_alerta    = nullif(btrim(p_alerta), ''),
    respaldo_boleto_contratos = CASE WHEN jsonb_typeof(p_contratos) = 'array' AND jsonb_array_length(p_contratos) > 0
                                     THEN p_contratos ELSE NULL END,
    respaldo_boleto_em        = now(),
    respaldo_boleto_por       = auth.uid()
  WHERE cpf = v_cpf
    AND status IN ('boleto_solicitado', 'boleto_enviado');
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_reprovar THEN
    UPDATE quitacao_boletos SET
      status            = 'boleto_reprovado',
      data_reprovado    = v_hoje,
      motivo_reprovacao = 'Respaldo boleto: ' || coalesce(nullif(btrim(p_mensagem), ''), 'Sem contratos')
    WHERE cpf = v_cpf
      AND status IN ('boleto_solicitado', 'boleto_enviado');
    GET DIAGNOSTICS v_rep = ROW_COUNT;
  END IF;

  RETURN json_build_object('ok', true, 'propostas', v_n, 'reprovadas', v_rep);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Antes de cadastrar: quais CPF+produto já existem SÓ como reprovado ─
-- p_itens: [{"cpf": "...", "produto": "..."}]. Vê todas as empresas (o parceiro
-- pode pegar um cliente reprovado de outro parceiro); a empresa anterior só
-- aparece para a Smart.
CREATE OR REPLACE FUNCTION boleto_reprovados_existentes(p_itens jsonb)
RETURNS json AS $$
DECLARE
  v_admin boolean := is_admin_user();
BEGIN
  RETURN coalesce((
    SELECT json_agg(json_build_object(
      'id', b.id, 'cpf', b.cpf, 'produto', b.produto, 'nome', b.nome,
      'data_reprovado', b.data_reprovado, 'motivo', b.motivo_reprovacao,
      'empresa', CASE WHEN v_admin OR b.empresa_parceira = empresa_do_usuario() THEN b.empresa_parceira END))
    FROM (SELECT DISTINCT lpad(regexp_replace(coalesce(i->>'cpf', ''), '\D', '', 'g'), 11, '0') AS cpf,
                          boleto_canon_produto(i->>'produto') AS produto
          FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) i) q
    JOIN quitacao_boletos b ON b.cpf = q.cpf AND boleto_canon_produto(b.produto) = q.produto
    WHERE b.status = 'boleto_reprovado'
      AND NOT EXISTS (SELECT 1 FROM quitacao_boletos o
                      WHERE o.cpf = b.cpf AND boleto_canon_produto(o.produto) = q.produto
                        AND o.status <> 'boleto_reprovado')
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── 5. Solicitar de novo: reabre o MESMO registro reprovado ──────────────
-- p_dados: {nome, email, contrato, valor_parcela, saldo_devedor, troco, convenio, obs, empresa_parceira}
-- Parceiro: o cliente passa a ser da empresa dele. Smart: usa a empresa informada.
CREATE OR REPLACE FUNCTION boleto_reabrir_reprovado(p_id uuid, p_dados jsonb)
RETURNS json AS $$
DECLARE
  r         quitacao_boletos%ROWTYPE;
  v_admin   boolean := is_admin_user();
  v_empresa text;
  v_num     numeric;
BEGIN
  SELECT * INTO r FROM quitacao_boletos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOLETO_NAO_ENCONTRADO'; END IF;
  IF r.status <> 'boleto_reprovado' THEN RAISE EXCEPTION 'BOLETO_NAO_REPROVADO'; END IF;

  v_empresa := CASE WHEN v_admin THEN coalesce(nullif(btrim(p_dados->>'empresa_parceira'), ''), r.empresa_parceira)
                    ELSE empresa_do_usuario() END;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'BOLETO_SEM_PERMISSAO'; END IF;

  -- Mesma regra do cadastro: CPF já na Liberação de Margem no mesmo produto não volta
  PERFORM 1 FROM liberacao_margem_master
  WHERE lpad(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), 11, '0') = r.cpf
    AND boleto_canon_produto(produto) = boleto_canon_produto(r.produto)
  LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'BOLETO_CPF_JA_LIBERACAO'; END IF;

  v_num := nullif(p_dados->>'saldo_devedor', '')::numeric;
  IF v_num IS NOT NULL AND v_num <= 0 THEN RAISE EXCEPTION 'BOLETO_SALDO_INVALIDO'; END IF;

  PERFORM set_config('app.boleto_rpc', '1', true);
  PERFORM set_config('app.boleto_respaldo_rpc', '1', true);

  UPDATE quitacao_boletos SET
    nome             = coalesce(nullif(btrim(p_dados->>'nome'), ''), nome),
    email            = coalesce(nullif(btrim(p_dados->>'email'), ''), email),
    contrato         = coalesce(nullif(btrim(p_dados->>'contrato'), ''), contrato),
    valor_parcela    = coalesce(nullif(p_dados->>'valor_parcela', '')::numeric, valor_parcela),
    saldo_devedor    = coalesce(v_num, saldo_devedor),
    troco            = coalesce(nullif(p_dados->>'troco', '')::numeric, troco),
    convenio         = coalesce(nullif(btrim(p_dados->>'convenio'), ''), convenio),
    obs              = coalesce(nullif(btrim(p_dados->>'obs'), ''), obs),
    empresa_parceira = v_empresa,
    status           = 'solicitar_boleto',
    data_solicitado  = NULL,
    data_enviado     = NULL,
    data_quitado     = NULL,
    data_reprovado   = NULL,
    motivo_reprovacao = NULL,
    reprovado_antes_em      = r.data_reprovado,
    reprovado_antes_motivo  = r.motivo_reprovacao,
    reprovado_antes_empresa = r.empresa_parceira,
    reaberto_em      = now(),
    reaberto_por     = auth.uid(),
    reaberturas      = reaberturas + 1,
    -- respaldos eram do ciclo reprovado; os próximos lotes trazem os novos
    respaldo_protocolo = NULL, respaldo_status = NULL, respaldo_detalhes = NULL, respaldo_obs = NULL,
    respaldo_em = NULL, respaldo_por = NULL,
    respaldo_boleto_protocolo = NULL, respaldo_boleto_status = NULL, respaldo_boleto_mensagem = NULL,
    respaldo_boleto_alerta = NULL, respaldo_boleto_contratos = NULL, respaldo_boleto_em = NULL, respaldo_boleto_por = NULL,
    created_at       = now()          -- volta para o topo da lista e entra no período de hoje
  WHERE id = p_id;

  -- Os documentos anexados continuam; passam a ser visíveis para a empresa nova
  UPDATE boleto_docs SET empresa_parceira = v_empresa WHERE boleto_id = p_id;

  RETURN json_build_object('ok', true, 'id', p_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION boleto_importar_respaldo_boleto(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION boleto_reprovados_existentes(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION boleto_reabrir_reprovado(uuid, jsonb) TO authenticated;

COMMIT;

-- Conferência rápida depois de rodar (só leitura):
--   SELECT count(*) FILTER (WHERE respaldo_boleto_status IS NOT NULL) AS com_respaldo_boleto,
--          count(*) FILTER (WHERE reaberturas > 0) AS reabertos FROM quitacao_boletos;

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (só se precisar desfazer — os reabertos continuam reabertos):
-- BEGIN;
-- DROP FUNCTION IF EXISTS boleto_importar_respaldo_boleto(text, text, text, text, text, jsonb);
-- DROP FUNCTION IF EXISTS boleto_reprovados_existentes(jsonb);
-- DROP FUNCTION IF EXISTS boleto_reabrir_reprovado(uuid, jsonb);
-- CREATE OR REPLACE FUNCTION boleto_protege_respaldo() RETURNS trigger AS $f$
-- BEGIN
--   IF coalesce(current_setting('app.boleto_respaldo_rpc', true), '') <> '1' THEN
--     IF NEW.respaldo_protocolo IS DISTINCT FROM OLD.respaldo_protocolo
--     OR NEW.respaldo_status    IS DISTINCT FROM OLD.respaldo_status
--     OR NEW.respaldo_detalhes  IS DISTINCT FROM OLD.respaldo_detalhes
--     OR NEW.respaldo_obs       IS DISTINCT FROM OLD.respaldo_obs
--     OR NEW.respaldo_em        IS DISTINCT FROM OLD.respaldo_em
--     OR NEW.respaldo_por       IS DISTINCT FROM OLD.respaldo_por THEN
--       RAISE EXCEPTION 'BOLETO_RESPALDO_SOMENTE_RPC';
--     END IF;
--   END IF;
--   RETURN NEW;
-- END; $f$ LANGUAGE plpgsql;
-- (as colunas novas podem ficar — não atrapalham)
-- COMMIT;
-- ════════════════════════════════════════════════════════════════════════
