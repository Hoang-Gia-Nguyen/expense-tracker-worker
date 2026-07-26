import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
import { z } from 'zod';
import { NewExpenseInputSchema, UpdateExpenseInputSchema, DeleteExpenseInputSchema } from '../sharedTypes';

const bigExpensesRouter = Router();

// Helper to parse and validate JSON body
const parseJsonBody = async (request, schema) => {
    try {
        const body = await request.json();
        return schema.parse(body);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new AppError('Invalid JSON format', 400);
        }
        if (error.issues) {
            throw new AppError(`Validation Error: ${error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join(', ')}`, 400);
        }
        throw error;
    }
};

// GET /api/big-expenses?year=2025 — list with yearly total
bigExpensesRouter.get('/api/big-expenses', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const url = new URL(request.url);
        const year = url.searchParams.get('year');

        if (!year) {
            throw new AppError('Missing required query parameter: year', 400);
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            "SELECT rowid, Date AS date, Amount AS amount, Description AS description, Category AS category FROM big_expense WHERE strftime('%Y', Date) = ? ORDER BY Date DESC"
        );
        const { results } = await stmt.bind(year).all();

        const total = results.reduce((sum, r) => sum + r.amount, 0);

        return new Response(JSON.stringify({ items: results, total }), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// POST /api/big-expenses — add new
bigExpensesRouter.post('/api/big-expenses', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const body = await parseJsonBody(request, NewExpenseInputSchema);
        const { date, amount, description, category } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'INSERT INTO big_expense (Date, Amount, Description, Category) VALUES (?, ?, ?, ?)'
        );
        await stmt.bind(date, amount, description, category).run();

        return new Response('Big expense added successfully', { status: 201, headers });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// PUT /api/big-expenses — update
bigExpensesRouter.put('/api/big-expenses', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const body = await parseJsonBody(request, UpdateExpenseInputSchema);
        const { id, date, amount, description, category } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'UPDATE big_expense SET Date = ?, Amount = ?, Description = ?, Category = ? WHERE rowid = ?'
        );
        const result = await stmt.bind(date, amount, description, category, id).run();

        if (result.meta.changes > 0) {
            return new Response('Big expense updated successfully', { status: 200, headers });
        } else {
            throw new AppError('Big expense not found or update failed', 404);
        }
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// DELETE /api/big-expenses — delete
bigExpensesRouter.delete('/api/big-expenses', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const body = await parseJsonBody(request, DeleteExpenseInputSchema);
        const { id } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare("DELETE FROM big_expense WHERE rowid = ?");
        const result = await stmt.bind(id).run();

        if (result.meta.changes > 0) {
            return new Response('Big expense deleted successfully', { status: 200, headers });
        } else {
            throw new AppError('Big expense not found or delete failed', 404);
        }
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Catch-all
bigExpensesRouter.all('*', (request) => {
    return new Response('Big Expenses API endpoint not found', { status: 404, headers: getCorsHeaders(request) });
});

export { bigExpensesRouter };
