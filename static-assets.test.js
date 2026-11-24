import { describe, it, expect, vi } from 'vitest';
import worker from './index';

function createEnv(assetResponse = new Response('asset', { status: 200 })) {
  return {
    APP_ENV: 'development',
    ALLOW_UNAUTHENTICATED_LOCAL: 'true',
    ASSETS: { fetch: vi.fn(async () => assetResponse) },
  };
}

describe('Static Assets binding', () => {
  it('rewrites page routes to their index documents', async () => {
    const env = createEnv();
    const response = await worker.fetch(new Request('http://localhost/summary'), env);

    expect(response.status).toBe(200);
    const assetRequest = env.ASSETS.fetch.mock.calls[0][0];
    expect(new URL(assetRequest.url).pathname).toBe('/summary/index.html');
  });

  it('passes regular static asset requests through to ASSETS', async () => {
    const env = createEnv();
    await worker.fetch(new Request('http://localhost/styles.css'), env);

    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
    expect(new URL(env.ASSETS.fetch.mock.calls[0][0].url).pathname).toBe('/styles.css');
  });

  it('does not serve API requests from static assets', async () => {
    const env = createEnv();
    env.D1_DATABASE = {
      prepare: vi.fn(() => ({ bind: () => ({ all: vi.fn().mockResolvedValue({ results: [] }) }) })),
    };
    const response = await worker.fetch(new Request('http://localhost/api/expense?year=2023&month=01'), env);

    expect(response.status).toBe(200);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('redirects the root route to the expense page', async () => {
    const env = createEnv();
    const response = await worker.fetch(new Request('http://localhost/'), env);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('http://localhost/expense');
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('requires Cloudflare Access outside the explicitly enabled local environment', async () => {
    const env = { ASSETS: { fetch: vi.fn() } };
    const response = await worker.fetch(new Request('https://example.com/api/config'), env);

    expect(response.status).toBe(503);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });
});
