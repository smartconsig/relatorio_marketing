-- ═══════════════════════════════════════════════════════════════════════
--  Resíduos — clientes da Quitação de Boleto que têm resíduo a pagar
--  Execute no Supabase SQL Editor (uma vez), ANTES do deploy do frontend.
--
--  Fluxo de status:
--    residuo_solicitado → residuo_anexado (automático ao anexar o 1º doc)
--                       → residuo_pago    (clique manual, via RPC)
--
--  Regras garantidas AQUI no banco (a tela é só conveniência):
--    • Tela interna: só admin ou grupos com residuos_visualizar/residuos_editar
--    • Cliente entra vindo da Quitação de Boleto (fases solicitado/enviado)
--      APENAS pela função boleto_para_residuo — transacional: cria o resíduo
--      e marca em_residuo no boleto num passo só
--    • O registro do boleto CONTINUA na tela de boletos, com a marca em_residuo
--    • Status do resíduo só muda por RPC/trigger (UPDATE direto é bloqueado)
--    • Documentos: arquivos vivem no bucket privado residuos-docs (Storage);
--      a tabela residuo_docs guarda apenas metadados e o caminho
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helper: usuário logado tem uma permissão do grupo? ───────────────────
CREATE OR REPLACE FUNCTION tem_permissao(p_chave text)
RETURNS boolean AS $$
  SELECT COALESCE((
    SELECT (g.permissoes->>p_chave)::boolean
    FROM profiles p
    JOIN grupos_acesso g ON p.grupo_id = g.id
    WHERE p.id = auth.uid() AND p.ativo = true
  ), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Marca "em resíduo" no boleto de origem ───────────────────────────────
ALTER TABLE quitacao_boletos ADD COLUMN IF NOT EXISTS em_residuo boolean NOT NULL DEFAULT false;

-- ── Tabela principal ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS residuos (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  boleto_id        uuid        REFERENCES quitacao_boletos(id) ON DELETE SET NULL,
  cpf              text        NOT NULL,               -- sempre 11 dígitos normalizados
  nome             text        NOT NULL,
  contrato         text,
  convenio         text,
  produto          text,
  empresa_parceira text,
  saldo_devedor    numeric     DEFAULT 0,
  obs              text,
  status           text        NOT NULL DEFAULT 'residuo_solicitado',
  valor_pago       numeric,
  data_solicitado  date,
  data_anexado     date,
  data_pago        date,
  criado_por       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT residuos_status_chk CHECK (status IN (
    'residuo_solicitado','residuo_anexado','residuo_pago'
  )),
  CONSTRAINT residuos_cpf_chk CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE INDEX IF NOT EXISTS residuos_cpf_idx    ON residuos (cpf);
CREATE INDEX IF NOT EXISTS residuos_status_idx ON residuos (status, created_at DESC);
-- Um resíduo por registro de boleto (o mesmo cliente pode voltar por OUTRO boleto)
CREATE UNIQUE INDEX IF NOT EXISTS residuos_boleto_uniq ON residuos (boleto_id) WHERE boleto_id IS NOT NULL;

DROP TRIGGER IF EXISTS residuos_touch ON residuos;
CREATE TRIGGER residuos_touch
  BEFORE UPDATE ON residuos
  FOR EACH ROW EXECUTE FUNCTION boleto_touch_updated_at();

-- ── Documentos (metadados; o arquivo em si fica no Storage) ──────────────
CREATE TABLE IF NOT EXISTS residuo_docs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  residuo_id   uuid        NOT NULL REFERENCES residuos(id) ON DELETE CASCADE,
  cpf          text        NOT NULL,
  tipo         text        NOT NULL CHECK (tipo IN ('boleto','fatura')),
  contrato     text,                                   -- subpasta do ZIP de boletos
  storage_path text        NOT NULL UNIQUE,
  nome_arquivo text        NOT NULL,
  tamanho      bigint,
  uploaded_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- Reimportar o mesmo lote não duplica: mesmo arquivo p/ o mesmo resíduo é ignorado
  CONSTRAINT residuo_docs_dedupe UNIQUE (residuo_id, tipo, nome_arquivo)
);

CREATE INDEX IF NOT EXISTS residuo_docs_residuo_idx ON residuo_docs (residuo_id);

-- ── Proteção: status/datas do resíduo só mudam por RPC/trigger ───────────
CREATE OR REPLACE FUNCTION residuo_protege_update()
RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.residuo_rpc', true), '') <> '1' THEN
    IF NEW.status          IS DISTINCT FROM OLD.status
    OR NEW.valor_pago      IS DISTINCT FROM OLD.valor_pago
    OR NEW.data_solicitado IS DISTINCT FROM OLD.data_solicitado
    OR NEW.data_anexado    IS DISTINCT FROM OLD.data_anexado
    OR NEW.data_pago       IS DISTINCT FROM OLD.data_pago THEN
      RAISE EXCEPTION 'RESIDUO_STATUS_SOMENTE_RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS residuos_protege_update ON residuos;
CREATE TRIGGER residuos_protege_update
  BEFORE UPDATE ON residuos
  FOR EACH ROW EXECUTE FUNCTION residuo_protege_update();

-- ── Proteção extra no boleto: em_residuo só muda pelas funções daqui ─────
-- (recria a função da migration 006 acrescentando UMA verificação; o resto
--  é idêntico ao original)
CREATE OR REPLACE FUNCTION boleto_protege_update()
RETURNS trigger AS $$
BEGIN
  -- em_residuo é controlado exclusivamente pelas funções de resíduo
  IF coalesce(current_setting('app.residuo_rpc', true), '') <> '1'
  AND NEW.em_residuo IS DISTINCT FROM OLD.em_residuo THEN
    RAISE EXCEPTION 'RESIDUO_FLAG_SOMENTE_RPC';
  END IF;

  IF coalesce(current_setting('app.boleto_rpc', true), '') <> '1' THEN
    IF NEW.status            IS DISTINCT FROM OLD.status
    OR NEW.motivo_reprovacao IS DISTINCT FROM OLD.motivo_reprovacao
    OR NEW.data_solicitado   IS DISTINCT FROM OLD.data_solicitado
    OR NEW.data_enviado      IS DISTINCT FROM OLD.data_enviado
    OR NEW.data_quitado      IS DISTINCT FROM OLD.data_quitado
    OR NEW.data_reprovado    IS DISTINCT FROM OLD.data_reprovado THEN
      RAISE EXCEPTION 'BOLETO_STATUS_SOMENTE_RPC';
    END IF;

    IF OLD.status IN ('boleto_quitado','boleto_reprovado') AND NOT is_admin_user() THEN
      RAISE EXCEPTION 'BOLETO_REGISTRO_FINALIZADO';
    END IF;

    NEW.cpf := lpad(regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g'), 11, '0');
    IF NEW.cpf !~ '^[0-9]{11}$' OR NEW.cpf = '00000000000' THEN
      RAISE EXCEPTION 'BOLETO_CPF_INVALIDO';
    END IF;

    NEW.produto := boleto_canon_produto(NEW.produto);
    IF NEW.produto IS NULL THEN
      RAISE EXCEPTION 'BOLETO_PRODUTO_INVALIDO';
    END IF;

    IF NEW.cpf IS DISTINCT FROM OLD.cpf OR NEW.produto IS DISTINCT FROM boleto_canon_produto(OLD.produto) THEN
      PERFORM 1 FROM quitacao_boletos
      WHERE cpf = NEW.cpf
        AND boleto_canon_produto(produto) = NEW.produto
        AND id <> NEW.id
      LIMIT 1;
      IF FOUND THEN
        RAISE EXCEPTION 'BOLETO_CPF_MESMO_PRODUTO';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Entrada: boleto (solicitado/enviado) → resíduo ───────────────────────
CREATE OR REPLACE FUNCTION boleto_para_residuo(p_boleto_id uuid)
RETURNS json AS $$
DECLARE
  r      quitacao_boletos%ROWTYPE;
  v_id   uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT (is_admin_user() OR tem_permissao('residuos_editar')) THEN
    RAISE EXCEPTION 'RESIDUO_SEM_PERMISSAO';
  END IF;

  SELECT * INTO r FROM quitacao_boletos WHERE id = p_boleto_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESIDUO_BOLETO_NAO_ENCONTRADO';
  END IF;

  IF r.status NOT IN ('boleto_solicitado','boleto_enviado') THEN
    RAISE EXCEPTION 'RESIDUO_FASE_INVALIDA';
  END IF;

  IF r.em_residuo THEN
    RAISE EXCEPTION 'RESIDUO_JA_EXISTE';
  END IF;

  INSERT INTO residuos (boleto_id, cpf, nome, contrato, convenio, produto,
                        empresa_parceira, saldo_devedor, status, data_solicitado, criado_por)
  VALUES (r.id, r.cpf, r.nome, r.contrato, r.convenio, r.produto,
          r.empresa_parceira, r.saldo_devedor, 'residuo_solicitado', v_hoje, auth.uid())
  RETURNING id INTO v_id;

  PERFORM set_config('app.residuo_rpc', '1', true);
  UPDATE quitacao_boletos SET em_residuo = true WHERE id = p_boleto_id;

  RETURN json_build_object('ok', true, 'residuo_id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Pago: única transição manual ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION residuo_marcar_pago(p_id uuid, p_valor numeric DEFAULT NULL)
RETURNS json AS $$
DECLARE
  r      residuos%ROWTYPE;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT (is_admin_user() OR tem_permissao('residuos_editar')) THEN
    RAISE EXCEPTION 'RESIDUO_SEM_PERMISSAO';
  END IF;

  SELECT * INTO r FROM residuos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESIDUO_NAO_ENCONTRADO';
  END IF;

  IF r.status <> 'residuo_anexado' THEN
    RAISE EXCEPTION 'RESIDUO_TRANSICAO_INVALIDA';
  END IF;

  PERFORM set_config('app.residuo_rpc', '1', true);
  UPDATE residuos SET
    status     = 'residuo_pago',
    data_pago  = v_hoje,
    valor_pago = COALESCE(p_valor, valor_pago)
  WHERE id = p_id;

  RETURN json_build_object('ok', true, 'status', 'residuo_pago');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Anexou o 1º documento → residuo_anexado (automático) ─────────────────
CREATE OR REPLACE FUNCTION residuo_doc_promove()
RETURNS trigger AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  PERFORM set_config('app.residuo_rpc', '1', true);
  UPDATE residuos SET
    status       = 'residuo_anexado',
    data_anexado = v_hoje
  WHERE id = NEW.residuo_id AND status = 'residuo_solicitado';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS residuo_docs_promove ON residuo_docs;
CREATE TRIGGER residuo_docs_promove
  AFTER INSERT ON residuo_docs
  FOR EACH ROW EXECUTE FUNCTION residuo_doc_promove();

-- ── Excluiu o resíduo (admin) → boleto volta a ficar sem a marca ─────────
CREATE OR REPLACE FUNCTION residuo_solta_boleto()
RETURNS trigger AS $$
BEGIN
  IF OLD.boleto_id IS NOT NULL THEN
    PERFORM set_config('app.residuo_rpc', '1', true);
    UPDATE quitacao_boletos SET em_residuo = false WHERE id = OLD.boleto_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS residuos_solta_boleto ON residuos;
CREATE TRIGGER residuos_solta_boleto
  AFTER DELETE ON residuos
  FOR EACH ROW EXECUTE FUNCTION residuo_solta_boleto();

-- ── RLS: tela interna (admin ou permissões residuos_*) ───────────────────
ALTER TABLE residuos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE residuo_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "residuos_select" ON residuos;
CREATE POLICY "residuos_select" ON residuos
  FOR SELECT TO authenticated
  USING (is_admin_user() OR tem_permissao('residuos_visualizar'));

-- INSERT direto não existe: registro só nasce pela função boleto_para_residuo

DROP POLICY IF EXISTS "residuos_update" ON residuos;
CREATE POLICY "residuos_update" ON residuos
  FOR UPDATE TO authenticated
  USING (is_admin_user() OR tem_permissao('residuos_editar'))
  WITH CHECK (is_admin_user() OR tem_permissao('residuos_editar'));

DROP POLICY IF EXISTS "residuos_delete" ON residuos;
CREATE POLICY "residuos_delete" ON residuos
  FOR DELETE TO authenticated
  USING (is_admin_user());

DROP POLICY IF EXISTS "residuo_docs_select" ON residuo_docs;
CREATE POLICY "residuo_docs_select" ON residuo_docs
  FOR SELECT TO authenticated
  USING (is_admin_user() OR tem_permissao('residuos_visualizar'));

DROP POLICY IF EXISTS "residuo_docs_insert" ON residuo_docs;
CREATE POLICY "residuo_docs_insert" ON residuo_docs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user() OR tem_permissao('residuos_editar'));

DROP POLICY IF EXISTS "residuo_docs_delete" ON residuo_docs;
CREATE POLICY "residuo_docs_delete" ON residuo_docs
  FOR DELETE TO authenticated
  USING (is_admin_user() OR tem_permissao('residuos_editar'));

-- ── Storage: bucket privado p/ os PDFs (boletos e faturas) ───────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('residuos-docs', 'residuos-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "residuos_docs_storage_select" ON storage.objects;
CREATE POLICY "residuos_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'residuos-docs' AND (is_admin_user() OR tem_permissao('residuos_visualizar')));

DROP POLICY IF EXISTS "residuos_docs_storage_insert" ON storage.objects;
CREATE POLICY "residuos_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'residuos-docs' AND (is_admin_user() OR tem_permissao('residuos_editar')));

DROP POLICY IF EXISTS "residuos_docs_storage_update" ON storage.objects;
CREATE POLICY "residuos_docs_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'residuos-docs' AND (is_admin_user() OR tem_permissao('residuos_editar')))
  WITH CHECK (bucket_id = 'residuos-docs' AND (is_admin_user() OR tem_permissao('residuos_editar')));

DROP POLICY IF EXISTS "residuos_docs_storage_delete" ON storage.objects;
CREATE POLICY "residuos_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'residuos-docs' AND (is_admin_user() OR tem_permissao('residuos_editar')));
