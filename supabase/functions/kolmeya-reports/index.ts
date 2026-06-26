import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const KOLMEYA_URL = 'https://kolmeya.com.br/api/v1/sms/reports/quantity-jobs';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const token = Deno.env.get('KOLMEYA_TOKEN');
    if (!token) throw new Error('Missing KOLMEYA_TOKEN secret');

    const body = await req.json().catch(() => ({}));
    const period: string = body.period ?? '';
    if (!period) throw new Error('Missing required field: period (format: YYYY-MM)');

    const res = await fetch(KOLMEYA_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({ period }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Kolmeya API error ${res.status}: ${text}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status:  500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
