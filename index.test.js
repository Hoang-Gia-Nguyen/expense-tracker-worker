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
    const request = new Request(url, { method, headers });
    if (body) {
        request.json = () => Promise.resolve(body);
    }
    return request;
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
        mockRun.mockResolvedValue({ success: true });
    });

    it('should return expenses for a valid year and month', async () => {
        const mockExpenses = [
            { rowid: 1, Date: '2023-01-15', Amount: 50, Description: 'Groceries', Category: 'Food' },
            { rowid: 2, Date: '2023-01-20', Amount: 25, Description: 'Coffee', Category: 'Drinks' },
        ];
        mockAll.mockResolvedValueOnce({ results: mockExpenses });

        const request = createMockRequest('http://localhost/api/expense?year=2023&month=01', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://expensetracker.hgnlab.org');
        await expect(response.json()).resolves.toEqual(mockExpenses);
        expect(mockPrepare).toHaveBeenCalledWith("SELECT rowid, Date, Amount, Description, Category FROM expense WHERE strftime('%Y', Date) = ? AND strftime('%m', Date) = ?");
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
        mockRun.mockResolvedValue({ success: true });
        mockPrepare.mockReset();
        mockBind.mockReset();
    });

    it('should add a new expense successfully', async () => {
        const newExpense = {
            date: '2023-08-01',
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
            date: '2023-08-01',
            amount: 100,
            description: 'New Book',
            // category is missing
        };
        const request = createMockRequest('http://localhost/api/expense', 'POST', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, incompleteExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toBe('Missing required fields');
    });

    it('should return 400 if amount is not a number', async () => {
        const invalidExpense = {
            date: '2023-08-01',
            amount: 'one hundred', // Invalid type
            description: 'New Book',
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'POST', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, invalidExpense);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toBe('Amount must be an integer');
    });

    it('should return 500 if D1 database operation fails', async () => {
        const errorMessage = 'Database insert error';
        mockRun.mockRejectedValueOnce(new Error(errorMessage));

        const newExpense = {
            date: '2023-08-01',
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
        mockRun.mockResolvedValue({ success: true });
        mockPrepare.mockReset();
        mockBind.mockReset();
    });

    it('should update an existing expense successfully', async () => {
        const updatedExpense = {
            id: 1,
            date: '2023-08-01',
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
            date: '2023-08-01',
            amount: 120,
            // description is missing
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'PUT', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, incompleteUpdate);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toBe('Missing required fields');
    });

    it('should return 400 if amount is not a number', async () => {
        const invalidUpdate = {
            id: 1,
            date: '2023-08-01',
            amount: 'one twenty', // Invalid type
            description: 'Updated Book',
            category: 'Education',
        };
        const request = createMockRequest('http://localhost/api/expense', 'PUT', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, invalidUpdate);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.text()).resolves.toBe('Amount must be an integer');
    });

    it('should return 500 if D1 database operation fails', async () => {
        const errorMessage = 'Database update error';
        mockRun.mockRejectedValueOnce(new Error(errorMessage));

        const updatedExpense = {
            id: 1,
            date: '2023-08-01',
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
        mockRun.mockResolvedValue({ success: true });
        mockPrepare.mockReset();
        mockBind.mockReset();
    });

    it('should delete an expense successfully', async () => {
        const expenseToDelete = { id: 1 };
        mockRun.mockResolvedValueOnce({ success: true }); // Explicitly mock for this test

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
        await expect(response.text()).resolves.toBe('Missing required field: id');
    });

    it('should return 404 if expense to delete is not found', async () => {
        const expenseToDelete = { id: 999 }; // Non-existent ID
        mockRun.mockResolvedValueOnce({ success: false }); // Simulate no rows affected

        const request = createMockRequest('http://localhost/api/expense', 'DELETE', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, expenseToDelete);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(404);
        await expect(response.text()).resolves.toBe('Failed to delete expense or not found');
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

describe('Catch-all 404', () => {
    it('should return 404 for unmatched routes', async () => {
        const request = createMockRequest('http://localhost/non-existent-route', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(404);
        await expect(response.text()).resolves.toBe('404, not found!');
    });
});