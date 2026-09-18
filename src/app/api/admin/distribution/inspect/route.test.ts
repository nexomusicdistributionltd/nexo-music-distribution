import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ guard: vi.fn(), token: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/auth/guards', () => ({ RequireSuperAdmin: mocks.guard }));
vi.mock('@/lib/provider/oauth/store', () => ({ loadDistributionAccessToken: mocks.token }));
vi.mock('@/lib/provider/oauth/config', () => ({ readDistributionOAuthConfig: () => ({ apiBaseUrl: 'https://api.toolost.com/v1' }) }));
import { POST } from './route';
function request(origin = 'https://nexomusicdistribution.com') {
  return new Request('https://nexomusicdistribution.com/api/admin/distribution/inspect', {
    method: 'POST', headers: { origin }, body: new URLSearchParams({ group: 'sales' }),
  });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch); mocks.guard.mockResolvedValue({}); mocks.token.mockResolvedValue('private-token'); });
describe('provider inspection access and quota', () => {
  it('blocks cross-origin requests before accessing credentials', async () => {
    expect((await POST(request('https://other.example'))).status).toBe(403);
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it('requires super admin before accessing credentials', async () => {
    mocks.guard.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(POST(request())).rejects.toThrow('Forbidden');
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it('stops at rate limits and excludes values from the downloaded report', async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ error: 'quota_exceeded', message: 'private-message' }, { status: 429, headers: { 'retry-after': '60' } }));
    const response = await POST(request());
    const body = await response.text();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(body).not.toContain('private-message');
    expect(body).not.toContain('private-token');
    expect(body).toContain('429');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
