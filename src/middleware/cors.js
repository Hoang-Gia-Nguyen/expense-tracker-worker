import { CORS_ALLOWED_ORIGINS } from '../config'; // Assuming config will be created later

export function corsMiddleware(request) {
    const origin = request.headers.get('Origin');
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    } else {
        headers['Access-Control-Allow-Origin'] = 'null'; // Disallow other origins
    }

    // Handle OPTIONS requests specifically
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers,
        });
    }

    // Attach CORS headers to all successful responses
    // This will be done by the errorHandler or route handlers themselves
    return { headers };
}
