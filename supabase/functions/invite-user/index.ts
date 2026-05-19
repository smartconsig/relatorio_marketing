import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Verifica autenticação do usuário que está fazendo o convite
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Cliente com service role — pode criar usuários
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Cliente do usuário logado — para verificar se é admin
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verifica se quem está convidando é admin
    const { data: { user: caller }, error: callerErr } = await supabaseUser.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

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

    // Lê os dados do convite
    const body = await req.json().catch(() => ({}));
    const { email, nome, grupo_id } = body as { email: string; nome?: string; grupo_id?: string };

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'E-mail inválido' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Verifica se o email já está cadastrado
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const alreadyExists = existingUsers?.users?.some(u => u.email === email);
    if (alreadyExists) {
      return new Response(JSON.stringify({ error: 'Este e-mail já está cadastrado no sistema' }), {
        status: 409, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Envia o convite — Supabase manda o email automaticamente
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: nome || '' },
    });

    if (inviteErr || !invited?.user) {
      console.error('inviteUserByEmail error:', inviteErr);
      return new Response(JSON.stringify({ error: inviteErr?.message || 'Falha ao enviar convite' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Atualiza o profile com nome e grupo
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
