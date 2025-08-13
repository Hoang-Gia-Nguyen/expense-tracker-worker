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
    if (url.pathname.startsWith('/api/expense')) {
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
        assetRequest = new Request(newUrl.toString(), request);
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
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    try {
        const url = new URL(request.url);
        const year = url.searchParams.get('year');
        const month = url.searchParams.get('month');

        if (!year || !month) {
            return new Response('Missing required query parameters: year, month', { status: 400, headers: corsHeaders });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            "SELECT rowid, Date, Amount, Description, Category FROM expense WHERE strftime('%Y', Date) = ? AND strftime('%m', Date) = ?"
        );
        const { results } = await stmt.bind(year, month.padStart(2, '0')).all();

        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        return new Response(`An error occurred: ${error.message}`, { status: 500, headers: corsHeaders });
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
            return new Response('Missing required fields', { status: 400, headers: corsHeaders });
        }
        if (typeof amount !== 'number') {
            return new Response('Amount must be an integer', { status: 400, headers: corsHeaders });
        }

        const db = env.D1_DATABASE;
        const stmt = db.prepare(
            'INSERT INTO expense (Date, Amount, Description, Category) VALUES (?, ?, ?, ?)'
        );
        await stmt.bind(date, amount, description, category).run();

        return new Response('Expense added successfully', { status: 201, headers: corsHeaders });
    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(`An error occurred: ${error.message}`, { status: 500, headers: corsHeaders });
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
            return new Response('Missing required fields', { status: 400, headers: corsHeaders });
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
        return new Response(`An error occurred: ${error.message}`, { status: 500, headers: corsHeaders });
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
        return new Response(`An error occurred: ${error.message}`, { status: 500, headers: corsHeaders });
    }
});

// Catch-all for 404s
router.all('*', () => new Response('404, not found!', { status: 404 }));

export default {
    fetch: router.handle
};


