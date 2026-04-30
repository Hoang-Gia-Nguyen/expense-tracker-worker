import { CORS_ALLOWED_ORIGINS } from '../config';

// Error handling middleware
export async function errorHandlerMiddleware(error, request, env, context) {
    const origin = request.headers.get('Origin');
    let corsHeaders = {};

    // Get CORS headers if origin is allowed
    if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
        corsHeaders = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
    } else {
        corsHeaders = { 'Access-Control-Allow-Origin': 'null' };
    }

    console.error('Error in worker:', error);

    // Determine status code based on error type or default to 500
    let status = error.status || 500;
    const message = error.message || 'An unexpected error occurred';

    // Heuristic for validation errors or missing parameters to return 400
    if (message.includes('Missing required') || message.includes('Validation Error') || message.includes('must be')) {
        status = 400;
    }
    
    if (message === 'Not Found' || message.includes('not found')) {
        status = 404;
    }

    let responseBody = message;
    if (status === 500) {
        responseBody = `An error occurred: ${message}`;
    } else if (status === 404) {
        responseBody = '404, not found!';
    }

    return new Response(responseBody, {
        status: status,
        headers: {
            'Content-Type': 'text/plain',
            ...corsHeaders,
        },
    });
}
