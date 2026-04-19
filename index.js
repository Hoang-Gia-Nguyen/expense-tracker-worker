import { Router } from 'itty-router';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler'; // Still using for now, will refactor later
import { corsMiddleware } from '../middleware/cors';
import { errorHandlerMiddleware } from '../middleware/errorHandler';

// Import route handlers
import { expensesRouter } from './routes/expenses';
import { summaryRouter } from './routes/summary';
import { insightsRouter } from './routes/insights'; // Assuming this will be a new route

const router = Router();

// Apply middleware globally
router.all('*', corsMiddleware); // Apply CORS middleware to all requests

// Serve static assets
// This part needs to be refactored to use Wrangler's native assets
router.get('*', async (request, env, context) => {
    const url = new URL(request.url);

    // Skip asset handling for API routes
    if (url.pathname.startsWith('/api/')) {
        return undefined; // Let other routers handle API requests
    }

    // Redirect root to /expense
    if (url.pathname === '/') {
        return Response.redirect(`${url.origin}/expense`, 302);
    }

    // Handle route-specific index.html for SPA-like behavior
    let assetRequest = request;
    const spaRoutes = ['/expense', '/summary', '/insights'];
    if (spaRoutes.includes(url.pathname)) {
        const newUrl = new URL(url);
        newUrl.pathname = `${url.pathname}/index.html`;
        assetRequest = new Request(newUrl.toString(), request);
    }

    try {
        // Use getAssetFromKV for now, will be replaced by Wrangler native assets
        return await getAssetFromKV(
            {
                request: assetRequest,
                waitUntil: context?.waitUntil || env.waitUntil,
            },
            {
                ASSET_NAMESPACE: env.__STATIC_CONTENT,
                ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
            }
        );
    } catch (e) {
        // If the asset is not found, fall through to the 404 handler
        return undefined;
    }
});

// Mount API routers
router.use('/api/expense', expensesRouter.handle);
router.use('/api/summary', summaryRouter.handle);
router.use('/api/insights', insightsRouter.handle); // Mount new insights router

// Catch-all for 404s
router.all('*', (request) => {
    // Use errorHandlerMiddleware for 404s to ensure consistent response format
    return errorHandlerMiddleware(new Error('Not Found'), request, router.env, { waitUntil: router.waitUntil });
});

export default {
    fetch: router.handle,
    // The fetch method is now the main entry point for the worker
};
