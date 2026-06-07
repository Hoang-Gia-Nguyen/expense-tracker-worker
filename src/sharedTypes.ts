import { z } from 'zod';

// Schema for an Expense record in the database
export const ExpenseSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/, { message: "Date must be a valid date or datetime string (YYYY-MM-DD or ISO 8601)" }),
    amount: z.number().int({ message: "Amount must be an integer" }).positive({ message: "Amount must be positive" }),
    description: z.string().min(1, { message: "Description cannot be empty" }),
    category: z.string().min(1, { message: "Category cannot be empty" }),
});

// Type inferred from ExpenseSchema
export type Expense = z.infer<typeof ExpenseSchema>;

// Schema for adding a new expense
export const NewExpenseInputSchema = ExpenseSchema;

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

// Schema for PATCH /api/expenses/category (batch category reassignment)
export const BatchCategoryUpdateSchema = z.object({
    oldCategory: z.string().min(1, { message: "oldCategory is required" }),
    newCategory: z.string().min(1, { message: "newCategory is required" }),
});

export type BatchCategoryUpdate = z.infer<typeof BatchCategoryUpdateSchema>;

// --- Summary Page Extended Schemas ---

// Schema for biggest category item
const BiggestCategorySchema = z.object({
    name: z.string(),
    amount: z.number(),
}).nullable();

// Schema for vsLastMonth
const VsLastMonthSchema = z.object({
    amount: z.number(),
    percent: z.number(),
});

// Schema for GET /api/summary/stats response
export const SummaryStatsSchema = z.object({
    totalSpent: z.number(),
    avgDaily: z.number(),
    transactionCount: z.number(),
    biggestCategory: BiggestCategorySchema,
    vsLastMonth: VsLastMonthSchema,
});

export type SummaryStats = z.infer<typeof SummaryStatsSchema>;

// Schema for a single category in the categories response
const CategoryDetailSchema = z.object({
    category: z.string(),
    spend_vnd: z.number(),
    percentOfTotal: z.number(),
    vsLastMonth: z.number(),
});

// Schema for GET /api/summary/categories response
export const SummaryCategoriesSchema = z.array(CategoryDetailSchema);

export type SummaryCategories = z.infer<typeof SummaryCategoriesSchema>;

// Schema for a single comparison item
const ComparisonItemSchema = z.object({
    category: z.string(),
    current: z.number(),
    previous: z.number(),
});

// Schema for GET /api/summary/comparison response
export const SummaryComparisonSchema = z.array(ComparisonItemSchema);

export type SummaryComparison = z.infer<typeof SummaryComparisonSchema>;

// Schema for a monthly breakdown item in YTD
const MonthlyBreakdownItemSchema = z.object({
    year_month: z.string(),
    total: z.number(),
});

// Schema for a category breakdown item in YTD
const CategoryBreakdownItemSchema = z.object({
    category: z.string(),
    total: z.number(),
});

// Schema for GET /api/summary/ytd response
export const SummaryYtdSchema = z.object({
    totalSpent: z.number(),
    monthlyBreakdown: z.array(MonthlyBreakdownItemSchema),
    categoryBreakdown: z.array(CategoryBreakdownItemSchema),
});

export type SummaryYtd = z.infer<typeof SummaryYtdSchema>;
