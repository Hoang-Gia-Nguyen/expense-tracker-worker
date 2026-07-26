import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from './index'; // Import your worker's default export

// Mock the D1_DATABASE methods explicitly
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({
    all: mockAll,
    run: mockRun,
}));
const mockPrepare = vi.fn(() => ({
    bind: mockBind,
}));

const mockD1Database = {
    prepare: mockPrepare,
};

// Mock the Cloudflare environment (env)


const mockEnv = {
    D1_DATABASE: mockD1Database,
    __STATIC_CONTENT: {}, // Mock for KV asset handler
    __STATIC_CONTENT_MANIFEST: {}, // Mock for KV asset handler
    waitUntil: vi.fn(), // Mock waitUntil for getAssetFromKV
    ANALYTICS_TEST: {
        writeDataPoint: vi.fn(),
    },
};

// Helper function to create a mock Request
const createMockRequest = (url, method = 'GET', headers = {}, body = null) => {
    const options = { method, headers };
    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }
    return new Request(url, options);
};

describe('GET /api/expense', () => {
    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
        mockAll.mockReset();
        mockRun.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();

        // Set default mock for D1_DATABASE.prepare().bind().all()
        mockAll.mockResolvedValue({ results: [] });
        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
    });

    it('should return expenses for a valid year and month', async () => {
        const mockExpenses = [
            { rowid: 1, date: '2023-01-15T00:00:00Z', amount: 50, description: 'Groceries', category: 'Food' },
            { rowid: 2, date: '2023-01-20T00:00:00Z', amount: 25, description: 'Coffee', category: 'Drinks' },
        ];
        mockAll.mockResolvedValueOnce({ results: [
            { rowid: 1, date: '2023-01-15T00:00:00Z', amount: 50, description: 'Groceries', category: 'Food' },
            { rowid: 2, date: '2023-01-20T00:00:00Z', amount: 25, description: 'Coffee', category: 'Drinks' },
        ] });

        const request = createMockRequest('http://localhost/api/expense?year=2023&month=01', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://expensetracker.hgnlab.org');
        await expect(response.json()).resolves.toEqual(mockExpenses);
        expect(mockPrepare).toHaveBeenCalledWith("SELECT rowid, Date AS date, Amount AS amount, Description AS description, Category AS category FROM expense WHERE strftime('%Y', Date) = ? AND strftime('%m', Date) = ?");
        expect(mockBind).toHaveBeenCalledWith('2023', '01');
    });

    it('should return an empty array if no expenses are found', async () => {
        // Default mockAll already returns empty results
        const request = createMockRequest('http://localhost/api/expense?year=2024&month=07', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8787');
        await expect(response.json()).resolves.toEqual([]);
    });

    it('should return 400 if year is missing', async () => {
        const request = createMockRequest('http://localhost/api/expense?month=01', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toBe('Missing required query parameters: year, month');
    });

    it('should return 400 if month is missing', async () => {
        const request = createMockRequest('http://localhost/api/expense?year=2023', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toBe('Missing required query parameters: year, month');
    });

    it('should return 500 if D1 database operation fails', async () => {
        const errorMessage = 'Database connection error';
        mockAll.mockRejectedValueOnce(new Error(errorMessage));

        const request = createMockRequest('http://localhost/api/expense?year=2023&month=01', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(500);
        await expect(response.text()).resolves.toBe(`An error occurred: ${errorMessage}`);
    });

    it('should return 200 with Access-Control-Allow-Origin: null for disallowed origin', async () => {
        const request = createMockRequest('http://localhost/api/expense?year=2023&month=01', 'GET', { 'Origin': 'https://malicious.com' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('null');
    });

    describe('CORS Preflight (OPTIONS) requests', () => {
        it('should return 204 with correct CORS headers for allowed origin', async () => {
            const request = createMockRequest('http://localhost/api/expense', 'OPTIONS', {
                'Origin': 'https://expensetracker.hgnlab.org',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type',
            });
            const response = await worker.fetch(request, mockEnv);

            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://expensetracker.hgnlab.org');
            expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
            expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
        });

        it('should return 204 with Access-Control-Allow-Origin: null for disallowed origin', async () => {
            const request = createMockRequest('http://localhost/api/expense', 'OPTIONS', {
                'Origin': 'https://malicious.com',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type',
            });
            const response = await worker.fetch(request, mockEnv);

            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('null');
            // Corrected expectation: These headers should NOT be present for disallowed origins
            expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull();
            expect(response.headers.get('Access-Control-Allow-Headers')).toBeNull();
        });
    });
});

describe('GET /api/summary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
        mockAll.mockResolvedValue({ results: [] });
    });

    it('returns monthly category spend', async () => {
        const mockSummary = [
            { category: 'Food', spend_vnd: 1000 },
            { category: 'Home', spend_vnd: 2000 },
        ];
        mockAll.mockResolvedValueOnce({ results: mockSummary });

        const request = createMockRequest('http://localhost/api/summary?year=2023&month=01', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(mockSummary);
        expect(mockPrepare).toHaveBeenCalledWith('SELECT category, spend_vnd FROM v_monthly_category_spend WHERE year_month = ?');
        expect(mockBind).toHaveBeenCalledWith('2023-01');
    });

    it('returns 400 for missing params', async () => {
        const request = createMockRequest('http://localhost/api/summary?year=2023', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(400);
    });
});


describe('GET /api/summary/stats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
    });

    it('returns monthly stats with all fields', async () => {
        mockAll
            .mockResolvedValueOnce({ results: [{ total_spent: 10000000, transaction_count: 25 }] })
            .mockResolvedValueOnce({ results: [{ category: 'Home', spend_vnd: 5000000 }] })
            .mockResolvedValueOnce({ results: [{ total_spent: 8000000 }] });

        const request = createMockRequest('http://localhost/api/summary/stats?year=2024&month=07', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.totalSpent).toBe(10000000);
        expect(data.avgDaily).toBeGreaterThan(0);
        expect(data.transactionCount).toBe(25);
        expect(data.biggestCategory.name).toBe('Home');
        expect(data.biggestCategory.amount).toBe(5000000);
        expect(data.vsLastMonth.amount).toBe(2000000);
        expect(typeof data.vsLastMonth.percent).toBe('number');
    });

    it('returns 400 for missing params', async () => {
        const request = createMockRequest('http://localhost/api/summary/stats?year=2024', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(400);
    });
});

describe('GET /api/summary/categories', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
    });

    it('returns all categories with percentages and vs last month', async () => {
        mockAll
            .mockResolvedValueOnce({ results: [
                { category: 'Home', spend_vnd: 5000000 },
                { category: 'Food', spend_vnd: 3000000 },
            ]})
            .mockResolvedValueOnce({ results: [
                { category: 'Home', spend_vnd: 4000000 },
                { category: 'Food', spend_vnd: 3500000 },
            ]});

        const request = createMockRequest('http://localhost/api/summary/categories?year=2024&month=07', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.length).toBe(2);
        expect(data[0].category).toBe('Home');
        expect(data[0].spend_vnd).toBe(5000000);
        expect(data[0].percentOfTotal).toBeCloseTo(62.5, 1);
        expect(data[0].vsLastMonth).toBe(1000000);
    });
});

