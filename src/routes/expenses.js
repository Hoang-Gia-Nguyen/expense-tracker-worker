import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
import {
    NewExpenseInputSchema,
    UpdateExpenseInputSchema,
    DeleteExpenseInputSchema,
    GetExpensesResponseSchema,
    BatchCategoryUpdateSchema,
} from '../sharedTypes';

const expensesRouter = Router();

// Helper to parse and validate JSON body
const parseJsonBody = async (request, schema) => {
    try {
        const body = await request.json();
        return schema.parse(body);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new AppError('Invalid JSON format', 400);
        }
        if (error.issues) { // Zod validation error
            throw new AppError(`Validation Error: ${error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join(', ')}`, 400);
        }
        throw error;
    }
};

// Handle GET requests for expenses
expensesRouter.get('/api/expense', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const url = new URL(request.url);
        const year = url.searchParams.get('year');
        const month = url.searchParams.get('month');

        if (!year || !month) {
            throw new AppError('Missing required query parameters: year, month', 400);
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            "SELECT rowid, Date AS date, Amount AS amount, Description AS description, Category AS category FROM expense WHERE strftime('%Y', Date) = ? AND strftime('%m', Date) = ?"
        );
        const { results } = await stmt.bind(year, month.padStart(2, '0')).all();

        // Validate the results against the expected API response schema
        GetExpensesResponseSchema.parse(results);

        return new Response(JSON.stringify(results), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Handle POST requests for new expenses
expensesRouter.post('/api/expense', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const body = await parseJsonBody(request, NewExpenseInputSchema);
        const { date, amount, description, category } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'INSERT INTO expense (Date, Amount, Description, Category) VALUES (?, ?, ?, ?)'
        );
        await stmt.bind(date, amount, description, category).run();

        // Enhanced observability: Log more details to Analytics Engine
        if (env.ANALYTICS_TEST) {
             env.ANALYTICS_TEST.writeDataPoint({
                blobs: [description, category, "expense_created"],
                doubles: [amount],
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
    const headers = getCorsHeaders(request);
    try {
        const body = await parseJsonBody(request, UpdateExpenseInputSchema);
        const { id, date, amount, description, category } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'UPDATE expense SET Date = ?, Amount = ?, Description = ?, Category = ? WHERE rowid = ?'
        );
        const result = await stmt.bind(date, amount, description, category, id).run();

        if (result.meta.changes > 0) {
            return new Response('Expense updated successfully', { status: 200, headers });
        } else {
            throw new AppError('Expense not found or update failed', 404);
        }
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Handle DELETE requests for expenses
expensesRouter.delete('/api/expense', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const body = await parseJsonBody(request, DeleteExpenseInputSchema);
        const { id } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare("DELETE FROM expense WHERE rowid = ?");
        const result = await stmt.bind(id).run();

        if (result.meta.changes > 0) {
            return new Response('Expense deleted successfully', { status: 200, headers });
        } else {
            throw new AppError('Expense not found or delete failed', 404);
        }
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Handle PATCH requests for batch category reassignment
expensesRouter.patch('/api/expenses/category', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const body = await parseJsonBody(request, BatchCategoryUpdateSchema);
        const { oldCategory, newCategory } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'UPDATE expense SET Category = ? WHERE Category = ?'
        );
        const result = await stmt.bind(newCategory, oldCategory).run();

        return new Response(JSON.stringify({
            updated: result.meta.changes,
            message: `Reassigned ${result.meta.changes} expense(s) from "${oldCategory}" to "${newCategory}"`,
        }), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Catch-all for routes within this router that are not handled
expensesRouter.all('*', (request) => {
    return new Response('Expense API endpoint not found', { status: 404, headers: getCorsHeaders(request) });
});

export { expensesRouter };
