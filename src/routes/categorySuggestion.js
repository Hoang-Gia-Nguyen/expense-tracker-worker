import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
import { z } from 'zod';

const SuggestCategorySchema = z.object({
    amount: z.number({ message: "Amount must be a number" }),
    description: z.string().min(1, { message: "Description cannot be empty" }),
    categories: z.array(z.string().min(1)).min(1, { message: "At least one category is required" }),
});

const suggestionRouter = Router();

suggestionRouter.post('/api/expense/suggest-category', async (request, env, context) => {
    const headers = getCorsHeaders(request);
    try {
        const body = await request.json();
        const parsed = SuggestCategorySchema.parse(body);
        const { amount, description, categories } = parsed;

        if (!env.AI) {
            throw new AppError('AI binding not available', 503);
        }

        const systemPrompt = `You are a category suggestion assistant for an expense tracker. Your task is to suggest the most appropriate category for a given expense description and amount.

Available categories: ${categories.join(', ')}

Rules:
- Analyze both the description and the amount to determine the most fitting category.
- Consider typical expense patterns (e.g., groceries -> Food, gas -> Transportation).
- Respond with ONLY the exact category name from the list above. No punctuation, no explanation, no extra text.
- If uncertain, choose the most reasonable category from the list.`;

        const userPrompt = `Description: "${description}"\nAmount: ${amount} VND\n\nWhich category from [${categories.join(', ')}] fits best?`;

        const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 50,
            temperature: 0.1,
        });

        let suggestedCategory = '';
        if (typeof response === 'object' && response.response) {
            suggestedCategory = response.response.trim();
        } else if (typeof response === 'string') {
            suggestedCategory = response.trim();
        }

        // Clean up the response - remove any extra punctuation or whitespace
        suggestedCategory = suggestedCategory.replace(/[^a-zA-ZÀ-ỹ0-9\s\-/]/g, '').trim();

        // Validate that the suggested category is in the provided list
        const isValidCategory = categories.some(
            cat => cat.toLowerCase() === suggestedCategory.toLowerCase()
        );

        if (!isValidCategory) {
            // Fallback: try to find a close match
            const lowerSuggested = suggestedCategory.toLowerCase();
            const match = categories.find(
                cat => cat.toLowerCase() === lowerSuggested
            );
            suggestedCategory = match || categories[0];
        }

        return new Response(JSON.stringify({ suggestedCategory }), {
            headers: { ...headers, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return errorHandlerMiddleware(
                new AppError(`Validation Error: ${error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join(', ')}`, 400),
                request, env, context
            );
        }
        return errorHandlerMiddleware(error, request, env, context);
    }
});

// Catch-all
suggestionRouter.all('*', (request) => {
    return new Response('Category suggestion endpoint not found', {
        status: 404,
        headers: getCorsHeaders(request),
    });
});

export { suggestionRouter };
