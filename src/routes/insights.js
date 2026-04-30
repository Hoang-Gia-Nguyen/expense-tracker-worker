import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { CORS_ALLOWED_ORIGINS } from '../config';
import { z } from 'zod'; // Import z from Zod

// Import schemas for API responses
import {
    ApiExpenseSchema,
    GetExpensesResponseSchema,
    SummarySchema,
    InsightsResponseSchema,
} from '../sharedTypes';

const insightsRouter = Router();

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

// Handle GET requests for insights
insightsRouter.get('/api/insights', async (request, env, context) => {
    const headers = getHeaders(request);
    try {
        // Basic check for D1_DATABASE binding
        if (!env.D1_DATABASE) {
            throw new Error('D1_DATABASE not configured');
        }

        const db = env.D1_DATABASE;

        // ===== 1. Last 30 days daily totals =====
        const dailyStmt = db.prepare(`
            SELECT Date, SUM(Amount) as total
            FROM expense
            WHERE Date >= date('now', '-29 days')
            GROUP BY Date
            ORDER BY Date
        `);
        const { results: dailyResults } = await dailyStmt.all();

        // fill missing days
        const map = {};
        dailyResults.forEach(r => map[r.Date] = r.total);

        const dailySeries = [];
        const values = [];

        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const total = map[dateStr] || 0;
            dailySeries.push({ date: dateStr, total });
            values.push(total);
        }

        // compute mean & std
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const std = Math.sqrt(variance);

        const dailySpikes = dailySeries
            .filter(d => d.total > mean + 2 * std)
            .map(d => ({
                date: d.date,
                total: d.total,
                multiplier: mean === 0 ? 0 : d.total / mean
            }));

        // ===== 2. Category spike (this month vs 6-month avg) =====
        const currentDate = new Date();
        const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
        const currentYear = currentDate.getFullYear();
        const currentMonthYear = `${currentYear}-${currentMonth}`;

        const categoryStmt = db.prepare(`
            SELECT category, spend_vnd
            FROM v_monthly_category_spend
            WHERE year_month = ?
        `);
        const { results: currentCategories } = await categoryStmt.bind(currentMonthYear).all();

        const categorySpikes = [];

        for (const row of currentCategories) {
            const avgStmt = db.prepare(`
                SELECT AVG(spend_vnd) as avg_spend
                FROM v_monthly_category_spend
                WHERE category = ?
                AND year_month < ?
                ORDER BY year_month DESC
                LIMIT 6
            `);
            const { results } = await avgStmt.bind(row.category, currentMonthYear).all();
            const avg = results[0]?.avg_spend || 0;

            if (avg > 0 && row.spend_vnd > avg * 1.5) {
                categorySpikes.push({
                    category: row.category,
                    current: row.spend_vnd,
                    percentIncrease: ((row.spend_vnd - avg) / avg) * 100
                });
            }
        }

        // ===== 3. Top 5 transactions (this month) =====
        const topStmt = db.prepare(`
            SELECT rowid, Date, Amount, Description, Category
            FROM expense
            WHERE strftime('%Y-%m', Date) = ?
            ORDER BY Amount DESC
            LIMIT 5
        `);
        const { results: topTransactionsResults } = await topStmt.bind(currentMonthYear).all();
        const topTransactions = topTransactionsResults.map(row => ({
            rowid: row.rowid,
            date: row.Date,
            amount: row.Amount,
            description: row.Description,
            category: row.Category
        }));

        const insightsData = {
            dailySeries,
            dailySpikes,
            categorySpikes,
            topTransactions
        };

        // Validate the fetched data against the InsightsResponseSchema
        InsightsResponseSchema.parse(insightsData);

        return new Response(JSON.stringify(insightsData), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Catch-all for routes within this router that are not handled
insightsRouter.all('*', (request) => {
    return new Response('Insights API endpoint not found', { status: 404, headers: getHeaders(request) });
});

export { insightsRouter };
