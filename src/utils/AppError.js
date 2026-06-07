/**
 * Custom error class with an explicit statusCode property.
 * Use this instead of plain Error to signal the correct HTTP status.
 */
export class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}
