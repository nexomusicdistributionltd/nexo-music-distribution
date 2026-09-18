import { RequireSuperAdmin } from '@/lib/auth/guards';
import { loadDistributionAccessToken } from '@/lib/provider/oauth/store';
import { readDistributionOAuthConfig } from '@/lib/provider/oauth/config';
import { responseShape } from '@/lib/provider/response-shape';

export const runtime = 'nodejs';
const groups = {
  analytics: ['/analytics/overview?period=lastThirtyDays', '/analytics/tracks?period=lastThirtyDays&page=1&perPage=1', '/analytics/platforms'],
  sales: ['/sales/overview?page=1&per_page=1', '/sales/tracks?page=1&per_page=1', '/sales/releases?page=1&per_page=1'],
  preferences: ['/preferences/artist', '/preferences/artists', '/preferences/label?page=1&perPage=1'],
  lookups: ['/lookup/countries', '/lookup/platforms', '/lookup/genres', '/lookup/languages'],
} as const;

export async function POST(request: Request) {
  // Downloads consume provider quota, so require an intentional same-origin POST.
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return new Response('Forbidden', { status: 403 });
  }
  await RequireSuperAdmin();
  const form = await request.formData();
  const group = form.get('group');
  if (typeof group !== 'string' || !Object.hasOwn(groups, group)) {
    return new Response('Unknown check', { status: 400 });
  }
  let token: string | null;
  let base: string;
  try {
    token = await loadDistributionAccessToken();
    base = readDistributionOAuthConfig().apiBaseUrl.replace(/\/$/, '');
  } catch {
    return Response.json({ error: 'Provider credentials could not be loaded. Check the server configuration.' }, { status: 503 });
  }
  if (!token) return Response.json({ error: 'Connect the provider first.' }, { status: 503 });
  if (!['https://api.toolost.com/v1', 'https://api-sandbox.toolost.com/v1'].includes(base)) {
    return Response.json({ error: 'Inspection requires the documented provider API host.' }, { status: 503 });
  }
  const results = [];
  for (const path of groups[group as keyof typeof groups]) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000),
      });
      const headers = Object.fromEntries(['x-api-plan', 'x-api-quota-limit', 'x-api-quota-used', 'x-api-quota-remaining', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'retry-after']
        .map(key => [key, response.headers.get(key)]));
      const body: unknown = await response.json().catch(() => null);
      results.push({ path, status: response.status, headers, shape: responseShape(body) });
      // Never retry or keep spending quota when upstream asks us to stop.
      if ([401, 403, 429].includes(response.status) || response.status >= 500 || headers['x-api-quota-remaining'] === '0' || headers['x-ratelimit-remaining'] === '0') break;
    } catch {
      results.push({ path, error: 'Request failed or timed out; no response shape available.' });
      break;
    }
  }
  return Response.json({
    generatedAt: new Date().toISOString(), group,
    note: 'Observed response types only. Values and undocumented field names omitted. Empty/null results do not establish a schema. This does not validate write endpoints or reporting freshness.',
    results,
  }, { headers: {
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="nexo-api-${group}-inspection.json"`,
    'X-Content-Type-Options': 'nosniff',
  } });
}
