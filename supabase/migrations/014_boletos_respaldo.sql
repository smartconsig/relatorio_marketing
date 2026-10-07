-- ════════════════════════════════════════════════════════════════════════
-- 014 — Respaldo da Quitação de Boleto (Fase 2 do redesenho, out/2026)
--
-- O "Relatório de Faturas Smart" (planilha) traz, por CPF: protocolo, status
-- da fatura e detalhes por cartão. Ele vira um bloco "Respaldo" na proposta
-- do cliente. Regras combinadas com o responsável em 06/10/2026:
--   • só a Smart (admin) importa; o parceiro só VÊ o respaldo dos clientes dele
--   • o respaldo novo SUBSTITUI o anterior
--   • grava só nas propostas ABERTAS do CPF (boleto_solicitado / boleto_enviado)
--
-- O QUE FAZ: só ACRESCENTA (4 colunas + 1 função + 1 trigger). Não altera
-- nenhuma coluna, regra ou função existente.
-- COMO RODAR: SQL Editor do Supabase → colar tudo → Run. ANTES do deploy do site.
-- COMO DESFAZER: bloco "ROLLBACK" no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_protocolo text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_status    text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_detalhes  text;   -- uma linha por cartão (\n)
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_obs       text;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_em        timestamptz;
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS respaldo_por       uuid;

-- ── Protege as colunas do respaldo: só a função abaixo grava ─────────────
-- (o parceiro tem UPDATE nas próprias linhas pelo RLS — sem isto ele poderia
--  editar o respaldo por fora da tela)
CREATE OR REPLACE FUNCTION boleto_protege_respaldo()
RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.boleto_respaldo_rpc', true), '') <> '1' THEN
    IF NEW.respaldo_protocolo IS DISTINCT FROM OLD.respaldo_protocolo
    OR NEW.respaldo_status    IS DISTINCT FROM OLD.respaldo_status
    OR NEW.respaldo_detalhes  IS DISTINCT FROM OLD.respaldo_detalhes
    OR NEW.respaldo_obs       IS DISTINCT FROM OLD.respaldo_obs
    OR NEW.respaldo_em        IS DISTINCT FROM OLD.respaldo_em
    OR NEW.respaldo_por       IS DISTINCT FROM OLD.respaldo_por THEN
      RAISE EXCEPTION 'BOLETO_RESPALDO_SOMENTE_RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quitacao_boletos_protege_respaldo ON quitacao_boletos;
CREATE TRIGGER quitacao_boletos_protege_respaldo
  BEFORE UPDATE ON quitacao_boletos
  FOR EACH ROW EXECUTE FUNCTION boleto_protege_respaldo();

-- ── Importa o respaldo de UM cliente (CPF) ──────────────────────────────
-- Retorna quantas propostas abertas receberam o respaldo (0 = nenhuma aberta).
-- O site chama uma vez por CPF, mostrando o progresso; falha de um não para os outros.
CREATE OR REPLACE FUNCTION boleto_importar_respaldo(
  p_cpf text, p_protocolo text, p_status text, p_detalhes text, p_obs text DEFAULT NULL
) RETURNS json AS $$
DECLARE
  v_cpf text := lpad(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), 11, '0');
  v_n   int;
BEGIN
  IF NOT is_admin_user() THEN RAISE EXCEPTION 'BOLETO_SOMENTE_ADMIN'; END IF;
  IF v_cpf !~ '^[0-9]{11}$' OR v_cpf = '00000000000' THEN RAISE EXCEPTION 'BOLETO_CPF_INVALIDO'; END IF;

  PERFORM set_config('app.boleto_respaldo_rpc', '1', true);
  UPDATE quitacao_boletos SET
    respaldo_protocolo = nullif(btrim(p_protocolo), ''),
    respaldo_status    = nullif(btrim(p_status), ''),
    respaldo_detalhes  = nullif(btrim(p_detalhes), ''),
    respaldo_obs       = nullif(btrim(p_obs), ''),
    respaldo_em        = now(),
    respaldo_por       = auth.uid()
  WHERE cpf = v_cpf
    AND status IN ('boleto_solicitado', 'boleto_enviado');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN json_build_object('ok', true, 'propostas', v_n);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION boleto_importar_respaldo(text, text, text, text, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (só se precisar desfazer — apaga o respaldo gravado):
--   DROP FUNCTION IF EXISTS boleto_importar_respaldo(text, text, text, text, text);
--   DROP TRIGGER  IF EXISTS quitacao_boletos_protege_respaldo ON quitacao_boletos;
--   DROP FUNCTION IF EXISTS boleto_protege_respaldo();
--   ALTER TABLE quitacao_boletos
--     DROP COLUMN IF EXISTS respaldo_protocolo, DROP COLUMN IF EXISTS respaldo_status,
--     DROP COLUMN IF EXISTS respaldo_detalhes,  DROP COLUMN IF EXISTS respaldo_obs,
--     DROP COLUMN IF EXISTS respaldo_em,        DROP COLUMN IF EXISTS respaldo_por;
-- ════════════════════════════════════════════════════════════════════════
