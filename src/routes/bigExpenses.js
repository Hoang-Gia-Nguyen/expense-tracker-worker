import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
import { parseJsonBody } from '../utils/parseJsonBody';
import { isValidCalendarDate } from '../utils/dateValidation';
import { z } from 'zod';

const bigExpensesRouter = Router();

// Big expense schemas (no category needed)
const BigExpenseInputSchema = z.object({
  date: z.string().refine(isValidCalendarDate, { message: "Date must be a real YYYY-MM-DD date" }),
  amount: z.number().int({ message: "Amount must be an integer" }).positive({ message: "Amount must be positive" }).safe(),
  description: z.string().min(1, { message: "Description cannot be empty" }).max(500),
});

const BigExpenseUpdateSchema = BigExpenseInputSchema.extend({
  id: z.number().int({ message: "ID must be an integer" }),
});

const BigExpenseDeleteSchema = z.object({
  id: z.number().int({ message: "ID must be an integer" }),
});

// GET /api/big-expenses?year=2025
bigExpensesRouter.get('/api/big-expenses', async (request, env, context) => {
  const headers = getCorsHeaders(request);
  try {
    const url = new URL(request.url);
    const year = url.searchParams.get('year');

    if (!year || !/^\d{4}$/.test(year)) {
      throw new AppError('Missing required query parameter: year', 400);
    }

    const db = env.D1_DATABASE;
    const stmt = db.prepare(
      "SELECT rowid, Date AS date, Amount AS amount, Description AS description FROM big_expense WHERE strftime('%Y', Date) = ? ORDER BY Date DESC"
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

// POST /api/big-expenses
bigExpensesRouter.post('/api/big-expenses', async (request, env, context) => {
  const headers = getCorsHeaders(request);
  try {
    const body = await parseJsonBody(request, BigExpenseInputSchema);
    const { date, amount, description } = body;

    const db = env.D1_DATABASE;
    const stmt = db.prepare(
      'INSERT INTO big_expense (Date, Amount, Description) VALUES (?, ?, ?)'
    );
    await stmt.bind(date, amount, description).run();

    return new Response('Big expense added successfully', { status: 201, headers });
  } catch (error) {
    return errorHandlerMiddleware(error, request, env, context);
  }
});

// PUT /api/big-expenses
bigExpensesRouter.put('/api/big-expenses', async (request, env, context) => {
  const headers = getCorsHeaders(request);
  try {
    const body = await parseJsonBody(request, BigExpenseUpdateSchema);
    const { id, date, amount, description } = body;

    const db = env.D1_DATABASE;
    const stmt = db.prepare(
      'UPDATE big_expense SET Date = ?, Amount = ?, Description = ? WHERE rowid = ?'
    );
    const result = await stmt.bind(date, amount, description, id).run();

    if (result.meta.changes > 0) {
      return new Response('Big expense updated successfully', { status: 200, headers });
    } else {
      throw new AppError('Big expense not found or update failed', 404);
    }
  } catch (error) {
    return errorHandlerMiddleware(error, request, env, context);
  }
});

// DELETE /api/big-expenses
bigExpensesRouter.delete('/api/big-expenses', async (request, env, context) => {
  const headers = getCorsHeaders(request);
  try {
    const body = await parseJsonBody(request, BigExpenseDeleteSchema);
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
