import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the KV asset handler before importing the worker
vi.mock('@cloudflare/kv-asset-handler', () => ({
  getAssetFromKV: vi.fn(),
}));

import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import worker from './index';

describe('static asset handling', () => {
  beforeEach(() => {
    getAssetFromKV.mockReset();
  });
  it('serves static assets via getAssetFromKV', async () => {
    const mockResponse = new Response('asset', { status: 200 });
    getAssetFromKV.mockResolvedValueOnce(mockResponse);

    const request = new Request('http://localhost/expense/index.html', { method: 'GET' });
    const env = {
      __STATIC_CONTENT: {},
      __STATIC_CONTENT_MANIFEST: {},
      waitUntil: vi.fn(),
    };
    const context = { waitUntil: vi.fn() };

    const response = await worker.fetch(request, env, context);

    expect(response).toBe(mockResponse);
    expect(getAssetFromKV).toHaveBeenCalledTimes(1);
    const call = getAssetFromKV.mock.calls[0];
    expect(call[0].request).toBe(request);
    expect(call[0].waitUntil).toBe(context.waitUntil);
  });

  it('ignores /api/expense routes when serving assets', async () => {
    const request = new Request('http://localhost/api/expense?year=2023&month=01');
    const env = {
      __STATIC_CONTENT: {},
      __STATIC_CONTENT_MANIFEST: {},
      waitUntil: vi.fn(),
      D1_DATABASE: {
        prepare: vi.fn(() => ({
          bind: () => ({ all: vi.fn().mockResolvedValue({ results: [] }) })
        }))
      },
    };

    await worker.fetch(request, env);

    // getAssetFromKV should not be called for API routes
    expect(getAssetFromKV).not.toHaveBeenCalled();
  });

  it('ignores /api/summary routes when serving assets', async () => {
    const request = new Request('http://localhost/api/summary?year=2023&month=01');
    const env = {
      __STATIC_CONTENT: {},
      __STATIC_CONTENT_MANIFEST: {},
      waitUntil: vi.fn(),
      D1_DATABASE: {
        prepare: vi.fn(() => ({
          bind: () => ({ all: vi.fn().mockResolvedValue({ results: [] }) })
        }))
      },
    };

    await worker.fetch(request, env);

    expect(getAssetFromKV).not.toHaveBeenCalled();
  });

  it('redirects root requests to /expense', async () => {
    const request = new Request('http://localhost/', { method: 'GET' });
    const env = {
      __STATIC_CONTENT: {},
      __STATIC_CONTENT_MANIFEST: {},
      waitUntil: vi.fn(),
    };

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('http://localhost/expense');
    expect(getAssetFromKV).not.toHaveBeenCalled();
  });

  it('rewrites top-level routes to their index.html', async () => {
    const mockResponse = new Response('asset', { status: 200 });
    getAssetFromKV.mockResolvedValueOnce(mockResponse);

    const request = new Request('http://localhost/summary', { method: 'GET' });
    const env = {
      __STATIC_CONTENT: {},
      __STATIC_CONTENT_MANIFEST: {},
      waitUntil: vi.fn(),
    };
    const context = { waitUntil: vi.fn() };

    const response = await worker.fetch(request, env, context);

    expect(response).toBe(mockResponse);
    expect(getAssetFromKV).toHaveBeenCalledTimes(1);
    const calledRequest = getAssetFromKV.mock.calls[0][0].request;
    expect(calledRequest.url).toBe('http://localhost/summary/index.html');
  });
});
