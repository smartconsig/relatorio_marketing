import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Single admin client — service role can do everything
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller JWT via admin client (no need for a separate anon client)
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(token);

    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Check permission
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('grupos_acesso(permissoes)')
      .eq('id', caller.id)
      .maybeSingle();

    const perms = (callerProfile as any)?.grupos_acesso?.permissoes || {};
    if (!perms.admin_usuarios) {
      return new Response(JSON.stringify({ error: 'Sem permissão para convidar usuários' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Read invite payload
    const body = await req.json().catch(() => ({}));
    const { email, nome, grupo_id } = body as { email: string; nome?: string; grupo_id?: string };

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'E-mail inválido' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Send invite — Supabase emails the user automatically
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: nome || '' },
    });

    if (inviteErr || !invited?.user) {
      console.error('inviteUserByEmail error:', inviteErr);
      const msg = (inviteErr?.message || '').toLowerCase();

      // Usuário já cadastrado — envia link de redefinição de senha no lugar
      if (msg.includes('already') || (inviteErr as any)?.status === 422) {
        // Busca o user_id pelo email para atualizar o perfil
        const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = existingList?.users?.find(u => u.email === email);

        if (existingUser) {
          // Atualiza grupo e nome no perfil existente
          await supabaseAdmin.from('profiles').upsert({
            id:       existingUser.id,
            nome:     nome     || null,
            email:    email,
            grupo_id: grupo_id || null,
            ativo:    true,
          });

          // Envia link de redefinição de senha
          await supabaseAdmin.auth.admin.generateLink({
            type:  'recovery',
            email,
          });
        }

        return new Response(JSON.stringify({
          success:  true,
          resent:   true,
          user_id:  existingUser?.id,
          email,
        }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: inviteErr?.message || 'Falha ao enviar convite' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Upsert profile with group and display name
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id:       invited.user.id,
        nome:     nome     || null,
        email:    email,
        grupo_id: grupo_id || null,
        ativo:    true,
      });

    return new Response(JSON.stringify({
      success: true,
      user_id: invited.user.id,
      email,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('invite-user error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
