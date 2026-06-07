import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
import { InsightsResponseSchema } from '../sharedTypes';

const insightsRouter = Router();

// Handle GET requests for insights
insightsRouter.get('/api/insights', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        // Basic check for D1_DATABASE binding
        if (!env.D1_DATABASE) {
            throw new AppError('D1_DATABASE not configured', 500);
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

        // Single query replacing N+1 pattern: for each category in the current month,
        // compute the average spend over the previous 6 months
        const categoryStmt = db.prepare(`
            SELECT
                c.category,
                c.spend_vnd AS current_spend,
                COALESCE(
                    (SELECT AVG(h.spend_vnd)
                     FROM (
                        SELECT spend_vnd
                        FROM v_monthly_category_spend
                        WHERE category = c.category
                        AND year_month < c.year_month
                        ORDER BY year_month DESC
                        LIMIT 6
                     ) h
                    ), 0
                ) AS avg_spend
            FROM v_monthly_category_spend c
            WHERE c.year_month = ?
        `);
        const { results: categoryResults } = await categoryStmt.bind(currentMonthYear).all();

        const categorySpikes = categoryResults
            .filter(r => r.avg_spend > 0 && r.current_spend > r.avg_spend * 1.5)
            .map(r => ({
                category: r.category,
                current: r.current_spend,
                percentIncrease: ((r.current_spend - r.avg_spend) / r.avg_spend) * 100
            }));

        // ===== 3. Top 5 transactions (this month) =====
        const topStmt = db.prepare(`
            SELECT rowid, Date AS date, Amount AS amount, Description AS description, Category AS category
            FROM expense
            WHERE strftime('%Y-%m', Date) = ?
            ORDER BY Amount DESC
            LIMIT 5
        `);
        const { results: topTransactionsResults } = await topStmt.bind(currentMonthYear).all();

        const insightsData = {
            dailySeries,
            dailySpikes,
            categorySpikes,
            topTransactions: topTransactionsResults
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
    return new Response('Insights API endpoint not found', { status: 404, headers: getCorsHeaders(request) });
});

export { insightsRouter };
