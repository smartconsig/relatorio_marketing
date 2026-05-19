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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verifica JWT do caller
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(token);

    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Verifica permissão de admin
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('grupos_acesso(permissoes)')
      .eq('id', caller.id)
      .maybeSingle();

    const perms = (callerProfile as any)?.grupos_acesso?.permissoes || {};
    if (!perms.admin_usuarios) {
      return new Response(JSON.stringify({ error: 'Sem permissão para excluir usuários' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { user_id } = body as { user_id: string };

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Impede que o admin exclua a si mesmo
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'Você não pode excluir sua própria conta.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Exclui o usuário do auth — o profile é removido em cascata (ON DELETE CASCADE)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteErr) {
      console.error('deleteUser error:', deleteErr);
      return new Response(JSON.stringify({ error: deleteErr.message || 'Falha ao excluir usuário' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('delete-user error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
