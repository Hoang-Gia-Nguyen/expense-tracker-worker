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
    const status = error.status || 500;
    const message = error.message || 'An unexpected error occurred';

    return new Response(JSON.stringify({ error: message }), {
        status: status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}
