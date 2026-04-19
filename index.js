import { Router } from 'itty-router';
import { corsMiddleware } from '../middleware/cors';
import { errorHandlerMiddleware } from '../middleware/errorHandler';

// Import route handlers
import { expensesRouter } from './routes/expenses';
import { summaryRouter } from './routes/summary';
import { insightsRouter } from './routes/insights';
import { configRouter } from './routes/api/config'; // Import config router

const router = Router();

// Apply middleware globally
router.all('*', corsMiddleware);

// Serve static assets using Wrangler's native asset handling
// The `assets` configuration in wrangler.jsonc handles this automatically.
// We only need to ensure API routes are handled by their respective routers.
router.all('/api/*', (request, env, context) => {
    // If the request starts with /api/, let the other routers handle it.
    // If no API router matches, it will fall through to the 404 handler.
    return undefined;
});

// Mount API routers
router.use('/api/expense', expensesRouter.handle);
router.use('/api/summary', summaryRouter.handle);
router.use('/api/insights', insightsRouter.handle);
router.use('/api/config', configRouter.handle); // Mount the config router

// Catch-all for 404s and unhandled routes
router.all('*', (request, env, context) => {
    // Use errorHandlerMiddleware for 404s to ensure consistent response format
    // Note: This 404 handler will catch requests that don't match any API routes
    // and are not handled by Wrangler's native asset serving.
    return errorHandlerMiddleware(new Error('Not Found'), request, env, context);
});

export default {
    fetch: router.handle,
};
