import { Router } from 'itty-router';
import { getCorsHeaders } from '../../middleware/cors'; // Adjust path as needed
import { errorHandlerMiddleware } from '../../middleware/errorHandler';
import { CORS_ALLOWED_ORIGINS } from '../../config'; // Assuming config will be created later

const expensesRouter = Router();

// Helper to get headers, unified with middleware
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

// Handle GET requests for expenses
expensesRouter.get('/api/expense', async (request, env, context) => {
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
            "SELECT rowid, Date, Amount, Description, Category FROM expense WHERE strftime('%Y', Date) = ? AND strftime('%m', Date) = ?"
        );
        const { results } = await stmt.bind(year, month.padStart(2, '0')).all();

        return new Response(JSON.stringify(results), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        // Use the centralized error handler
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Handle POST requests for new expenses
expensesRouter.post('/api/expense', async (request, env, context) => {
    const headers = getHeaders(request);
    try {
        const body = await request.json();
        const { date, amount, description, category } = body;

        if (!date || !amount || !description || !category) {
            return new Response('Missing required fields', { status: 400, headers });
        }
        // Ensure amount is a number before inserting
        const numericAmount = Number(amount);
        if (isNaN(numericAmount)) {
            return new Response('Amount must be a valid number', { status: 400, headers });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'INSERT INTO expense (Date, Amount, Description, Category) VALUES (?, ?, ?, ?)'
        );
        await stmt.bind(date, numericAmount, description, category).run();

        // Send data to Analytics Engine (using a placeholder binding)
        // In a real scenario, env.ANALYTICS_TEST would be correctly configured.
        // For now, we'll mock this or ensure it's handled if binding exists.
        if (env.ANALYTICS_TEST) {
             env.ANALYTICS_TEST.writeDataPoint({
                blobs: [description, category],
                doubles: [numericAmount],
                indexes: [Date.parse(date)],
            });
        } else {
            console.warn('ANALYTICS_TEST binding not found. Skipping writeDataPoint.');
        }

        return new Response('Expense added successfully', { status: 201, headers });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Handle PUT requests for updating expenses
expensesRouter.put('/api/expense', async (request, env, context) => {
    const headers = getHeaders(request);
    try {
        const body = await request.json();
        const { id, date, amount, description, category } = body;

        if (!id || !date || !amount || !description || !category) {
            return new Response('Missing required fields', { status: 400, headers });
        }
        // Ensure amount is a number before updating
        const numericAmount = Number(amount);
        if (isNaN(numericAmount)) {
            return new Response('Amount must be a valid number', { status: 400, headers });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'UPDATE expense SET Date = ?, Amount = ?, Description = ?, Category = ? WHERE rowid = ?'
        );
        const { success } = await stmt.bind(date, numericAmount, description, category, id).run();

        if (success) {
            return new Response('Expense updated successfully', { status: 200, headers });
        } else {
            return new Response('Expense not found or update failed', { status: 404, headers });
        }
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Handle DELETE requests for expenses
expensesRouter.delete('/api/expense', async (request, env, context) => {
    const headers = getHeaders(request);
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return new Response('Missing required field: id', { status: 400, headers });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare("DELETE FROM expense WHERE rowid = ?");
        const { success } = await stmt.bind(id).run();

        if (success) {
            return new Response('Expense deleted successfully', { status: 200, headers });
        } else {
            return new Response('Expense not found or delete failed', { status: 404, headers });
        }
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Catch-all for routes within this router that are not handled
expensesRouter.all('*', (request) => {
    // This should ideally be handled by the main router's 404, but good to have a fallback
    return new Response('Expense API endpoint not found', { status: 404, headers: getHeaders(request) });
});

export { expensesRouter };
