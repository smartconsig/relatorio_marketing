-- ═══════════════════════════════════════════════════════════════════════
--  Quitação de Boleto — acompanhamento das fases do boleto por parceiro
--  Execute no Supabase SQL Editor (uma vez)
--
--  Fluxo de status:
--    solicitar_boleto → boleto_solicitado → boleto_enviado ─┬→ boleto_quitado   (final)
--                                                           └→ boleto_reprovado (final, motivo obrigatório)
--
--  Regras garantidas AQUI no banco (a tela é só conveniência):
--    • Parceiro só enxerga/edita registros da própria empresa (RLS)
--    • CPF de outra empresa não pode ser cadastrado (trigger, à prova de corrida)
--    • CPF já presente na Liberação de Margem não pode ser cadastrado (trigger)
--    • Excluir é só admin (RLS)
--    • Status só muda pela função boleto_mudar_status (trigger bloqueia UPDATE direto)
--    • solicitado/enviado: só admin · quitado/reprovado: admin ou dono da proposta
--    • Reprovação exige motivo · quitado/reprovado só a partir de boleto_enviado
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helper: empresa (nome do grupo) do usuário logado ────────────────────
CREATE OR REPLACE FUNCTION empresa_do_usuario()
RETURNS text AS $$
  SELECT g.nome
  FROM profiles p
  JOIN grupos_acesso g ON p.grupo_id = g.id
  WHERE p.id = auth.uid() AND p.ativo = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Tabela ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quitacao_boletos (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf               text        NOT NULL,                 -- sempre 11 dígitos normalizados
  nome              text        NOT NULL,
  email             text,
  contrato          text,
  valor_parcela     numeric     DEFAULT 0,
  saldo_devedor     numeric     NOT NULL DEFAULT 0,
  troco             numeric     NOT NULL DEFAULT 0,
  convenio          text        NOT NULL,
  produto           text        NOT NULL,
  obs               text,
  empresa_parceira  text        NOT NULL,
  status            text        NOT NULL DEFAULT 'solicitar_boleto',
  motivo_reprovacao text,
  data_solicitado   date,
  data_enviado      date,
  data_quitado      date,
  data_reprovado    date,
  criado_por        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quitacao_boletos_status_chk CHECK (status IN (
    'solicitar_boleto','boleto_solicitado','boleto_enviado','boleto_quitado','boleto_reprovado'
  )),
  CONSTRAINT quitacao_boletos_cpf_chk CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE INDEX IF NOT EXISTS quitacao_boletos_cpf_idx     ON quitacao_boletos (cpf);
CREATE INDEX IF NOT EXISTS quitacao_boletos_empresa_idx ON quitacao_boletos (empresa_parceira, status);
CREATE INDEX IF NOT EXISTS quitacao_boletos_status_idx  ON quitacao_boletos (status, created_at DESC);

-- ── updated_at automático ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION boleto_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quitacao_boletos_touch ON quitacao_boletos;
CREATE TRIGGER quitacao_boletos_touch
  BEFORE UPDATE ON quitacao_boletos
  FOR EACH ROW EXECUTE FUNCTION boleto_touch_updated_at();

-- ── Normalização de produto p/ comparação (maiúsculas, sem acento/espaços extras)
CREATE OR REPLACE FUNCTION boleto_norm_produto(p text)
RETURNS text AS $$
  SELECT upper(btrim(regexp_replace(
    translate(coalesce(p, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '\s+', ' ', 'g')));
$$ LANGUAGE sql IMMUTABLE;

-- ── INSERT: normaliza CPF, força status inicial e bloqueia CPF de terceiros ─
-- SECURITY DEFINER: precisa enxergar registros de TODAS as empresas (e da
-- Liberação de Margem) para validar, mesmo quando quem insere é parceiro.
CREATE OR REPLACE FUNCTION boleto_valida_insert()
RETURNS trigger AS $$
DECLARE
  v_dona text;
BEGIN
  -- Normaliza o CPF: só dígitos, 11 posições
  NEW.cpf := lpad(regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g'), 11, '0');
  IF NEW.cpf !~ '^[0-9]{11}$' OR NEW.cpf = '00000000000' THEN
    RAISE EXCEPTION 'BOLETO_CPF_INVALIDO';
  END IF;

  -- Todo registro nasce na fase inicial, sem histórico de fases
  NEW.status            := 'solicitar_boleto';
  NEW.motivo_reprovacao := NULL;
  NEW.data_solicitado   := NULL;
  NEW.data_enviado      := NULL;
  NEW.data_quitado      := NULL;
  NEW.data_reprovado    := NULL;
  NEW.criado_por        := auth.uid();

  -- Lock por CPF: duas importações simultâneas do mesmo CPF entram em fila
  PERFORM pg_advisory_xact_lock(hashtext('quitacao_boletos_cpf_' || NEW.cpf));

  -- A regra é por CPF + PRODUTO: o mesmo CPF no mesmo produto não entra,
  -- seja da própria empresa (duplicidade) ou de outra (proposta concorrente).
  -- Produto diferente pode, inclusive entre empresas diferentes.
  SELECT empresa_parceira INTO v_dona
  FROM quitacao_boletos
  WHERE cpf = NEW.cpf
    AND boleto_norm_produto(produto) = boleto_norm_produto(NEW.produto)
  LIMIT 1;
  IF FOUND THEN
    IF v_dona <> NEW.empresa_parceira THEN
      IF is_admin_user() THEN
        RAISE EXCEPTION 'BOLETO_CPF_OUTRA_EMPRESA:%', v_dona;
      ELSE
        RAISE EXCEPTION 'BOLETO_CPF_OUTRA_EMPRESA';
      END IF;
    ELSE
      RAISE EXCEPTION 'BOLETO_CPF_MESMO_PRODUTO';
    END IF;
  END IF;

  -- CPF já presente na Liberação de Margem → recusa para todos
  PERFORM 1 FROM liberacao_margem_master
  WHERE lpad(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), 11, '0') = NEW.cpf
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'BOLETO_CPF_JA_LIBERACAO';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS quitacao_boletos_valida_insert ON quitacao_boletos;
CREATE TRIGGER quitacao_boletos_valida_insert
  BEFORE INSERT ON quitacao_boletos
  FOR EACH ROW EXECUTE FUNCTION boleto_valida_insert();

-- ── UPDATE: protege status/datas/motivo contra alteração direta ──────────
-- Só a função boleto_mudar_status (que seta app.boleto_rpc) pode mexer
-- nesses campos. Edição de dados cadastrais continua livre (via RLS),
-- exceto em registro finalizado, que só admin edita.
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

    -- Normaliza CPF também em edição
    NEW.cpf := lpad(regexp_replace(coalesce(NEW.cpf, ''), '\D', '', 'g'), 11, '0');
    IF NEW.cpf !~ '^[0-9]{11}$' OR NEW.cpf = '00000000000' THEN
      RAISE EXCEPTION 'BOLETO_CPF_INVALIDO';
    END IF;

    -- Edição não pode criar duplicidade CPF+produto (própria ou de outra empresa)
    IF NEW.cpf IS DISTINCT FROM OLD.cpf OR boleto_norm_produto(NEW.produto) IS DISTINCT FROM boleto_norm_produto(OLD.produto) THEN
      PERFORM 1 FROM quitacao_boletos
      WHERE cpf = NEW.cpf
        AND boleto_norm_produto(produto) = boleto_norm_produto(NEW.produto)
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

DROP TRIGGER IF EXISTS quitacao_boletos_protege_update ON quitacao_boletos;
CREATE TRIGGER quitacao_boletos_protege_update
  BEFORE UPDATE ON quitacao_boletos
  FOR EACH ROW EXECUTE FUNCTION boleto_protege_update();

-- ── Mudança de status: única porta de entrada ────────────────────────────
CREATE OR REPLACE FUNCTION boleto_mudar_status(p_id uuid, p_novo text, p_motivo text DEFAULT NULL)
RETURNS json AS $$
DECLARE
  r        quitacao_boletos%ROWTYPE;
  v_admin  boolean;
  v_empresa text;
  v_hoje   date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO r FROM quitacao_boletos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOLETO_NAO_ENCONTRADO';
  END IF;

  v_admin   := is_admin_user();
  v_empresa := empresa_do_usuario();

  -- SECURITY DEFINER enxerga tudo: reforça aqui que parceiro só age no que é dele
  IF NOT v_admin AND (v_empresa IS NULL OR r.empresa_parceira <> v_empresa) THEN
    RAISE EXCEPTION 'BOLETO_SEM_PERMISSAO';
  END IF;

  -- Quem pode o quê
  IF p_novo IN ('boleto_solicitado','boleto_enviado') THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION 'BOLETO_SOMENTE_ADMIN';
    END IF;
  ELSIF p_novo NOT IN ('boleto_quitado','boleto_reprovado') THEN
    RAISE EXCEPTION 'BOLETO_STATUS_INVALIDO';
  END IF;

  -- Transições permitidas
  IF (p_novo = 'boleto_solicitado' AND r.status <> 'solicitar_boleto')
  OR (p_novo = 'boleto_enviado'    AND r.status <> 'boleto_solicitado')
  OR (p_novo IN ('boleto_quitado','boleto_reprovado') AND r.status <> 'boleto_enviado') THEN
    RAISE EXCEPTION 'BOLETO_TRANSICAO_INVALIDA';
  END IF;

  -- Reprovação exige motivo
  IF p_novo = 'boleto_reprovado' AND (p_motivo IS NULL OR btrim(p_motivo) = '') THEN
    RAISE EXCEPTION 'BOLETO_MOTIVO_OBRIGATORIO';
  END IF;

  -- Libera a alteração de status para o trigger de proteção (só nesta transação)
  PERFORM set_config('app.boleto_rpc', '1', true);

  UPDATE quitacao_boletos SET
    status            = p_novo,
    data_solicitado   = CASE WHEN p_novo = 'boleto_solicitado' THEN v_hoje ELSE data_solicitado END,
    data_enviado      = CASE WHEN p_novo = 'boleto_enviado'    THEN v_hoje ELSE data_enviado    END,
    data_quitado      = CASE WHEN p_novo = 'boleto_quitado'    THEN v_hoje ELSE data_quitado    END,
    data_reprovado    = CASE WHEN p_novo = 'boleto_reprovado'  THEN v_hoje ELSE data_reprovado  END,
    motivo_reprovacao = CASE WHEN p_novo = 'boleto_reprovado'  THEN btrim(p_motivo) ELSE motivo_reprovacao END
  WHERE id = p_id;

  RETURN json_build_object('ok', true, 'status', p_novo);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE quitacao_boletos ENABLE ROW LEVEL SECURITY;

-- Parceiro só enxerga a própria empresa; admin vê tudo
DROP POLICY IF EXISTS "boletos_select" ON quitacao_boletos;
CREATE POLICY "boletos_select" ON quitacao_boletos
  FOR SELECT TO authenticated
  USING (is_admin_user() OR empresa_parceira = empresa_do_usuario());

-- Insere apenas na própria empresa (admin em qualquer uma)
DROP POLICY IF EXISTS "boletos_insert" ON quitacao_boletos;
CREATE POLICY "boletos_insert" ON quitacao_boletos
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user() OR empresa_parceira = empresa_do_usuario());

-- Edita apenas a própria empresa (admin qualquer uma); campos de status
-- ficam protegidos pelo trigger boleto_protege_update
DROP POLICY IF EXISTS "boletos_update" ON quitacao_boletos;
CREATE POLICY "boletos_update" ON quitacao_boletos
  FOR UPDATE TO authenticated
  USING (is_admin_user() OR empresa_parceira = empresa_do_usuario())
  WITH CHECK (is_admin_user() OR empresa_parceira = empresa_do_usuario());

-- Excluir é só admin
DROP POLICY IF EXISTS "boletos_delete" ON quitacao_boletos;
CREATE POLICY "boletos_delete" ON quitacao_boletos
  FOR DELETE TO authenticated
  USING (is_admin_user());
