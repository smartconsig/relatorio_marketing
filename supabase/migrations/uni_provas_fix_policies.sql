-- ── Fix: recria policies de uni_provas sem erro de duplicata ─────────────
-- Execute este script se uni_provas.sql deu erro "policy already exists"

-- Remove policies existentes (sem erro se não existirem)
drop policy if exists "uni_provas_read"             on uni_provas;
drop policy if exists "uni_provas_admin"            on uni_provas;
drop policy if exists "uni_questoes_read"           on uni_questoes;
drop policy if exists "uni_questoes_admin"          on uni_questoes;
drop policy if exists "uni_tentativas_user"         on uni_tentativas;
drop policy if exists "uni_tentativas_insert"       on uni_tentativas;
drop policy if exists "uni_certificados_user"       on uni_certificados;
drop policy if exists "uni_certificados_insert"     on uni_certificados;

-- Recria com as definições corretas
create policy "uni_provas_read"    on uni_provas    for select to authenticated using (true);
create policy "uni_provas_admin"   on uni_provas    for all    using ((select is_admin_user()));
create policy "uni_questoes_read"  on uni_questoes  for select to authenticated using (true);
create policy "uni_questoes_admin" on uni_questoes  for all    using ((select is_admin_user()));

create policy "uni_tentativas_user"   on uni_tentativas for select to authenticated using (auth.uid() = user_id or (select is_admin_user()));
create policy "uni_tentativas_insert" on uni_tentativas for insert to authenticated with check (auth.uid() = user_id);

create policy "uni_certificados_user"   on uni_certificados for select to authenticated using (auth.uid() = user_id or (select is_admin_user()));
create policy "uni_certificados_insert" on uni_certificados for insert to authenticated with check (auth.uid() = user_id or (select is_admin_user()));
