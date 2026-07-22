-- ═══════════════════════════════════════════════════════════════════════
--  Esteira de Conteúdo — anexos de imagem (artes para aprovação)
--  Execute no Supabase SQL Editor (uma vez), depois do 002_conteudo.sql
-- ═══════════════════════════════════════════════════════════════════════

-- ── Bucket privado (leitura só por URL assinada) ─────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('conteudo-anexos', 'conteudo-anexos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "conteudo_anexos_auth" ON storage.objects;
CREATE POLICY "conteudo_anexos_auth" ON storage.objects
  FOR ALL TO authenticated
  USING      (bucket_id = 'conteudo-anexos')
  WITH CHECK (bucket_id = 'conteudo-anexos');

-- ── Metadados dos anexos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conteudo_anexos (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id    uuid        NOT NULL REFERENCES conteudo_cards(id) ON DELETE CASCADE,
  path       text        NOT NULL,   -- caminho dentro do bucket
  nome       text        NOT NULL,   -- nome original do arquivo
  mime       text,
  tamanho    integer,
  autor_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conteudo_anexos_card_idx
  ON conteudo_anexos (card_id, created_at);

ALTER TABLE conteudo_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON conteudo_anexos;
CREATE POLICY "auth_all" ON conteudo_anexos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Permite registrar "anexou arquivo" na linha do tempo ─────────────────
ALTER TABLE conteudo_eventos DROP CONSTRAINT IF EXISTS conteudo_eventos_tipo_chk;
ALTER TABLE conteudo_eventos ADD CONSTRAINT conteudo_eventos_tipo_chk CHECK (tipo IN (
  'criado','movido','comentario','aprovado','reprovado','editado','arquivado','anexo'
));
