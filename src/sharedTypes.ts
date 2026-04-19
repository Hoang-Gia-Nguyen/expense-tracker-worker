import { z } from 'zod';

// Schema for an Expense record in the database
export const ExpenseSchema = z.object({
    Date: z.string().datetime({ message: "Date must be a valid ISO 8601 string" }),
    Amount: z.number().int({ message: "Amount must be an integer" }).positive({ message: "Amount must be positive" }),
    Description: z.string().min(1, { message: "Description cannot be empty" }),
    Category: z.string().min(1, { message: "Category cannot be empty" }),
});

// Type inferred from ExpenseSchema
export type Expense = z.infer<typeof ExpenseSchema>;

// Schema for adding a new expense (similar to ExpenseSchema but Date might be optional if set by server)
export const NewExpenseInputSchema = ExpenseSchema.omit({ Date: true }).extend({
    // For API, date might be provided, but let's assume the server might default it or reformat.
    // For now, let's make Date required here to match frontend submission.
    Date: z.string().datetime({ message: "Date must be a valid ISO 8601 string" }),
});

// Type for new expense input
export type NewExpenseInput = z.infer<typeof NewExpenseInputSchema>;

// Schema for updating an expense
export const UpdateExpenseInputSchema = ExpenseSchema.extend({
    id: z.number().int({ message: "ID must be an integer" }),
});

// Type for update expense input
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInputSchema>;

// Schema for deleting an expense
export const DeleteExpenseInputSchema = z.object({
    id: z.number().int({ message: "ID must be an integer" }),
});

// Type for delete expense input
export type DeleteExpenseInput = z.infer<typeof DeleteExpenseInputSchema>;


// --- API Response Schemas ---

// Schema for a single expense record returned by the API
export const ApiExpenseSchema = ExpenseSchema.extend({
    rowid: z.number().int(), // rowid is returned by D1
});

// Type for a single expense record in API response
export type ApiExpense = z.infer<typeof ApiExpenseSchema>;

// Schema for the GET /api/expense response (array of ApiExpense)
export const GetExpensesResponseSchema = z.array(ApiExpenseSchema);

// Schema for the GET /api/summary response
export const SummarySchema = z.array(z.object({
    category: z.string(),
    spend_vnd: z.number(),
}));

// Type for summary response
export type Summary = z.infer<typeof SummarySchema>;

// Schema for the GET /api/insights response
export const InsightsResponseSchema = z.object({
    dailySeries: z.array(z.object({
        date: z.string(),
        total: z.number(),
    })),
    dailySpikes: z.array(z.object({
        date: z.string(),
        total: z.number(),
        multiplier: z.number(),
    })),
    categorySpikes: z.array(z.object({
        category: z.string(),
        current: z.number(),
        percentIncrease: z.number(),
    })),
    topTransactions: z.array(ApiExpenseSchema), // Reusing ApiExpenseSchema for transactions
});

// Type for insights response
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;
