import { Router } from 'itty-router';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// Whitelist of allowed origins
const allowedOrigins = [
    'https://expensetracker.hgnlab.org',
    'http://localhost:8787', // For local development with Wrangler
    'http://127.0.0.1:8787',
    'http://localhost:8788', // For wrangler pages dev
    'http://127.0.0.1:8788',
];

// Function to generate CORS headers for a given origin
function getCorsHeaders(origin) {
    if (allowedOrigins.includes(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
    }
    return {
        'Access-Control-Allow-Origin': 'null', // Disallow other origins
    };
}

const router = Router();

// Handle preflight (OPTIONS) requests
router.options('*', (request) => {
    const origin = request.headers.get('Origin');
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
    });
});

// Serve static assets
router.get('*', async (request, env, context) => {
    // Skip asset handling for API routes
    const url = new URL(request.url);
    if (
        url.pathname.startsWith('/api/expense') ||
        url.pathname.startsWith('/api/summary') ||
        url.pathname.startsWith('/api/insights')
    ) {
        return undefined;
    }

    if (url.pathname === '/') {
        return Response.redirect(`${url.origin}/expense`, 302);
    }

    let assetRequest = request;
    const rewrites = ['/expense', '/summary', '/insights'];
    if (rewrites.includes(url.pathname)) {
        const newUrl = new URL(url);
        newUrl.pathname = `${url.pathname}/index.html`;
        assetRequest = new Request(newUrl.toString(), {
            method: request.method,
            headers: request.headers,
        });
    }

    try {
        return await getAssetFromKV(
            {
                request: assetRequest,
                // use waitUntil from context when available (Cloudflare Workers),
                // fall back to env.waitUntil for tests or other environments
                waitUntil: context?.waitUntil || env.waitUntil,
            },
            {
                ASSET_NAMESPACE: env.__STATIC_CONTENT,
                ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
            }
        );
    } catch (e) {
        // If the asset is not found, fall through to the next route (API or 404)
        return undefined;
    }
});

// Handle GET requests
router.get('/api/expense', async (request, env) => {
    const db = env.D1_DATABASE;
    // Ensure indexes exist (idempotent) – safe for mock DB
    const _idx1 = db.prepare('CREATE INDEX IF NOT EXISTS idx_expense_date ON expense(Date);');
    if (typeof _idx1.run === 'function') await _idx1.run();
    const _idx2 = db.prepare('CREATE INDEX IF NOT EXISTS idx_expense_date_amount ON expense(Date, Amount);');
    if (typeof _idx2.run === 'function') await _idx2.run();
    const _idx3 = db.prepare('CREATE INDEX IF NOT EXISTS idx_monthly_cat ON v_monthly_category_spend(category, year_month);');
    if (typeof _idx3.run === 'function') await _idx3.run();
    const _idx4 = db.prepare('CREATE INDEX IF NOT EXISTS idx_monthly_ym ON v_monthly_category_spend(year_month);');
    if (typeof _idx4.run === 'function') await _idx4.run();
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    try {
        const url = new URL(request.url);
        const year = url.searchParams.get('year');
        const month = url.searchParams.get('month');

        if (!year || !month) {
            return new Response(JSON.stringify({ error: 'Missing required query parameters: year, month' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Query expenses for the given month using a date range (index-friendly)
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const end = new Date(startDate);
        end.setMonth(end.getMonth() + 1);
        const endDate = end.toISOString().slice(0, 10);
        const stmt = db.prepare(
            "SELECT rowid, Date, Amount, Description, Category FROM expense WHERE Date >= ? AND Date < ?"
        );
        const { results } = await stmt.bind(startDate, endDate).all();

        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

// Handle GET summary requests
router.get('/api/summary', async (request, env) => {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    try {
        const url = new URL(request.url);
        const year = url.searchParams.get('year');
        const month = url.searchParams.get('month');

        if (!year || !month) {
            return new Response(JSON.stringify({ error: 'Missing required query parameters: year, month' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'SELECT category, spend_vnd FROM v_monthly_category_spend WHERE year_month = ?'
        );
        const { results } = await stmt.bind(`${year}-${month.padStart(2, '0')}`).all();

        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Error fetching summary:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

// Handle POST requests
router.post('/api/expense', async (request, env) => {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    try {
        const body = await request.json();
        const { date, amount, description, category } = body;

        if (!date || !amount || !description || !category) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (typeof amount !== 'number') {
            return new Response('Amount must be an integer', { status: 400, headers: corsHeaders });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'INSERT INTO expense (Date, Amount, Description, Category) VALUES (?, ?, ?, ?)'
        );
        await stmt.bind(date, amount, description, category).run();

        // Send data to Analytics Engine
        env.LOGGING_HABIT.writeDataPoint({
            blobs: ["expense_created", date],
            doubles: [],
            indexes: [Date.now()]
        });

        return new Response('Expense added successfully', { status: 201, headers: corsHeaders });
    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

// Handle PUT requests
router.put('/api/expense', async (request, env) => {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    try {
        const body = await request.json();
        const { id, date, amount, description, category } = body;

        if (!id || !date || !amount || !description || !category) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (typeof amount !== 'number') {
            return new Response('Amount must be an integer', { status: 400, headers: corsHeaders });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'UPDATE expense SET Date = ?, Amount = ?, Description = ?, Category = ? WHERE rowid = ?'
        );
        await stmt.bind(date, amount, description, category, id).run();

        return new Response('Expense updated successfully', { status: 200, headers: corsHeaders });
    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

// Handle DELETE requests
router.delete('/api/expense', async (request, env) => {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    try {
        const { id } = await request.json();

        if (!id) {
            return new Response('Missing required field: id', { status: 400, headers: corsHeaders });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare("DELETE FROM expense WHERE rowid = ?");
        const { success } = await stmt.bind(id).run();

        if (success) {
            return new Response('Expense deleted successfully', { status: 200, headers: corsHeaders });
        } else {
            return new Response('Failed to delete expense or not found', { status: 404, headers: corsHeaders });
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

router.get('/api/insights', async (request, env) => {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    try {
        const db = env.D1_DATABASE;

        // ===== 1. Last 30 days daily totals =====
        const dailyStmt = db.prepare(`
            SELECT Date, SUM(Amount) as total
            FROM expense
            WHERE Date >= date('now', '-29 days')
            GROUP BY Date
            ORDER BY Date
        `);

        let dailyResultsObj;
            if (typeof dailyStmt.all === 'function') {
                dailyResultsObj = await dailyStmt.all();
            } else {
                dailyResultsObj = await dailyStmt.bind().all();
            }
            const { results: dailyResults } = dailyResultsObj;

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
        const currentMonth = new Date().toISOString().slice(0, 7);

        const categoryStmt = db.prepare(`
            SELECT category, spend_vnd
            FROM v_monthly_category_spend
            WHERE year_month = ?
        `);

        const { results: currentCategories } =
            await categoryStmt.bind(currentMonth).all();

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

            const { results } =
                await avgStmt.bind(row.category, currentMonth).all();

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

        const { results: topTransactions } =
            await topStmt.bind(currentMonth).all();

        return new Response(JSON.stringify({
            dailySeries,
            dailySpikes,
            categorySpikes,
            topTransactions
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Insights error:', error);
        return new Response(`Error: ${error.message}`, {
            status: 500,
            headers: corsHeaders
        });
    }
});


// Catch-all for 404s
router.all('*', () => new Response('404, not found!', { status: 404 }));

export default {
    fetch: router.handle
};

