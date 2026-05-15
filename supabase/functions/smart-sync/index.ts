import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const FEIJUCA_URL    = 'https://feijuca-auth-api.victoriousocean-22a8a528.brazilsouth.azurecontainerapps.io/api/v1/users/login';
const SMART_URL      = 'https://smartconsig-fgts-live.victoriousocean-22a8a528.brazilsouth.azurecontainerapps.io/api/v1/simulations';
const TENANT         = 'smartconsig';
const ALL_PRODUCTS   = ['Clt', 'Inss', 'PublicServant'];
const DEFAULT_PAGE_SIZE = 60;
const MAX_PAGE_SIZE     = 60; // limite de segurança

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getToken(username: string, password: string): Promise<string> {
  const res = await fetch(FEIJUCA_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Tenant': TENANT },
    body:    JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Feijuca login failed: ${res.status}`);
  const data = await res.json();
  if (!data.accessToken) throw new Error('No accessToken in response');
  return data.accessToken;
}

async function fetchProduct(token: string, product: string, dateIni: string | null, dateEnd: string | null, pageSize: number) {
  const url = new URL(SMART_URL);
  url.searchParams.set('pageFilter.Page',     '1');
  url.searchParams.set('PageFilter.PageSize', String(pageSize));
  url.searchParams.set('Product',             product);
  if (dateIni) url.searchParams.set('DateIni', dateIni);
  if (dateEnd) url.searchParams.set('DateEnd', dateEnd);

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}`, 'Tenant': TENANT },
  });
  if (!res.ok) return [];

  const data = await res.json();
  return data.results || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Aceita GET (query params) ou POST (body JSON)
    let dateIni: string | null = null;
    let dateEnd: string | null = null;

    let products: string[] = ALL_PRODUCTS;
    let pageSize: number   = DEFAULT_PAGE_SIZE;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      dateIni  = body.date_start ?? null;
      dateEnd  = body.date_end   ?? null;
      if (Array.isArray(body.products) && body.products.length > 0) {
        products = body.products.filter((p: string) => ALL_PRODUCTS.includes(p));
      }
      if (body.page_size && Number.isInteger(body.page_size)) {
        pageSize = Math.min(Math.max(body.page_size, 1), MAX_PAGE_SIZE);
      }
    } else {
      const params = new URL(req.url).searchParams;
      dateIni  = params.get('date_start');
      dateEnd  = params.get('date_end');
      const p  = params.get('products');
      if (p) products = p.split(',').map(s => s.trim()).filter(s => ALL_PRODUCTS.includes(s));
      const ps = params.get('page_size');
      if (ps) pageSize = Math.min(Math.max(parseInt(ps, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    }

    const username = Deno.env.get('SMART_USERNAME');
    const password = Deno.env.get('SMART_PASSWORD');
    if (!username || !password) throw new Error('Missing SMART_USERNAME or SMART_PASSWORD secrets');

    // 1. Autenticar na Feijuca
    const token = await getToken(username, password);

    // 2. Buscar os produtos selecionados em paralelo
    const results = await Promise.all(
      products.map(p => fetchProduct(token, p, dateIni, dateEnd, pageSize))
    );
    const all = results.flat() as Record<string, unknown>[];

    // 3. Formatar para o frontend
    const leads = all.map((r) => {
      const customer = (r.customer || {}) as Record<string, unknown>;
      const mkt      = (customer.marketingDetails || {}) as Record<string, unknown>;
      const operator = (r.operator || {}) as Record<string, unknown>;
      const team     = (operator.teamDetails || {}) as Record<string, unknown>;

      return {
        id:         r.id         ?? null,
        date:       r.date       ?? null,
        cpf:        customer.cpf    ?? null,
        phone:      customer.phone  ?? null,   // campo a ser adicionado pelo Dev
        name:       customer.name   ?? '',
        source:     mkt.source      ?? '',
        audience:   mkt.audience    ?? '',
        stage:      r.stageName     ?? '',
        operator:   operator.name   ?? '',
        operatorId: operator.id     ?? null,
        team:       team.teamName   ?? null,
      };
    });

    return new Response(JSON.stringify({ leads, total: leads.length }), {
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
