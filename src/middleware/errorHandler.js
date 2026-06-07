import { getCorsHeaders } from './cors';
import { AppError } from '../utils/AppError';

// Error handling middleware
export async function errorHandlerMiddleware(error, request, env, context) {
    const corsHeaders = getCorsHeaders(request);

    console.error('Error in worker:', error);

    // Determine status code: AppError.statusCode, then error.status, then fallback
    let status = error.statusCode || error.status || 500;
    const message = error.message || 'An unexpected error occurred';

    // Heuristic fallback for non-AppError errors
    if (!(error instanceof AppError)) {
        if (message.includes('Missing required') || message.includes('Validation Error') || message.includes('must be')) {
            status = 400;
        }
        if (message === 'Not Found' || message.includes('not found')) {
            status = 404;
        }
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
