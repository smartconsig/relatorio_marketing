-- ═══════════════════════════════════════════════════════════════════════
--  Resíduos v2 + Documentos na Quitação de Boleto
--  Execute no Supabase SQL Editor (uma vez), ANTES do deploy do frontend.
--  Pré-requisito: migration 011 já rodada (esta desmonta a v1, que nunca
--  foi usada — tabelas vazias).
--
--  Mudança de estrutura (decisão de 31/08/2026):
--    • Importação de lotes (boletos/faturas) passa a viver na QUITAÇÃO DE
--      BOLETO: documento casa com cliente em boleto_solicitado OU
--      boleto_enviado; quem estava SOLICITADO e recebe o 1º doc vira
--      BOLETO_ENVIADO automaticamente (trigger).
--    • Parceiro vê/baixa os documentos dos próprios clientes; admin tudo;
--      importar/excluir é só admin.
--    • Resíduos desconecta dos boletos e conecta na LIBERAÇÃO DE MARGEM:
--      todo cliente da liberação pode ir para resíduos (admin/perm).
--      Status: residuo_pendente → residuo_solicitado → residuo_pago.
--      Ao pagar: volta AUTOMATICAMENTE para a liberação com observação
--      "RESÍDUO PAGO em dd/mm/aaaa" e some da tela (fica como histórico).
--    • Resíduos vira lista de controle pura — SEM documentos.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 1 — Desmonta a v1 (tabelas vazias, nada a migrar)
-- ─────────────────────────────────────────────────────────────────────────

DROP TRIGGER  IF EXISTS residuo_docs_promove ON residuo_docs;
DROP FUNCTION IF EXISTS residuo_doc_promove();
DROP TABLE    IF EXISTS residuo_docs;

DROP TRIGGER  IF EXISTS residuos_solta_boleto ON residuos;
DROP FUNCTION IF EXISTS residuo_solta_boleto();
DROP TRIGGER  IF EXISTS residuos_protege_update ON residuos;
DROP TRIGGER  IF EXISTS residuos_touch ON residuos;
DROP TABLE    IF EXISTS residuos;

DROP FUNCTION IF EXISTS boleto_para_residuo(uuid);
DROP FUNCTION IF EXISTS residuo_marcar_pago(uuid, numeric);

-- Restaura o trigger de proteção do boleto à versão da 006 (sem em_residuo)
CREATE OR REPLACE FUNCTION boleto_protege_update()
RETURNS trigger AS $$
BEGIN
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

ALTER TABLE quitacao_boletos DROP COLUMN IF EXISTS em_residuo;

-- Storage da v1: remove as policies. O bucket residuos-docs (vazio) NÃO pode
-- ser apagado via SQL (o Supabase bloqueia DELETE direto em storage.buckets) —
-- se quiser removê-lo, use o painel: Storage → residuos-docs → Delete bucket.
DROP POLICY IF EXISTS "residuos_docs_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "residuos_docs_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "residuos_docs_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "residuos_docs_storage_delete" ON storage.objects;

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 2 — Documentos na Quitação de Boleto
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS boleto_docs (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  boleto_id        uuid        NOT NULL REFERENCES quitacao_boletos(id) ON DELETE CASCADE,
  cpf              text        NOT NULL,
  empresa_parceira text        NOT NULL,   -- desnormalizado p/ RLS simples
  tipo             text        NOT NULL CHECK (tipo IN ('boleto','fatura')),
  contrato         text,                   -- subpasta do ZIP de boletos
  storage_path     text        NOT NULL UNIQUE,
  nome_arquivo     text        NOT NULL,
  tamanho          bigint,
  uploaded_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Reimportar o mesmo lote não duplica
  CONSTRAINT boleto_docs_dedupe UNIQUE (boleto_id, tipo, nome_arquivo)
);

CREATE INDEX IF NOT EXISTS boleto_docs_boleto_idx ON boleto_docs (boleto_id);

-- Anexou documento em cliente BOLETO_SOLICITADO → vira BOLETO_ENVIADO
-- (importar É o envio; quem já estava enviado só recebe o anexo)
CREATE OR REPLACE FUNCTION boleto_doc_envia()
RETURNS trigger AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  PERFORM set_config('app.boleto_rpc', '1', true);
  UPDATE quitacao_boletos SET
    status       = 'boleto_enviado',
    data_enviado = v_hoje
  WHERE id = NEW.boleto_id AND status = 'boleto_solicitado';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS boleto_docs_envia ON boleto_docs;
CREATE TRIGGER boleto_docs_envia
  AFTER INSERT ON boleto_docs
  FOR EACH ROW EXECUTE FUNCTION boleto_doc_envia();

-- RLS: parceiro vê os docs dos próprios clientes; importar/excluir só admin
ALTER TABLE boleto_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boleto_docs_select" ON boleto_docs;
CREATE POLICY "boleto_docs_select" ON boleto_docs
  FOR SELECT TO authenticated
  USING (is_admin_user() OR empresa_parceira = empresa_do_usuario());

