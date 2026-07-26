import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';

const goldPriceRouter = Router();

// PNJ gold price URL
const PNJ_PRICE_URL = 'https://webgia.com/gia-vang/pnj/';
const CACHE_TTL = 300; // 5 minutes

/**
 * Fetch and parse PNJ gold price from webgia.com.
 * Extracts the buy/sell price for PNJ gold in TPHCM region.
 */
async function fetchPnjGoldPrice() {
  const resp = await fetch(PNJ_PRICE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ExpenseTrackerWorker/1.0)',
      'Accept': 'text/html',
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch gold price: ${resp.status}`);
  }

  const html = await resp.text();

  // The table structure: <td>PNJ</td><td class="text-right">13.620.000</td><td class="text-right">14.120.000</td>
  // First occurrence is for TPHCM region — buy price then sell price
  const priceRegex = /<td>PNJ<\/td><td class="text-right">([\d.]+)<\/td><td class="text-right">([\d.]+)<\/td>/;
  const match = html.match(priceRegex);

  if (!match) {
    throw new Error('Could not parse PNJ gold price from page');
  }

  const buyRaw = match[1].replace(/\./g, '');
  const sellRaw = match[2].replace(/\./g, '');

  const buy = parseInt(buyRaw, 10);
  const sell = parseInt(sellRaw, 10);

  if (isNaN(buy) || isNaN(sell)) {
    throw new Error('Invalid price values parsed');
  }

  return {
    buy,
    sell,
    updatedAt: new Date().toISOString(),
    source: PNJ_PRICE_URL,
  };
}

// GET /api/gold-price
goldPriceRouter.get('/api/gold-price', async (request, env, context) => {
  const headers = getCorsHeaders(request);
  try {
    // Try cache first (Cloudflare cache API)
    const cacheUrl = new URL(request.url);
    // Only cache the default path, not cache-busting queries
    if (!cacheUrl.searchParams.has('_')) {
      const cache = caches.default;
      const cacheKey = new Request(`${cacheUrl.origin}/api/gold-price`, request);
      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const data = await fetchPnjGoldPrice();

    const response = new Response(JSON.stringify(data), {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
      },
      status: 200,
    });

    // Store in cache
    if (!cacheUrl.searchParams.has('_')) {
      const cache = caches.default;
      const cacheKey = new Request(`${cacheUrl.origin}/api/gold-price`, request);
      context.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  } catch (error) {
    return errorHandlerMiddleware(error, request, env, context);
  }
});

// Catch-all
goldPriceRouter.all('*', (request) => {
  return new Response('Gold Price API endpoint not found', {
    status: 404,
    headers: getCorsHeaders(request),
  });
});

export { goldPriceRouter };