describe('GET /api/summary/comparison', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
    });

    it('returns month-over-month comparison per category', async () => {
        mockAll
            .mockResolvedValueOnce({ results: [
                { category: 'Home', spend_vnd: 5000000 },
                { category: 'Food', spend_vnd: 3000000 },
            ]})
            .mockResolvedValueOnce({ results: [
                { category: 'Home', spend_vnd: 4000000 },
                { category: 'Food', spend_vnd: 3500000 },
            ]});

        const request = createMockRequest('http://localhost/api/summary/comparison?year=2024&month=07', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.length).toBe(2);
        const home = data.find(d => d.category === 'Home');
        expect(home.current).toBe(5000000);
        expect(home.previous).toBe(4000000);
    });
});

describe('GET /api/summary/top-transactions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
        mockAll.mockResolvedValue({ results: [] });
    });

    it('returns top transactions for a given month', async () => {
        mockAll.mockResolvedValueOnce({ results: [
            { rowid: 1, date: '2024-07-15', amount: 2000000, description: 'Rent', category: 'Home' },
            { rowid: 2, date: '2024-07-20', amount: 500000, description: 'Groceries', category: 'Food' },
        ]});

        const request = createMockRequest('http://localhost/api/summary/top-transactions?year=2024&month=07&limit=5', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.length).toBe(2);
        expect(data[0].description).toBe('Rent');
    });
});