DROP POLICY IF EXISTS "boleto_docs_insert" ON boleto_docs;
CREATE POLICY "boleto_docs_insert" ON boleto_docs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "boleto_docs_delete" ON boleto_docs;
CREATE POLICY "boleto_docs_delete" ON boleto_docs
  FOR DELETE TO authenticated
  USING (is_admin_user());

-- Bucket privado dos PDFs da Quitação de Boleto
INSERT INTO storage.buckets (id, name, public)
VALUES ('boletos-docs', 'boletos-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Leitura: admin, ou parceiro dono do documento (via metadado)
DROP POLICY IF EXISTS "boletos_docs_storage_select" ON storage.objects;
CREATE POLICY "boletos_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'boletos-docs' AND (
      is_admin_user() OR EXISTS (
        SELECT 1 FROM boleto_docs d
        WHERE d.storage_path = storage.objects.name
          AND d.empresa_parceira = empresa_do_usuario()
      )
    )
  );

DROP POLICY IF EXISTS "boletos_docs_storage_insert" ON storage.objects;
CREATE POLICY "boletos_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'boletos-docs' AND is_admin_user());

DROP POLICY IF EXISTS "boletos_docs_storage_update" ON storage.objects;
CREATE POLICY "boletos_docs_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'boletos-docs' AND is_admin_user())
  WITH CHECK (bucket_id = 'boletos-docs' AND is_admin_user());

DROP POLICY IF EXISTS "boletos_docs_storage_delete" ON storage.objects;
CREATE POLICY "boletos_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'boletos-docs' AND is_admin_user());

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 3 — Resíduos v2 (conectado à Liberação de Margem Master)
-- ─────────────────────────────────────────────────────────────────────────

-- Marca na liberação: linha some da tela enquanto true
ALTER TABLE liberacao_margem_master ADD COLUMN IF NOT EXISTS em_residuo boolean NOT NULL DEFAULT false;

