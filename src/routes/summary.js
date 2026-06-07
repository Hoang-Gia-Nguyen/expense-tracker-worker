import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
import { SummarySchema } from '../sharedTypes';
import { z } from 'zod';

const summaryRouter = Router();

// Helper to parse and validate query parameters for GET requests
const parseQueryParams = (request, schema) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    try {
        return schema.parse(params);
    } catch (error) {
        if (error.issues) {
            throw new AppError(`Validation Error: ${error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join(', ')}`, 400);
        }
        throw error;
    }
};

// Handle GET requests for summary
summaryRouter.get('/api/summary', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        // Define a schema for query parameters
        const queryParamsSchema = z.object({
            year: z.string().regex(/^\d{4}$/, "Year must be a 4-digit number"),
            month: z.string().regex(/^\d{2}$/, "Month must be a 2-digit number"),
        });
        const { year, month } = parseQueryParams(request, queryParamsSchema);

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'SELECT category, spend_vnd FROM v_monthly_category_spend WHERE year_month = ?'
        );
        const { results } = await stmt.bind(`${year}-${month.padStart(2, '0')}`).all();

        // Validate the results against the expected API response schema
        SummarySchema.parse(results);

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
    return new Response('Summary API endpoint not found', { status: 404, headers: getCorsHeaders(request) });
});

export { summaryRouter };
