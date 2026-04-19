import { Router } from 'itty-router';
import { getCorsHeaders } from '../../middleware/cors';
import { errorHandlerMiddleware } from '../../middleware/errorHandler';
import { CORS_ALLOWED_ORIGINS } from '../../config';

const summaryRouter = Router();

const getHeaders = (request) => {
    const origin = request.headers.get('Origin');
    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
    }
    return { 'Access-Control-Allow-Origin': 'null' };
};

// Handle GET requests for summary
summaryRouter.get('/api/summary', async (request, env, context) => {
    const headers = getHeaders(request);
    try {
        const url = new URL(request.url);
        const year = url.searchParams.get('year');
        const month = url.searchParams.get('month');

        if (!year || !month) {
            return new Response('Missing required query parameters: year, month', { status: 400, headers });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'SELECT category, spend_vnd FROM v_monthly_category_spend WHERE year_month = ?'
        );
        const { results } = await stmt.bind(`${year}-${month.padStart(2, '0')}`).all();

        return new Response(JSON.stringify(results), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Catch-all for routes within this router that are not handled
summaryRouter.all('*', (request) => {
    return new Response('Summary API endpoint not found', { status: 404, headers: getHeaders(request) });
});

export { summaryRouter };
