-- ── Universidade Smart — Provas, Questões & Certificados ─────────────────

-- Prova vinculada a um curso (1:1)
create table if not exists uni_provas (
  id               uuid default gen_random_uuid() primary key,
  curso_id         uuid references uni_cursos(id) on delete cascade unique,
  nota_minima      int  default 70,
  max_tentativas   int  default 3,
  dias_para_retry  int  default 7,
  tem_certificado  boolean default true,
  criado_em        timestamptz default now()
);

-- Questões da prova (múltipla escolha)
create table if not exists uni_questoes (
  id           uuid default gen_random_uuid() primary key,
  prova_id     uuid references uni_provas(id) on delete cascade,
  enunciado    text not null,
  alternativas jsonb not null default '["","","",""]',
  correta      int  not null default 0,   -- índice da alternativa correta (0–3)
  ordem        int  not null default 1
);

-- Tentativas de prova dos colaboradores
create table if not exists uni_tentativas (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  prova_id   uuid references uni_provas(id) on delete cascade,
  nota       int  not null,
  aprovado   boolean not null,
  respostas  jsonb default '[]',
  criado_em  timestamptz default now()
);

-- Certificados emitidos
create table if not exists uni_certificados (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  curso_id   uuid references uni_cursos(id) on delete cascade,
  codigo     text unique default encode(gen_random_bytes(12), 'hex'),
  emitido_em timestamptz default now(),
  unique(user_id, curso_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table uni_provas       enable row level security;
alter table uni_questoes     enable row level security;
alter table uni_tentativas   enable row level security;
alter table uni_certificados enable row level security;

-- Provas e questões: leitura para todos, escrita só admin
create policy "uni_provas_read"    on uni_provas    for select to authenticated using (true);
create policy "uni_provas_admin"   on uni_provas    for all    using ((select is_admin_user()));
create policy "uni_questoes_read"  on uni_questoes  for select to authenticated using (true);
create policy "uni_questoes_admin" on uni_questoes  for all    using ((select is_admin_user()));

-- Tentativas: usuário vê as próprias, admin vê tudo
create policy "uni_tentativas_user"   on uni_tentativas for select to authenticated using (auth.uid() = user_id or (select is_admin_user()));
create policy "uni_tentativas_insert" on uni_tentativas for insert to authenticated with check (auth.uid() = user_id);

-- Certificados: usuário vê o próprio, admin vê tudo e pode inserir para qualquer um
create policy "uni_certificados_user"   on uni_certificados for select to authenticated using (auth.uid() = user_id or (select is_admin_user()));
create policy "uni_certificados_insert" on uni_certificados for insert to authenticated with check (auth.uid() = user_id or (select is_admin_user()));
