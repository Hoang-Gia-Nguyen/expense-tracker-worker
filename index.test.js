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
    LOGGING_HABIT: {
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
        await expect(response.json()).resolves.toEqual({ error: 'Missing required query parameters: year, month' });
    });

    it('should return 400 if month is missing', async () => {
        const request = createMockRequest('http://localhost/api/expense?year=2023', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: 'Missing required query parameters: year, month' });
    });

    it('should return 500 if D1 database operation fails', async () => {
        const errorMessage = 'Database connection error';
        mockAll.mockRejectedValueOnce(new Error(errorMessage));

        const request = createMockRequest('http://localhost/api/expense?year=2023&month=01', 'GET', { 'Origin': 'https://expensetracker.hgnlab.org' });
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: errorMessage });
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

describe('GET /api/insights', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAll.mockReset();
        mockBind.mockReset();
        mockPrepare.mockReset();
        mockAll.mockResolvedValue({ results: [] });
    });

    it('should return insights data', async () => {
        const mockDailyResults = [{ Date: '2023-01-01', total: 100 }];
        const mockCategoryResults = [{ category: 'Food', spend_vnd: 500 }];
        const mockTopResults = [{ rowid: 1, Amount: 100, Description: 'Dinner', Category: 'Food', Date: '2023-01-01' }];

        mockAll
            .mockResolvedValueOnce({ results: mockDailyResults })
            .mockResolvedValueOnce({ results: mockCategoryResults })
            .mockResolvedValueOnce({ results: [] }) // For avg spend check
            .mockResolvedValueOnce({ results: mockTopResults });

        const request = createMockRequest('http://localhost/api/insights', 'GET');
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('dailySeries');
        expect(data.topTransactions).toEqual(mockTopResults);
    });

    it('should return 500 if database query fails', async () => {
        mockAll.mockRejectedValueOnce(new Error('Database error'));
        const request = createMockRequest('http://localhost/api/insights', 'GET');
        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(500);
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
        expect(mockEnv.LOGGING_HABIT.writeDataPoint).toHaveBeenCalled();
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
    });
});

describe('PUT /api/expense', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRun.mockResolvedValue({ success: true });
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
    });
});

describe('DELETE /api/expense', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRun.mockResolvedValue({ success: true });
    });

    it('should delete an expense successfully', async () => {
        const expenseToDelete = { id: 1 };
        const request = createMockRequest('http://localhost/api/expense', 'DELETE', { 'Origin': 'https://expensetracker.hgnlab.org', 'Content-Type': 'application/json' }, expenseToDelete);
        const response = await worker.fetch(request, mockEnv);

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('Expense deleted successfully');
    });
});

describe('Catch-all 404', () => {
    it('should return 404 for unmatched routes', async () => {
        const request = createMockRequest('http://localhost/non-existent-route', 'GET');
        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(404);
    });
});
