import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
import { z } from 'zod';

const investmentsRouter = Router();

// Schemas
const InvestmentInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['BUY', 'SELL']),
  productName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unitPrice: z.number().int().positive(),
  totalValue: z.number().int().positive(),
  notes: z.string().optional().default(''),
});

const InvestmentDeleteSchema = z.object({
  id: z.number().int().positive(),
});

async function parseJsonBody(request, schema) {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AppError('Invalid JSON format', 400);
    }
    if (error.issues) {
      throw new AppError(
        `Validation Error: ${error.issues.map(i => `${i.path.join('.')} - ${i.message}`).join(', ')}`,
        400
      );
    }
    throw error;
  }
}

// GET /api/investments
investmentsRouter.get('/api/investments', async (request, env, context) => {
  const headers = getCorsHeaders(request);
  try {
    const db = env.D1_DATABASE;
    const { results } = await db.prepare(
      "SELECT id, Date AS date, Type AS type, ProductName AS productName, Quantity AS quantity, Unit AS unit, UnitPrice AS unitPrice, TotalValue AS totalValue, Notes AS notes FROM investment ORDER BY Date DESC"
    ).all();

    // Compute portfolio summary
    const products = {};
    let totalInvested = 0;
    let totalRecovered = 0;

    for (const t of results) {
      const key = t.productName;
      if (!products[key]) {
        products[key] = { productName: key, unit: t.unit, holdings: 0, totalBuyValue: 0, totalBuyQty: 0, transactionCount: 0 };
      }
      const p = products[key];
      p.transactionCount++;
      if (t.type === 'BUY') {
        p.holdings += t.quantity;
        p.totalBuyValue += t.totalValue;
        p.totalBuyQty += t.quantity;
        totalInvested += t.totalValue;
      } else {
        p.holdings -= t.quantity;
        totalRecovered += t.totalValue;
      }
    }

    const summary = Object.values(products).map(p => ({
      ...p,
      holdings: Math.round(p.holdings * 100) / 100,
      avgCost: p.totalBuyQty > 0 ? Math.round(p.totalBuyValue / p.totalBuyQty) : 0,
    }));

    return new Response(JSON.stringify({ items: results, summary, totalInvested, totalRecovered }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return errorHandlerMiddleware(error, request, env, context);
  }
});

// POST /api/investments
investmentsRouter.post('/api/investments', async (request, env, context) => {
  const headers = getCorsHeaders(request);
  try {
    const body = await parseJsonBody(request, InvestmentInputSchema);
    const { date, type, productName, quantity, unit, unitPrice, totalValue, notes } = body;

    const db = env.D1_DATABASE;
    await db.prepare(
      "INSERT INTO investment (Date, Type, ProductName, Quantity, Unit, UnitPrice, TotalValue, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(date, type, productName, quantity, unit, unitPrice, totalValue, notes).run();

    return new Response(JSON.stringify({ message: 'Transaction added' }), {
      status: 201,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorHandlerMiddleware(error, request, env, context);
  }
});

// DELETE /api/investments
investmentsRouter.delete('/api/investments', async (request, env, context) => {
  const headers = getCorsHeaders(request);
  try {
    const body = await parseJsonBody(request, InvestmentDeleteSchema);
    const { id } = body;

    const db = env.D1_DATABASE;
    const result = await db.prepare("DELETE FROM investment WHERE id = ?").bind(id).run();

    if (result.meta.changes > 0) {
      return new Response(JSON.stringify({ message: 'Transaction deleted' }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    throw new AppError('Transaction not found', 404);
  } catch (error) {
    return errorHandlerMiddleware(error, request, env, context);
  }
});

// Catch-all
investmentsRouter.all('*', (request) => {
  return new Response('Investment API endpoint not found', {
    status: 404,
    headers: getCorsHeaders(request),
  });
});

export { investmentsRouter };
