import { Router } from 'itty-router';
import { FRONTEND_CONFIG } from '../../config/frontendConfig';
import { errorHandlerMiddleware } from '../../middleware/errorHandler';
import { getCorsHeaders } from '../../middleware/cors';

const configRouter = Router();

// Handle GET requests for frontend configuration
configRouter.get('/api/config', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        return new Response(JSON.stringify(FRONTEND_CONFIG), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Catch-all for routes within this router that are not handled
configRouter.all('*', (request) => {
    return new Response('Config API endpoint not found', { status: 404, headers: getCorsHeaders(request) });
});

export { configRouter };
