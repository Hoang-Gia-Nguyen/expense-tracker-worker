import { Router } from 'itty-router';
import { errorHandlerMiddleware } from '../middleware/errorHandler';
import { getCorsHeaders } from '../middleware/cors';
import { AppError } from '../utils/AppError';
import { z } from 'zod';

// Models used for category suggestion — primary + fallback
const AI_MODELS = [
  '@cf/meta/llama-3.2-3b-instruct',
  '@hf/google/gemma-2-2b-it',
];

const SuggestCategorySchema = z.object({
    amount: z.number({ message: "Amount must be a number" }),
    description: z.string().min(1, { message: "Description cannot be empty" }),
    categories: z.array(z.string().min(1)).min(1, { message: "At least one category is required" }),
});

/**
 * Find the closest matching category from the list using fuzzy matching.
 */
function findClosestCategory(raw, categories) {
  const cleaned = raw.replace(/[^a-zA-ZÀ-ỹ0-9\s\-/]/g, '').trim();

  // 1. Exact match (case-insensitive)
  const exact = categories.find(cat => cat.toLowerCase() === cleaned.toLowerCase());
  if (exact) return exact;

  // 2. Partial match — category is contained in the AI output
  const contained = categories.find(cat => cleaned.toLowerCase().includes(cat.toLowerCase()));
  if (contained) return contained;

  // 3. Partial match — AI output is contained in a category name
  const partOf = categories.find(cat => cat.toLowerCase().includes(cleaned.toLowerCase()));
  if (partOf) return partOf;

  // 4. Token overlap scoring
  const cleanedLower = cleaned.toLowerCase();
  const scored = categories.map(cat => ({
    cat,
    score: cat.toLowerCase().split(/[\s/]+/).filter(token => cleanedLower.includes(token)).length,
  }));
  const best = scored.reduce((a, b) => (a.score > b.score ? a : b));
  if (best.score > 0) return best.cat;

  return null;
}

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

        const categoryList = categories.join(', ');

        const systemPrompt = `You are a category suggestion assistant for an expense tracker.
Available categories: ${categoryList}

Respond with ONLY the exact category name from the list. No punctuation, no explanation, no extra text.

Examples:
- "Bought groceries at supermarket" 50000 VND -> Food
- "Bus ticket" 15000 VND -> Transportation
- "Doctor visit" 200000 VND -> Medical/Utility
- "Electric bill" 500000 VND -> Home
- "Coffee with friends" 100000 VND -> Entertainment`;

        const userPrompt = `${description} ${amount} VND ->`;

        // Try each model in order until one succeeds
        let suggestedCategory = '';
        let lastError = null;

        for (const model of AI_MODELS) {
            try {
                const response = await env.AI.run(model, {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    max_tokens: 20,
                    temperature: 0.05,
                });

                let raw = '';
                if (typeof response === 'object' && response.response) {
                    raw = response.response.trim();
                } else if (typeof response === 'string') {
                    raw = response.trim();
                }

                console.log(`[AI Suggest] Model ${model} raw response: "${raw}"`);

                const matched = findClosestCategory(raw, categories);
                if (matched) {
                    suggestedCategory = matched;
                    console.log(`[AI Suggest] Matched to: "${matched}"`);
                    break;
                } else {
                    console.log(`[AI Suggest] Model ${model} returned invalid category, trying next`);
                }
            } catch (modelError) {
                lastError = modelError;
                console.warn(`[AI Suggest] Model ${model} failed: ${modelError.message}`);
                // Continue to next model
            }
        }

        if (!suggestedCategory && lastError) {
            console.error(`[AI Suggest] All models failed. Last error: ${lastError.message}`);
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
