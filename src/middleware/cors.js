import { CORS_ALLOWED_ORIGINS } from '../config';

/**
 * Generate CORS headers based on the request origin.
 * Used by route handlers to attach CORS headers to responses.
 */
export function getCorsHeaders(request) {
    const origin = request.headers.get('Origin');
    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Vary': 'Origin',
        };
    }
    return { 'Access-Control-Allow-Origin': 'null', 'Vary': 'Origin' };
}

/**
 * Middleware to handle CORS preflight (OPTIONS) requests.
 */
export function corsMiddleware(request) {
    const origin = request.headers.get('Origin');
    const headers = {};

    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Vary'] = 'Origin';
    } else {
        headers['Access-Control-Allow-Origin'] = 'null';
        headers['Vary'] = 'Origin';
    }

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers,
        });
    }

    return undefined;
}
