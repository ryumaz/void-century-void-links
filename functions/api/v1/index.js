// Void Links public API: overview at /api/v1
export function onRequestGet({ request }) {
  const base = new URL(request.url).origin + '/api/v1';
  return new Response(JSON.stringify({
    name: 'Void Links API',
    version: 1,
    auth: 'Authorization: Bearer <your API key> (Dashboard → Settings → API keys)',
    endpoints: {
      'GET    /links': `${base}/links  (your links; ?limit=&offset=)`,
      'POST   /links': '{ url, alias?, password?, starts_at?, expires_at?, max_clicks? }',
      'GET    /links/:slug': 'one link with 30-day clicks, top countries and devices',
      'PATCH  /links/:slug': '{ url?, status?: active | paused | revoked }',
      'DELETE /links/:slug': 'delete a link',
    },
    limits: '600 requests per key per hour; 200 new links per account per hour',
  }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
}