describe('GET /api/summary/ytd', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
    });

    it('returns year-to-date overview', async () => {
        mockAll
            .mockResolvedValueOnce({ results: [
                { year_month: '2024-01', total: 10000000 },
                { year_month: '2024-02', total: 12000000 },
            ]})
            .mockResolvedValueOnce({ results: [
                { category: 'Home', total: 5000000 },
                { category: 'Food', total: 3000000 },
            ]});

        const request = createMockRequest('http://localhost/api/summary/ytd?year=2024', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.totalSpent).toBe(22000000);
        expect(data.monthlyBreakdown.length).toBe(2);
        expect(data.categoryBreakdown.length).toBe(2);
    });
});


// Test for static asset serving (basic check)
describe('Static Asset Serving', () => {
    it('should return 404 for non-existent asset after fall-through', async () => {
        // Mock getAssetFromKV to throw an error for a non-existent asset
        vi.mock('@cloudflare/kv-asset-handler', async (importOriginal) => {
            const actual = await importOriginal();
            return {
                ...actual,
                getAssetFromKV: vi.fn(() => {
                    throw new Error('Asset not found'); // Simulate asset not found
                }),
            };
        });

        const request = createMockRequest('http://localhost/non-existent-asset.html');
        const response = await worker.fetch(request, mockEnv);

        // Corrected expectation: The request falls through to the 404 handler
        expect(response.status).toBe(404);
        await expect(response.text()).resolves.toBe('404, not found!');
    });
});

