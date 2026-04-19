import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../../middleware/errorHandler';
import { CORS_ALLOWED_ORIGINS } from '../../config';
import {
    NewExpenseInputSchema,
    UpdateExpenseInputSchema,
    DeleteExpenseInputSchema,
    ApiExpenseSchema,
    GetExpensesResponseSchema,
} from '../../sharedTypes'; // Import Zod schemas

const expensesRouter = Router();

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

// Helper to parse and validate JSON body
const parseJsonBody = async (request, schema) => {
    try {
        const body = await request.json();
        return schema.parse(body);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('Invalid JSON format');
        }
        if (error.issues) { // Zod validation error
            throw new Error(`Validation Error: ${error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join(', ')}`);
        }
        throw error; // Rethrow other errors
    }
};

// Handle GET requests for expenses
expensesRouter.get('/api/expense', async (request, env, context) => {
    const headers = getHeaders(request);
    try {
        const url = new URL(request.url);
        const year = url.searchParams.get('year');
        const month = url.searchParams.get('month');

        if (!year || !month) {
            throw new Error('Missing required query parameters: year, month');
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            "SELECT rowid, Date, Amount, Description, Category FROM expense WHERE strftime('%Y', Date) = ? AND strftime('%m', Date) = ?"
        );
        const { results } = await stmt.bind(year, month.padStart(2, '0')).all();

        // Validate the results against the expected API response schema
        GetExpensesResponseSchema.parse(results); // This will throw if results are not as expected

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
    const headers = getHeaders(request);
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
                blobs: [description, category, "expense_created"], // Log action and associated strings
                doubles: [amount], // Log the amount
                indexes: [Date.parse(date)], // Log the timestamp
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
        const body = await parseJsonBody(request, UpdateExpenseInputSchema);
        const { id, date, amount, description, category } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'UPDATE expense SET Date = ?, Amount = ?, Description = ?, Category = ? WHERE rowid = ?'
        );
        const { success } = await stmt.bind(date, amount, description, category, id).run();

        if (success) {
            return new Response('Expense updated successfully', { status: 200, headers });
        } else {
            throw new Error('Expense not found or update failed'); // Use throw for consistency with errorHandler
        }
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Handle DELETE requests for expenses
expensesRouter.delete('/api/expense', async (request, env, context) => {
    const headers = getHeaders(request);
    try {
        const body = await parseJsonBody(request, DeleteExpenseInputSchema);
        const { id } = body;

        const db = env.D1_DATABASE;
        const stmt = db.prepare("DELETE FROM expense WHERE rowid = ?");
        const { success } = await stmt.bind(id).run();

        if (success) {
            return new Response('Expense deleted successfully', { status: 200, headers });
        } else {
            throw new Error('Expense not found or delete failed'); // Use throw for consistency
        }
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Catch-all for routes within this router that are not handled
expensesRouter.all('*', (request) => {
    return new Response('Expense API endpoint not found', { status: 404, headers: getHeaders(request) });
});

export { expensesRouter };
