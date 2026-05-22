-- ═══════════════════════════════════════════════════════════════════════
--  Quitações — Criar tabela e inserir dados iniciais
--  Execute no Supabase SQL Editor (uma vez)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS quitacoes_clientes (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome         text        NOT NULL,
  cpf          text,
  telefone     text,
  endereco     text,
  bairro       text,
  cidade       text,
  uf           text,
  cep          text,
  rg           text,
  doc_pdf      text,          -- base64 do documento (PDF ou imagem)
  doc_nome     text,
  quitacao     jsonb       DEFAULT '{}',
  profissional jsonb       DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

-- RLS: somente usuários autenticados
ALTER TABLE quitacoes_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON quitacoes_clientes;
CREATE POLICY "auth_all" ON quitacoes_clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Seed: WILTON BORGES VIANA ─────────────────────────────────────────────
INSERT INTO quitacoes_clientes (id, nome, cpf, telefone, endereco, cidade, uf, cep, quitacao, profissional)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'WILTON BORGES VIANA',
  '058.075.168-69',
  '',
  'Rua Raymundo Magrini',
  'Ferraz de Vasconcelos',
  'SP',
  '08544-300',
  '{
    "banco": "Banco Pine S/A",
    "contrato": "857102",
    "val_boleto": 5876.12,
    "data_boleto": "2026-04-09",
    "val_ted": 10725.08,
    "data_ted": "2026-04-09",
    "devolvida": true,
    "val_devolucao": 10725.08,
    "data_devolucao": "2026-04-10",
    "pag_nome": "SMART CONSIG NEGOCIOS E INVESTIMENTOS LTDA",
    "pag_cnpj": "37.044.794/0001-03",
    "destino_nome": "Banco Pine S/A",
    "destino_cnpj": "62.144.175/0001-20",
    "destino_banco": "643 - Banco Pine S/A",
    "destino_agencia": "0001-9",
    "destino_conta": "900.026-9",
    "txid": "E1A2B3C4D51779132501904E6F7GHIJK",
    "data_hora_tx": "09 ABR 2026 - 14:32:17"
  }',
  '{
    "cargo": "Policial Penal IV",
    "categoria": "Titular de Cargo Efetivo",
    "unidade": "Centro de Detenção Provisória de Suzano",
    "banco_sal": "Banco do Brasil",
    "agencia": "0097 — Presidente Prudente",
    "conta": "71921-8"
  }'
)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: SILVIO FIGUEIRA DE ALMEIDA ─────────────────────────────────────
INSERT INTO quitacoes_clientes (id, nome, cpf, telefone, endereco, bairro, cidade, uf, cep, rg, quitacao, profissional)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  'SILVIO FIGUEIRA DE ALMEIDA',
  '125.376.888-99',
  '',
  'Rua Cristiano Lobe, 213 Apt 32B',
  'Cidade Tiradentes',
  'São Paulo',
  'SP',
  '08475-340',
  '21.973.887-7',
  '{
    "banco": "BMG",
    "contrato": "",
    "val_boleto": 0,
    "data_boleto": "",
    "val_ted": 18908.45,
    "data_ted": "2026-05-11",
    "devolvida": false,
    "val_devolucao": 0,
    "data_devolucao": "",
    "pag_nome": "SMART CONSIG NEGOCIOS E INVESTIMENTOS LTDA",
    "pag_cnpj": "37.044.794/0001-03",
    "destino_nome": "BMG",
    "destino_cnpj": "62.144.175/0001-20",
    "destino_banco": "318 - BANCO BMG S/A",
    "destino_agencia": "0001-9",
    "destino_conta": "900.026-9",
    "txid": "E9VHOGF6X1779132501904Y27AJUQR",
    "data_hora_tx": "11 MAI 2026 - 18:01:07",
    "origem_nome": "Eagle Sociedade de Crédito Direto S.A.",
    "origem_cnpj": "45.745.537/0001-19",
    "origem_agencia": "0001",
    "origem_conta": "67113"
  }',
  '{
    "cargo": "ASP Classe II / Policial Penal Nível II",
    "categoria": "Aposentadoria",
    "unidade": "Sec. de Administração Penitenciária",
    "banco_sal": "Banco do Brasil",
    "agencia": "4319",
    "conta": "000009703"
  }'
)
ON CONFLICT (id) DO NOTHING;