describe('POST /api/expense', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
        mockPrepare.mockReset();
        mockBind.mockReset();
    });

    it('should add a new expense successfully', async () => {
        const newExpense = {
            date: '2023-08-01T00:00:00Z',
            amount: 100,
            description: 'New Book',
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'POST', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, newExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(201);
        await expect(response.text()).resolves.toBe('Expense added successfully');
        expect(mockPrepare).toHaveBeenCalledWith('INSERT INTO expense (Date, Amount, Description, Category) VALUES (?, ?, ?, ?)');
        expect(mockBind).toHaveBeenCalledWith(newExpense.date, newExpense.amount, newExpense.description, newExpense.category);
        expect(mockRun).toHaveBeenCalled();
    });

    it('should return 400 if required fields are missing', async () => {
        const incompleteExpense = {
            date: '2023-08-01T00:00:00Z',
            amount: 100,
            description: 'New Book',
            // category is missing
        };
        const request = createMockRequest('http://localhost/api/expense', 'POST', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, incompleteExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toContain('Validation Error');
    });

    it('should return 400 if amount is not a number', async () => {
        const invalidExpense = {
            date: '2023-08-01T00:00:00Z',
            amount: 'one hundred', // Invalid type
            description: 'New Book',
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'POST', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, invalidExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toContain('Validation Error');
    });

    it('should return 500 if D1 database operation fails', async () => {
        const errorMessage = 'Database insert error';
        mockRun.mockRejectedValueOnce(new Error(errorMessage));

        const newExpense = {
            date: '2023-08-01T00:00:00Z',
            amount: 100,
            description: 'New Book',
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'POST', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, newExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(500);
        await expect(response.text()).resolves.toBe(`An error occurred: ${errorMessage}`);
    });
});

describe('PUT /api/expense', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
        mockPrepare.mockReset();
        mockBind.mockReset();
    });

    it('should update an existing expense successfully', async () => {
        const updatedExpense = {
            id: 1,
            date: '2023-08-01T00:00:00Z',
            amount: 120,
            description: 'Updated Book',
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'PUT', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, updatedExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('Expense updated successfully');
        expect(mockPrepare).toHaveBeenCalledWith('UPDATE expense SET Date = ?, Amount = ?, Description = ?, Category = ? WHERE rowid = ?');
        expect(mockBind).toHaveBeenCalledWith(updatedExpense.date, updatedExpense.amount, updatedExpense.description, updatedExpense.category, updatedExpense.id);
        expect(mockRun).toHaveBeenCalled();
    });

    it('should return 400 if required fields are missing', async () => {
        const incompleteUpdate = {
            id: 1,
            date: '2023-08-01T00:00:00Z',
            amount: 120,
            // description is missing
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'PUT', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, incompleteUpdate);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toContain('Validation Error');
    });

    it('should return 400 if amount is not a number', async () => {
        const invalidUpdate = {
            id: 1,
            date: '2023-08-01T00:00:00Z',
            amount: 'one twenty', // Invalid type
            description: 'Updated Book',
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'PUT', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, invalidUpdate);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toContain('Validation Error');
    });

    it('should return 500 if D1 database operation fails', async () => {
        const errorMessage = 'Database update error';
        mockRun.mockRejectedValueOnce(new Error(errorMessage));

        const updatedExpense = {
            id: 1,
            date: '2023-08-01T00:00:00Z',
            amount: 120,
            description: 'Updated Book',
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'PUT', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, updatedExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(500);
        await expect(response.text()).resolves.toBe(`An error occurred: ${errorMessage}`);
    });
});

describe('DELETE /api/expense', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
        mockPrepare.mockReset();
        mockBind.mockReset();
    });

    it('should delete an expense successfully', async () => {
        const expenseToDelete = { id: 1 };
        mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // Explicitly mock for this test

        const request = createMockRequest('http://localhost/api/expense', 'DELETE', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, expenseToDelete);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('Expense deleted successfully');
        expect(mockPrepare).toHaveBeenCalledWith("DELETE FROM expense WHERE rowid = ?");
        expect(mockBind).toHaveBeenCalledWith(expenseToDelete.id);
        expect(mockRun).toHaveBeenCalled();
    });

    it('should return 400 if id is missing', async () => {
        const incompleteDelete = { /* id is missing */ };
        const request = createMockRequest('http://localhost/api/expense', 'DELETE', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, incompleteDelete);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toContain('Validation Error');
    });

    it('should return 404 if expense to delete is not found', async () => {
        const expenseToDelete = { id: 999 }; // Non-existent ID
        mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 0 } }); // Simulate no rows affected

        const request = createMockRequest('http://localhost/api/expense', 'DELETE', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, expenseToDelete);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(404);
        await expect(response.text()).resolves.toBe('404, not found!');
    });

    it('should return 500 if D1 database operation fails', async () => {
        const errorMessage = 'Database delete error';
        mockRun.mockRejectedValueOnce(new Error(errorMessage));

        const expenseToDelete = { id: 1 };
        const request = createMockRequest('http://localhost/api/expense', 'DELETE', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, expenseToDelete);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(500);
        await expect(response.text()).resolves.toBe(`An error occurred: ${errorMessage}`);
    });
});

describe('PATCH /api/expenses/category', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockRun.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
        mockRun.mockResolvedValue({ success: true, meta: { changes: 3 } });
    });

    it('should reassign expenses from one category to another', async () => {
        const request = createMockRequest('http://localhost/api/expenses/category', 'PATCH', { 'Content-Type': 'application/json' }, { oldCategory: 'OldCat', newCategory: 'Uncategorized' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.updated).toBe(3);
        expect(body.message).toContain('OldCat');
        expect(body.message).toContain('Uncategorized');
        expect(mockPrepare).toHaveBeenCalledWith('UPDATE expense SET Category = ? WHERE Category = ?');
        expect(mockBind).toHaveBeenCalledWith('Uncategorized', 'OldCat');
    });

    it('should return 400 for missing fields', async () => {
        const request = createMockRequest('http://localhost/api/expenses/category', 'PATCH', { 'Content-Type': 'application/json' }, {});
        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(400);
    });

    it('should return 400 for empty oldCategory', async () => {
        const request = createMockRequest('http://localhost/api/expenses/category', 'PATCH', { 'Content-Type': 'application/json' }, { oldCategory: '', newCategory: 'Uncategorized' });
        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(400);
    });
});




