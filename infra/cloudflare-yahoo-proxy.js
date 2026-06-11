// Proxy do Yahoo Finance em Cloudflare Worker (plano gratuito).
//
// Por que existe: o Yahoo bloqueia IPs de datacenter (Railway, AWS etc.).
// Este worker repassa apenas o endpoint de chart, com cache de 5 minutos
// na borda da Cloudflare — o que tambem reduz o trafego ate o Yahoo.
//
// Como publicar (sem instalar nada):
//   1. https://dash.cloudflare.com -> Workers & Pages -> Create -> Worker
//   2. De um nome (ex.: yahoo-proxy), Deploy, depois "Edit code"
//   3. Apague o conteudo, cole este arquivo inteiro, Save and deploy
//   4. Copie a URL (https://yahoo-proxy.SEUUSUARIO.workers.dev)
//   5. No Railway, adicione a variavel: YAHOO_PROXY_URL=<essa URL>

const ALLOWED_PREFIX = '/v8/finance/chart/';

const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return new Response('not found', { status: 404 });
    }

    const upstream = `https://query1.finance.yahoo.com${url.pathname}${url.search}`;
    const res = await fetch(upstream, {
      headers: UPSTREAM_HEADERS,
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    return new Response(res.body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        'cache-control': 'public, max-age=300',
        'access-control-allow-origin': '*',
      },
    });
  },
};
