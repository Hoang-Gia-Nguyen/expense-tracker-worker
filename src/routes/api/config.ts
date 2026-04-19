import { Router } from 'itty-router';
import { FRONTEND_CONFIG } from '../../config/frontendConfig';
import { errorHandlerMiddleware } from '../../middleware/errorHandler';
import { CORS_ALLOWED_ORIGINS } from '../../config';

const configRouter = Router();

const getHeaders = (request) => {
    const origin = request.headers.get('Origin');
    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
    }
    return { 'Access-Control-Allow-Origin': 'null' };
};

// Handle GET requests for frontend configuration
configRouter.get('/api/config', async (request, env, context) => {
    const headers = getHeaders(request);
    try {
        // The FRONTEND_CONFIG is already validated at import time.
        // We can directly return it.
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
    return new Response('Config API endpoint not found', { status: 404, headers: getHeaders(request) });
});

export { configRouter };
