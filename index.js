import { Router } from 'itty-router';
import { corsMiddleware } from './src/middleware/cors';
import { errorHandlerMiddleware } from './src/middleware/errorHandler';

// Import route handlers
import { expensesRouter } from './src/routes/expenses';
import { summaryRouter } from './src/routes/summary';
import { insightsRouter } from './src/routes/insights';
import { configRouter } from './src/routes/api/config'; // Import config router

const router = Router();

// Apply middleware globally
router.all('*', corsMiddleware);

// Root redirect
router.get('/', (request) => {
    return Response.redirect(`${new URL(request.url).origin}/expense`, 302);
});

// Rewrite top-level routes to index.html and serve
const staticRoutes = ['/expense', '/summary', '/insights'];
staticRoutes.forEach(path => {
    router.all(path, async (request, env, context) => {
        const url = new URL(request.url);
        url.pathname = `${path}/index.html`;
        const newRequest = new Request(url.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.body,
            redirect: request.redirect,
        });
        try {
            const { getAssetFromKV } = await import('@cloudflare/kv-asset-handler');
            return await getAssetFromKV({
                request: newRequest,
                waitUntil: context.waitUntil.bind(context),
            }, {
                ASSET_NAMESPACE: env.__STATIC_CONTENT,
                ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
            });
        } catch (e) {
            return errorHandlerMiddleware(e, request, env, context);
        }
    });
});

// Mount API routers
router.all('/api/expense', expensesRouter.handle);
router.all('/api/summary', summaryRouter.handle);
router.all('/api/insights', insightsRouter.handle);
router.all('/api/config', configRouter.handle); // Mount the config router

// Catch-all for assets and 404s
router.all('*', async (request, env, context) => {
    // If it's a rewritten request (Request object returned by previous handlers),
    // itty-router will continue. itty-router 4.x supports returning a Request.
    
    // Actually, itty-router doesn't automatically re-route if a Request is returned.
    // We need a way to serve assets.
    try {
        const { getAssetFromKV } = await import('@cloudflare/kv-asset-handler');
        return await getAssetFromKV({
            request,
            waitUntil: context.waitUntil.bind(context),
        }, {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
        });
    } catch (e) {
        // Fallback to 404
        return errorHandlerMiddleware(new Error('Not Found'), request, env, context);
    }
});

export default {
    fetch: router.handle,
};
