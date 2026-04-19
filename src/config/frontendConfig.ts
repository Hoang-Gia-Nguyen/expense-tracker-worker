// src/config/frontendConfig.ts
import { z } from 'zod';

// Zod schemas for configuration values
const categoryConfigSchema = z.record(z.string(), z.object({
    color: z.string(),
}));

const monthlyBudgetSchema = z.record(z.string(), z.number().int());

const configSchema = z.object({
    apiUrl: z.string(),
    monthlyBudget: monthlyBudgetSchema,
    totalBudget: z.number().int(),
    categoryConfig: categoryConfigSchema,
    categoryOrder: z.array(z.string()),
    startOfMonthCategories: z.array(z.string()),
});

// Hardcoded configuration values
// These will be exported and can be served by an API endpoint
export const FRONTEND_CONFIG = {
    apiUrl: '/api', // Base API URL
    monthlyBudget: {
        'Food': 5000000,
        'Medical/Utility': 2000000,
        'Transportation': 1000000,
        'Entertainment': 1500000,
        'Home': 2000000,
        'Baby': 15000000,
    },
    totalBudget: 20000000,
    categoryConfig: {
        'Food': { color: '#FF6384' },
        'Medical/Utility': { color: '#4BC0C0' },
        'Home': { color: '#FFCE56' },
        'Transportation': { color: '#36A2EB' },
        'Entertainment': { color: '#9966FF' },
        'Baby': { color: '#FF9F40' },
        'Gift': { color: '#C9CBCF' },
        'Other': { color: '#808080' },
    },
    categoryOrder: ['Food', 'Baby', 'Medical/Utility', 'Home', 'Transportation', 'Entertainment', 'Gift', 'Other'],
    startOfMonthCategories: ['Home', 'Baby'],
};

// Validate the configuration at build time (or runtime if served via API)
try {
    configSchema.parse(FRONTEND_CONFIG);
    console.log('Frontend configuration validated successfully.');
} catch (error) {
    console.error('Frontend configuration validation failed:', error);
    // In a build process, this could fail the build.
    // If served by API, it would be caught by the API error handler.
    throw error;
}
