import { Router } from 'itty-router';
import { corsMiddleware } from './src/middleware/cors';
import { errorHandlerMiddleware } from './src/middleware/errorHandler';
import { cloudflareAccessMiddleware } from './src/middleware/cloudflareAccess';

// Import route handlers
import { expensesRouter } from './src/routes/expenses';
import { summaryRouter } from './src/routes/summary';
import { insightsRouter } from './src/routes/insights';
import { configRouter } from './src/routes/api/config'; // Import config router
import { bigExpensesRouter } from './src/routes/bigExpenses'; // Import big expenses router
import { goldPriceRouter } from './src/routes/goldPrice'; // Import gold price router
import { investmentsRouter } from './src/routes/investments'; // Import investments router

const router = Router();

// CORS preflight is handled first. Every other request requires a valid Access assertion.
router.all('*', corsMiddleware);
router.all('*', cloudflareAccessMiddleware);

// Root redirect
router.get('/', (request) => {
  return Response.redirect(`${new URL(request.url).origin}/expense`, 302);
});

// Rewrite top-level routes to their index documents through the Static Assets binding.
const staticRoutes = [ '/investments','/expense', '/summary', '/insights', '/big-expenses'];
staticRoutes.forEach(path => {
  router.all(path, async (request, env, context) => {
    const url = new URL(request.url);
    url.pathname = `${path}/index.html`;
    return serveAsset(new Request(url, request), request, env, context);
  });
});

async function serveAsset(assetRequest, originalRequest, env, context) {
  if (!env.ASSETS) {
    return errorHandlerMiddleware(new Error('Static Assets binding is not configured'), originalRequest, env, context);
  }
  return env.ASSETS.fetch(assetRequest);
}

// Mount API routers
router.all('/api/expense', expensesRouter.fetch);
router.all('/api/summary*', summaryRouter.fetch);
router.all('/api/insights', insightsRouter.fetch);
router.all('/api/investments*', investmentsRouter.fetch);
router.all('/api/gold-price', goldPriceRouter.fetch);
router.all('/api/config', configRouter.fetch); // Mount config router
router.all('/api/expenses/category', expensesRouter.fetch);
router.all('/api/big-expenses*', bigExpensesRouter.fetch); // Mount big expenses router

// Fallback to 404
router.all('*', (request, env, context) => {
  if (!new URL(request.url).pathname.startsWith('/api/')) {
    return serveAsset(request, request, env, context);
  }
  return errorHandlerMiddleware(new Error('Not Found'), request, env, context);
});

export default {
  fetch: router.fetch,
};
