import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
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

/**
 * Calculate the previous year-month string given a year-month.
 * @param {string} yearMonth - Format "YYYY-MM"
 * @returns {string} Previous year-month in "YYYY-MM" format
 */
function previousYearMonth(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number);
    if (m === 1) {
        return `${y - 1}-12`;
    }
    return `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Get the number of days in a given year-month.
 * @param {string} yearMonth - Format "YYYY-MM"
 * @returns {number} Number of days in the month
 */
function daysInMonth(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

// Shared query param schema for year-month
const yearMonthSchema = z.object({
    year: z.string().regex(/^\d{4}$/, "Year must be a 4-digit number"),
    month: z.string().regex(/^\d{2}$/, "Month must be a 2-digit number"),
});

// Handle GET requests for summary (original categories endpoint)
summaryRouter.get('/api/summary', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const { year, month } = parseQueryParams(request, yearMonthSchema);

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

// GET /api/summary/stats - Key stats cards data
summaryRouter.get('/api/summary/stats', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const { year, month } = parseQueryParams(request, yearMonthSchema);
        const yearMonth = `${year}-${month}`;
        const prevYearMonth = previousYearMonth(yearMonth);
        const db = env.D1_DATABASE;

        // Current month stats
        const statsStmt = db.prepare(
            'SELECT SUM(amount_vnd_pos) as total_spent, COUNT(*) as transaction_count FROM v_expense_clean WHERE year_month = ?'
        );
        const { results: statsResults } = await statsStmt.bind(yearMonth).all();
        const stats = statsResults[0] || { total_spent: 0, transaction_count: 0 };
        const totalSpent = stats.total_spent || 0;
        const transactionCount = stats.transaction_count || 0;
        const avgDaily = Math.round(totalSpent / daysInMonth(yearMonth));

        // Biggest category
        const bigCatStmt = db.prepare(
            'SELECT category, spend_vnd FROM v_monthly_category_spend WHERE year_month = ? ORDER BY spend_vnd DESC LIMIT 1'
        );
        const { results: bigCatResults } = await bigCatStmt.bind(yearMonth).all();
        const biggestCategory = bigCatResults.length > 0
            ? { name: bigCatResults[0].category, amount: bigCatResults[0].spend_vnd }
            : null;

        // Previous month total
        const prevStmt = db.prepare(
            'SELECT SUM(amount_vnd_pos) as total_spent FROM v_expense_clean WHERE year_month = ?'
        );
        const { results: prevResults } = await prevStmt.bind(prevYearMonth).all();
        const prevTotal = (prevResults[0] && prevResults[0].total_spent) || 0;

        const vsLastMonth = prevTotal > 0
            ? {
                amount: totalSpent - prevTotal,
                percent: Math.round(((totalSpent - prevTotal) / prevTotal) * 100 * 100) / 100,
              }
            : { amount: totalSpent, percent: 0 };

        const responseData = {
            totalSpent,
            avgDaily,
            transactionCount,
            biggestCategory,
            vsLastMonth,
        };

        return new Response(JSON.stringify(responseData), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// GET /api/summary/categories - All categories with % of total and vs last month
summaryRouter.get('/api/summary/categories', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const { year, month } = parseQueryParams(request, yearMonthSchema);
        const yearMonth = `${year}-${month}`;
        const prevYearMonth = previousYearMonth(yearMonth);
        const db = env.D1_DATABASE;

        // Current month categories
        const catStmt = db.prepare(
            'SELECT category, spend_vnd FROM v_monthly_category_spend WHERE year_month = ? ORDER BY spend_vnd DESC'
        );
        const { results: currentCategories } = await catStmt.bind(yearMonth).all();

        const totalSpent = currentCategories.reduce((sum, c) => sum + c.spend_vnd, 0);

        // Previous month categories
        const { results: prevCategories } = await catStmt.bind(prevYearMonth).all();
        const prevMap = {};
        prevCategories.forEach(c => { prevMap[c.category] = c.spend_vnd; });

        const responseData = currentCategories.map(c => ({
            category: c.category,
            spend_vnd: c.spend_vnd,
            percentOfTotal: totalSpent > 0 ? Math.round((c.spend_vnd / totalSpent) * 10000) / 100 : 0,
            vsLastMonth: prevMap[c.category] ? c.spend_vnd - prevMap[c.category] : c.spend_vnd,
        }));

        return new Response(JSON.stringify(responseData), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// GET /api/summary/comparison - Month-over-month comparison per category
summaryRouter.get('/api/summary/comparison', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const { year, month } = parseQueryParams(request, yearMonthSchema);
        const yearMonth = `${year}-${month}`;
        const prevYearMonth = previousYearMonth(yearMonth);
        const db = env.D1_DATABASE;

        const catStmt = db.prepare(
            'SELECT category, spend_vnd FROM v_monthly_category_spend WHERE year_month = ?'
        );
        const { results: current } = await catStmt.bind(yearMonth).all();
        const { results: previous } = await catStmt.bind(prevYearMonth).all();

        // Merge by category
        const categoryMap = {};
        current.forEach(c => { categoryMap[c.category] = { current: c.spend_vnd, previous: 0 }; });
        previous.forEach(c => {
            if (categoryMap[c.category]) {
                categoryMap[c.category].previous = c.spend_vnd;
            } else {
                categoryMap[c.category] = { current: 0, previous: c.spend_vnd };
            }
        });

        const responseData = Object.entries(categoryMap).map(([category, data]) => ({
            category,
            current: data.current,
            previous: data.previous,
        }));

        return new Response(JSON.stringify(responseData), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// GET /api/summary/ytd?year= - Year-to-date overview
summaryRouter.get('/api/summary/ytd', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const url = new URL(request.url);
        const params = Object.fromEntries(url.searchParams);
        const yearSchema = z.object({
            year: z.string().regex(/^\d{4}$/, "Year must be a 4-digit number"),
        });
        const { year } = parseQueryParams(request, yearSchema);
        const db = env.D1_DATABASE;

        // Monthly breakdown
        const monthlyStmt = db.prepare(
            `SELECT year_month, SUM(amount_vnd_pos) as total
             FROM v_expense_clean
             WHERE substr(year_month, 1, 4) = ?
             GROUP BY year_month
             ORDER BY year_month`
        );
        const { results: monthlyBreakdown } = await monthlyStmt.bind(year).all();

        // Category breakdown
        const catStmt = db.prepare(
            `SELECT category, SUM(amount_vnd_pos) as total
             FROM v_expense_clean
             WHERE substr(year_month, 1, 4) = ?
             GROUP BY category
             ORDER BY total DESC`
        );
        const { results: categoryBreakdown } = await catStmt.bind(year).all();

        const totalSpent = monthlyBreakdown.reduce((sum, m) => sum + m.total, 0);

        const responseData = {
            totalSpent,
            monthlyBreakdown,
            categoryBreakdown,
        };

        return new Response(JSON.stringify(responseData), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// GET /api/summary/top-transactions?year=&month=&limit= - Top transactions for a given month
summaryRouter.get('/api/summary/top-transactions', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const topTxSchema = yearMonthSchema.extend({
            limit: z.string().optional().default('5'),
        });
        const parsed = parseQueryParams(request, topTxSchema);
        const { year, month, limit } = parsed;
        const yearMonth = `${year}-${month}`;
        const db = env.D1_DATABASE;

        const stmt = db.prepare(
            `SELECT rowid, Date AS date, Amount AS amount, Description AS description, Category AS category
             FROM expense
             WHERE strftime('%Y-%m', Date) = ?
             ORDER BY Amount DESC
             LIMIT ?`
        );
        const { results } = await stmt.bind(yearMonth, parseInt(limit, 10)).all();

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
