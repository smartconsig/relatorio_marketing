-- ============================================================
-- Smart RYC — Gestão de Usuários e Grupos de Acesso
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de grupos de acesso
CREATE TABLE IF NOT EXISTS grupos_acesso (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       text NOT NULL UNIQUE,
  permissoes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 2. Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome          text,
  email         text,
  grupo_id      uuid REFERENCES grupos_acesso(id) ON DELETE SET NULL,
  operador_nome text,
  ativo         boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- 3. Função helper: verifica se o usuário logado é admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean AS $$
  SELECT COALESCE((
    SELECT (g.permissoes->>'admin_usuarios')::boolean
    FROM profiles p
    JOIN grupos_acesso g ON p.grupo_id = g.id
    WHERE p.id = auth.uid() AND p.ativo = true
  ), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. RLS — grupos_acesso
ALTER TABLE grupos_acesso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupos_select_auth"
  ON grupos_acesso FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "grupos_admin_insert"
  ON grupos_acesso FOR INSERT
  TO authenticated WITH CHECK (is_admin_user());

CREATE POLICY "grupos_admin_update"
  ON grupos_acesso FOR UPDATE
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "grupos_admin_delete"
  ON grupos_acesso FOR DELETE
  TO authenticated USING (is_admin_user());

-- 5. RLS — profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own_select"
  ON profiles FOR SELECT
  TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles_admin_select"
  ON profiles FOR SELECT
  TO authenticated USING (is_admin_user());

CREATE POLICY "profiles_admin_insert"
  ON profiles FOR INSERT
  TO authenticated WITH CHECK (is_admin_user());

CREATE POLICY "profiles_admin_update"
  ON profiles FOR UPDATE
  TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- 6. Trigger: cria profile automaticamente quando novo usuário é criado
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, nome, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- 7. Seed: grupos iniciais
INSERT INTO grupos_acesso (nome, permissoes) VALUES
('Administrador', '{
  "importacao_fb03": true,
  "importacao_fb06": true,
  "importacao_ecorban": true,
  "importacao_smart": true,
  "importacao_processar": true,
  "visao_geral": true,
  "ranking": true,
  "gestao_procv_visualizar": true,
  "gestao_procv_confirmar": true,
  "gestao_procv_exportar": true,
  "gestao_revisao_visualizar": true,
  "gestao_revisao_classificar": true,
  "gestao_clientes": true,
  "propostas": true,
  "metas_visualizar": true,
  "metas_editar": true,
  "bsc": true,
  "admin_usuarios": true,
  "admin_grupos": true
}'),
('Gestor', '{
  "importacao_fb03": true,
  "importacao_fb06": true,
  "importacao_ecorban": true,
  "importacao_smart": true,
  "importacao_processar": true,
  "visao_geral": true,
  "ranking": true,
  "gestao_procv_visualizar": true,
  "gestao_procv_confirmar": true,
  "gestao_procv_exportar": true,
  "gestao_revisao_visualizar": true,
  "gestao_revisao_classificar": true,
  "gestao_clientes": true,
  "propostas": true,
  "metas_visualizar": true,
  "metas_editar": false,
  "bsc": true,
  "admin_usuarios": false,
  "admin_grupos": false
}'),
('Treinamento', '{
  "importacao_fb03": false,
  "importacao_fb06": false,
  "importacao_ecorban": false,
  "importacao_smart": false,
  "importacao_processar": false,
  "visao_geral": true,
  "ranking": true,
  "gestao_procv_visualizar": true,
  "gestao_procv_confirmar": false,
  "gestao_procv_exportar": false,
  "gestao_revisao_visualizar": true,
  "gestao_revisao_classificar": false,
  "gestao_clientes": true,
  "propostas": true,
  "metas_visualizar": true,
  "metas_editar": false,
  "bsc": true,
  "admin_usuarios": false,
  "admin_grupos": false
}'),
('Operador', '{
  "importacao_fb03": false,
  "importacao_fb06": false,
  "importacao_ecorban": false,
  "importacao_smart": false,
  "importacao_processar": false,
  "visao_geral": true,
  "ranking": true,
  "gestao_procv_visualizar": true,
  "gestao_procv_confirmar": false,
  "gestao_procv_exportar": false,
  "gestao_revisao_visualizar": false,
  "gestao_revisao_classificar": false,
  "gestao_clientes": false,
  "propostas": true,
  "metas_visualizar": true,
  "metas_editar": false,
  "bsc": true,
  "admin_usuarios": false,
  "admin_grupos": false
}')
ON CONFLICT (nome) DO NOTHING;

-- 8. Seed: profiles dos usuários existentes
-- Criar profiles para usuários já existentes (se ainda não tiverem)
INSERT INTO profiles (id, nome, email)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), email
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Para atribuir os grupos manualmente por email, use:
-- UPDATE profiles SET grupo_id = (SELECT id FROM grupos_acesso WHERE nome = 'Administrador')
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'gustavo@exemplo.com');