describe('GET /api/big-expenses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockRun.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
        mockAll.mockResolvedValue({ results: [] });
        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
    });

    it('should return big expenses for a valid year', async () => {
        const mockItems = [
            { rowid: 1, date: '2025-03-15', amount: 50000000, description: 'Sửa nhà', category: 'Home Renovation' },
            { rowid: 2, date: '2025-06-20', amount: 12000000, description: 'Máy giặt', category: 'Appliance' },
        ];
        mockAll.mockResolvedValueOnce({ results: mockItems });

        const request = createMockRequest('http://localhost/api/big-expenses?year=2025', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.items).toEqual(mockItems);
        expect(body.total).toBe(62000000);
        expect(mockPrepare).toHaveBeenCalledWith(
            expect.stringContaining("FROM big_expense WHERE strftime('%Y', Date) = ?")
        );
        expect(mockBind).toHaveBeenCalledWith('2025');
    });

    it('should return empty list and total 0 if no big expenses found', async () => {
        const request = createMockRequest('http://localhost/api/big-expenses?year=2024', 'GET', { 'Origin': 'http://localhost:8787' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.items).toEqual([]);
        expect(body.total).toBe(0);
    });

    it('should return 400 if year missing', async () => {
        const request = createMockRequest('http://localhost/api/big-expenses', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toBe('Missing required query parameter: year');
    });

    it('should return 500 if D1 database operation fails', async () => {
        mockAll.mockRejectedValueOnce(new Error('Database error'));
        const request = createMockRequest('http://localhost/api/big-expenses?year=2025', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(500);
    });
});

describe('POST /api/big-expenses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockRun.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
    });

    it('should add a new big expense', async () => {
        const newExpense = { date: '2025-03-15', amount: 50000000, description: 'Sửa nhà', category: 'Home Renovation' };
        const request = createMockRequest('http://localhost/api/big-expenses', 'POST', { 'Content-Type': 'application/json' }, newExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(201);
        await expect(response.text()).resolves.toBe('Big expense added successfully');
        expect(mockPrepare).toHaveBeenCalledWith('INSERT INTO big_expense (Date, Amount, Description, Category) VALUES (?, ?, ?, ?)');
        expect(mockBind).toHaveBeenCalledWith('2025-03-15', 50000000, 'Sửa nhà', 'Home Renovation');
    });

    it('should return 400 if required fields missing', async () => {
        const request = createMockRequest('http://localhost/api/big-expenses', 'POST', { 'Content-Type': 'application/json' }, {});
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toContain('Validation Error');
    });
});

describe('PUT /api/big-expenses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockRun.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
    });

    it('should update a big expense', async () => {
        const updateData = { id: 1, date: '2025-03-16', amount: 55000000, description: 'Sửa nhà - thêm cửa', category: 'Home Renovation' };
        const request = createMockRequest('http://localhost/api/big-expenses', 'PUT', { 'Content-Type': 'application/json' }, updateData);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('Big expense updated successfully');
        expect(mockPrepare).toHaveBeenCalledWith(
            'UPDATE big_expense SET Date = ?, Amount = ?, Description = ?, Category = ? WHERE rowid = ?'
        );
    });

    it('should return 404 if expense not found', async () => {
        mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 0 } });
        const updateData = { id: 999, date: '2025-03-16', amount: 55000000, description: 'Test', category: 'Test' };
        const request = createMockRequest('http://localhost/api/big-expenses', 'PUT', { 'Content-Type': 'application/json' }, updateData);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(404);
    });
});

describe('DELETE /api/big-expenses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockRun.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
    });

    it('should delete a big expense', async () => {
        const request = createMockRequest('http://localhost/api/big-expenses', 'DELETE', { 'Content-Type': 'application/json' }, { id: 1 });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('Big expense deleted successfully');
        expect(mockPrepare).toHaveBeenCalledWith('DELETE FROM big_expense WHERE rowid = ?');
    });

    it('should return 404 if expense not found', async () => {
        mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 0 } });
        const request = createMockRequest('http://localhost/api/big-expenses', 'DELETE', { 'Content-Type': 'application/json' }, { id: 999 });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(404);
    });
});


describe('Catch-all 404', () => {
    it('should return 404 for unmatched routes', async () => {
        const request = createMockRequest('http://localhost/non-existent-route', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(404);
        await expect(response.text()).resolves.toBe('404, not found!');
    });
});
