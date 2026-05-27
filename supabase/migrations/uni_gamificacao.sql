-- ── Universidade Smart — Gamificação ──────────────────────────────────────

-- Conquistas / Badges
create table if not exists uni_conquistas (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  icone text default 'star',
  condicao_tipo text not null,  -- 'cursos_concluidos' | 'cursos_mes' | 'nota_maxima' | 'xp_total' | 'livros_lidos' | 'primeira_aula'
  condicao_valor int default 1,
  xp_bonus int default 0,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- Prêmios vinculados a marcos de XP
create table if not exists uni_premios (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  xp_necessario int not null,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- Configuração de XP por tipo de ação (editável pelo admin)
create table if not exists uni_config_xp (
  acao text primary key,
  xp int not null default 0,
  descricao text
);

-- Configuração de níveis de progressão
create table if not exists uni_niveis_config (
  id serial primary key,
  nome text not null,
  xp_min int not null,
  xp_max int,  -- null = sem limite (último nível)
  ordem int not null
);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table uni_conquistas   enable row level security;
alter table uni_premios      enable row level security;
alter table uni_config_xp    enable row level security;
alter table uni_niveis_config enable row level security;

-- Leitura: qualquer usuário autenticado
create policy "uni_conquistas_read"    on uni_conquistas    for select to authenticated using (true);
create policy "uni_premios_read"       on uni_premios       for select to authenticated using (true);
create policy "uni_config_xp_read"    on uni_config_xp     for select to authenticated using (true);
create policy "uni_niveis_read"        on uni_niveis_config for select to authenticated using (true);

-- Escrita: apenas admin
create policy "uni_conquistas_admin"  on uni_conquistas    for all using ((select is_admin_user()));
create policy "uni_premios_admin"     on uni_premios       for all using ((select is_admin_user()));
create policy "uni_config_xp_admin"   on uni_config_xp     for all using ((select is_admin_user()));
create policy "uni_niveis_admin"      on uni_niveis_config for all using ((select is_admin_user()));

-- ── Dados iniciais ─────────────────────────────────────────────────────────
insert into uni_config_xp (acao, xp, descricao) values
  ('aula_concluida',           10,  'Concluir uma aula'),
  ('curso_concluido',         100,  'Concluir um curso completo'),
  ('prova_primeira_tentativa', 50,  'Passar na prova na 1ª tentativa'),
  ('prova_nota_maxima',        30,  'Nota máxima na prova (100%)'),
  ('livro_lido',               25,  'Ler um livro da biblioteca'),
  ('primeiro_curso_mes',       20,  'Primeiro curso concluído do mês')
on conflict (acao) do nothing;

insert into uni_niveis_config (nome, xp_min, xp_max, ordem) values
  ('Iniciante',    0,    499,  1),
  ('Aprendiz',     500,  1499, 2),
  ('Desenvolvido', 1500, 3499, 3),
  ('Especialista', 3500, 6999, 4),
  ('Mestre Smart', 7000, null, 5)
on conflict do nothing;
