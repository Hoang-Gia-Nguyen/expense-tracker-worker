import { CORS_ALLOWED_ORIGINS } from '../config'; // Assuming config will be created later

export function corsMiddleware(request) {
    const origin = request.headers.get('Origin');
    const headers = {};

    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
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

    // Do NOT return anything here if you want itty-router to continue
    // to subsequent handlers. Returning an object will stop the router.
    return undefined;
}