-- liberacao_id é text (id::text) de propósito: a tabela liberacao_margem_master
-- foi criada pelo painel e o tipo do id não é versionado — text funciona para
-- uuid ou numérico, e a consistência é garantida pelas funções abaixo.
CREATE TABLE residuos (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  liberacao_id     text        NOT NULL,
  cpf              text        NOT NULL,
  nome             text        NOT NULL,
  convenio         text,
  produto          text,
  empresa_parceira text,
  saldo_devedor    numeric     DEFAULT 0,
  troco            numeric     DEFAULT 0,
  obs              text,
  status           text        NOT NULL DEFAULT 'residuo_pendente',
  valor_pago       numeric,
  data_pendente    date,
  data_solicitado  date,
  data_pago        date,
  criado_por       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT residuos_status_chk CHECK (status IN (
    'residuo_pendente','residuo_solicitado','residuo_pago'
  )),
  CONSTRAINT residuos_cpf_chk CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE INDEX IF NOT EXISTS residuos_cpf_idx    ON residuos (cpf);
CREATE INDEX IF NOT EXISTS residuos_status_idx ON residuos (status, created_at DESC);
-- A mesma linha da liberação só pode ter UM resíduo em aberto por vez
-- (depois de pago, pode voltar num novo ciclo)
CREATE UNIQUE INDEX IF NOT EXISTS residuos_liberacao_aberto_uniq
  ON residuos (liberacao_id) WHERE status <> 'residuo_pago';

DROP TRIGGER IF EXISTS residuos_touch ON residuos;
CREATE TRIGGER residuos_touch
  BEFORE UPDATE ON residuos
  FOR EACH ROW EXECUTE FUNCTION boleto_touch_updated_at();

-- Status/datas só mudam por RPC
CREATE OR REPLACE FUNCTION residuo_protege_update()
RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.residuo_rpc', true), '') <> '1' THEN
    IF NEW.status          IS DISTINCT FROM OLD.status
    OR NEW.valor_pago      IS DISTINCT FROM OLD.valor_pago
    OR NEW.data_pendente   IS DISTINCT FROM OLD.data_pendente
    OR NEW.data_solicitado IS DISTINCT FROM OLD.data_solicitado
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

-- Entrada: Liberação de Margem → Resíduos (transacional: cria + esconde)
CREATE OR REPLACE FUNCTION liberacao_para_residuo(p_liberacao_id text)
RETURNS json AS $$
DECLARE
  l      liberacao_margem_master%ROWTYPE;
  v_id   uuid;
  v_cpf  text;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT (is_admin_user() OR tem_permissao('residuos_editar')) THEN
    RAISE EXCEPTION 'RESIDUO_SEM_PERMISSAO';
  END IF;

  SELECT * INTO l FROM liberacao_margem_master WHERE id::text = p_liberacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESIDUO_LIBERACAO_NAO_ENCONTRADA';
  END IF;

  IF coalesce(l.em_residuo, false) THEN
    RAISE EXCEPTION 'RESIDUO_JA_EXISTE';
  END IF;

  v_cpf := lpad(regexp_replace(coalesce(l.cpf, ''), '\D', '', 'g'), 11, '0');
  IF v_cpf !~ '^[0-9]{11}$' OR v_cpf = '00000000000' THEN
    RAISE EXCEPTION 'RESIDUO_CPF_INVALIDO';
  END IF;

  INSERT INTO residuos (liberacao_id, cpf, nome, convenio, produto,
                        empresa_parceira, saldo_devedor, troco, obs,
                        status, data_pendente, criado_por)
  VALUES (l.id::text, v_cpf, l.nome, l.convenio, l.produto,
          l.empresa_parceira, l.saldo_devedor, l.troco, l.obs,
          'residuo_pendente', v_hoje, auth.uid())
  RETURNING id INTO v_id;

  UPDATE liberacao_margem_master SET em_residuo = true WHERE id = l.id;

  RETURN json_build_object('ok', true, 'residuo_id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transições: pendente → solicitado → pago
-- Ao pagar: devolve a linha à Liberação com a observação e encerra o resíduo.
-- Se a linha da liberação tiver sido apagada nesse meio-tempo, o resíduo é
-- pago mesmo assim (aviso no retorno) — nada trava.
CREATE OR REPLACE FUNCTION residuo_mudar_status(p_id uuid, p_novo text, p_valor numeric DEFAULT NULL)
RETURNS json AS $$
DECLARE
  r         residuos%ROWTYPE;
  v_hoje    date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_voltou  boolean := false;
BEGIN
  IF NOT (is_admin_user() OR tem_permissao('residuos_editar')) THEN
    RAISE EXCEPTION 'RESIDUO_SEM_PERMISSAO';
  END IF;

  SELECT * INTO r FROM residuos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESIDUO_NAO_ENCONTRADO';
  END IF;

  IF (p_novo = 'residuo_solicitado' AND r.status <> 'residuo_pendente')
  OR (p_novo = 'residuo_pago'       AND r.status <> 'residuo_solicitado')
  OR (p_novo NOT IN ('residuo_solicitado','residuo_pago')) THEN
    RAISE EXCEPTION 'RESIDUO_TRANSICAO_INVALIDA';
  END IF;

  PERFORM set_config('app.residuo_rpc', '1', true);

  IF p_novo = 'residuo_solicitado' THEN
    UPDATE residuos SET status = 'residuo_solicitado', data_solicitado = v_hoje
    WHERE id = p_id;
  ELSE
    UPDATE residuos SET
      status     = 'residuo_pago',
      data_pago  = v_hoje,
      valor_pago = COALESCE(p_valor, valor_pago)
    WHERE id = p_id;

    -- Volta automática para a Liberação de Margem, com observação
    UPDATE liberacao_margem_master SET
      em_residuo = false,
      obs = btrim(coalesce(nullif(btrim(coalesce(obs, '')), '') || ' · ', '')
            || 'RESÍDUO PAGO em ' || to_char(v_hoje, 'DD/MM/YYYY'))
    WHERE id::text = r.liberacao_id;
    v_voltou := FOUND;
  END IF;

  RETURN json_build_object('ok', true, 'status', p_novo, 'voltou_liberacao', v_voltou);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Excluiu o resíduo (admin) → linha reaparece na Liberação, sem observação
CREATE OR REPLACE FUNCTION residuo_solta_liberacao()
RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'residuo_pago' THEN
    UPDATE liberacao_margem_master SET em_residuo = false
    WHERE id::text = OLD.liberacao_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS residuos_solta_liberacao ON residuos;
CREATE TRIGGER residuos_solta_liberacao
  AFTER DELETE ON residuos
  FOR EACH ROW EXECUTE FUNCTION residuo_solta_liberacao();

-- RLS: tela interna (admin ou permissões residuos_*)
ALTER TABLE residuos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "residuos_select" ON residuos;
CREATE POLICY "residuos_select" ON residuos
  FOR SELECT TO authenticated
  USING (is_admin_user() OR tem_permissao('residuos_visualizar'));

-- INSERT/UPDATE de status: só pelas funções acima (SECURITY DEFINER)

DROP POLICY IF EXISTS "residuos_update" ON residuos;
CREATE POLICY "residuos_update" ON residuos
  FOR UPDATE TO authenticated
  USING (is_admin_user() OR tem_permissao('residuos_editar'))
  WITH CHECK (is_admin_user() OR tem_permissao('residuos_editar'));

DROP POLICY IF EXISTS "residuos_delete" ON residuos;
CREATE POLICY "residuos_delete" ON residuos
  FOR DELETE TO authenticated
  USING (is_admin_user());
