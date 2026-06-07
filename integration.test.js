// @vitest-environment node
import { Miniflare } from 'miniflare';
import * as esbuild from 'esbuild';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd());
const BUNDLE_PATH = path.join(PROJECT_ROOT, '.test-bundle', 'worker.mjs');

// Split SQL into individual statements, filtering out empty lines and PRAGMAs
function splitSqlStatements(sql) {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.toUpperCase().startsWith('PRAGMA'));
}

describe('API Integration Tests (real D1)', () => {
  let mf;
  let db;

  beforeAll(async () => {
    // Bundle the worker with all dependencies inlined
    await esbuild.build({
      entryPoints: [path.join(PROJECT_ROOT, 'index.js')],
      bundle: true,
      outfile: BUNDLE_PATH,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      sourcemap: false,
      minify: false,
    });

    mf = new Miniflare({
      modules: true,
      modulesRoot: PROJECT_ROOT,
      scriptPath: BUNDLE_PATH,
      compatibilityFlags: ['nodejs_compat'],
      compatibilityDate: '2025-07-27',
      d1Databases: { D1_DATABASE: 'test-db' },
      kvNamespaces: { __STATIC_CONTENT: 'test-kv' },
    });

    // Apply schema using prepare().run() since exec has issues with multi-line DDL
    db = await mf.getD1Database('D1_DATABASE');
    const schema = fs.readFileSync(path.join(PROJECT_ROOT, 'schema.sql'), 'utf8');
    for (const stmt of splitSqlStatements(schema)) {
      await db.prepare(stmt).run();
    }
    // Insert test data with proper datetime format (Zod schema expects ISO 8601 datetime)
    await db.prepare("INSERT INTO expense (Date, Amount, Description, Category) VALUES ('2025-06-15T00:00:00Z', 220000, 'CGV Cinema', 'Entertainment')").run();
    await db.prepare("INSERT INTO expense (Date, Amount, Description, Category) VALUES ('2025-06-20T00:00:00Z', 100000, 'Groceries', 'Food')").run();
    await db.prepare("INSERT INTO expense (Date, Amount, Description, Category) VALUES ('2025-07-05T00:00:00Z', 500000, 'Rent', 'Home')").run();
    await db.prepare("INSERT INTO expense (Date, Amount, Description, Category) VALUES ('2025-07-10T00:00:00Z', 150000, 'Gas', 'Transportation')").run();
    await db.prepare("INSERT INTO expense (Date, Amount, Description, Category) VALUES ('2025-08-01T00:00:00Z', 2000000, 'School Fee', 'Baby')").run();
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it('GET /api/expense returns expenses for a valid month with correct casing', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense?year=2025&month=06');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);

    // Verify lowercase keys from SQL aliasing
    const expense = data[0];
    expect(expense).toHaveProperty('rowid');
    expect(expense).toHaveProperty('date');
    expect(expense).toHaveProperty('amount');
    expect(expense).toHaveProperty('description');
    expect(expense).toHaveProperty('category');
    // Verify NOT uppercase (regression check)
    expect(expense.Date).toBeUndefined();
    expect(expense.Amount).toBeUndefined();
  });

  it('GET /api/expense returns empty array for month with no data', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense?year=2020&month=01');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it('GET /api/expense returns 400 for missing params', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense?year=2025');
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing required');
  });

  it('GET /api/summary returns category spend for a month', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/summary?year=2025&month=06');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('category');
    expect(data[0]).toHaveProperty('spend_vnd');
  });

  it('GET /api/summary returns 400 for missing params', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/summary?month=06');
    expect(res.status).toBe(400);
  });

  it('GET /api/insights returns insights data with correct structure', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/insights');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveProperty('dailySeries');
    expect(data).toHaveProperty('dailySpikes');
    expect(data).toHaveProperty('categorySpikes');
    expect(data).toHaveProperty('topTransactions');

    expect(Array.isArray(data.dailySeries)).toBe(true);
    expect(data.dailySeries.length).toBe(30);
    expect(data.dailySeries[0]).toHaveProperty('date');
    expect(data.dailySeries[0]).toHaveProperty('total');

    // Category spikes should exist since data spans multiple months
    expect(Array.isArray(data.categorySpikes)).toBe(true);

    // Verify lowercase keys on topTransactions
    if (data.topTransactions.length > 0) {
      const tx = data.topTransactions[0];
      expect(tx).toHaveProperty('date');
      expect(tx).toHaveProperty('amount');
      expect(tx).toHaveProperty('description');
      expect(tx).toHaveProperty('category');
      expect(tx.Date).toBeUndefined();
      expect(tx.Amount).toBeUndefined();
    }
  });

  it('GET /api/config returns frontend configuration', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/config');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('apiUrl');
    expect(data).toHaveProperty('monthlyBudget');
    expect(data).toHaveProperty('totalBudget');
    expect(data).toHaveProperty('categoryConfig');
    expect(data).toHaveProperty('categoryOrder');
  });

  let createdExpenseId;

  it('POST /api/expense creates a new expense', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-06-07T00:00:00Z',
        amount: 250000,
        description: 'Integration test lunch',
        category: 'Food',
      }),
    });
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('Expense added successfully');

    // Verify it was inserted
    const getRes = await mf.dispatchFetch('http://localhost/api/expense?year=2026&month=06');
    const expenses = await getRes.json();
    const inserted = expenses.find(e => e.description === 'Integration test lunch');
    expect(inserted).toBeDefined();
    expect(inserted.amount).toBe(250000);
    expect(inserted.category).toBe('Food');
    expect(inserted.date).toBe('2026-06-07T00:00:00Z');
    createdExpenseId = inserted.rowid;
  });

  it('POST /api/expense returns 400 for missing fields', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-06-07T00:00:00Z', amount: 100 }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /api/expense updates the created expense', async () => {
    expect(createdExpenseId).toBeDefined();

    const res = await mf.dispatchFetch('http://localhost/api/expense', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: createdExpenseId,
        date: '2026-06-07T00:00:00Z',
        amount: 999999,
        description: 'Updated lunch',
        category: 'Entertainment',
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Expense updated successfully');

    // Verify update
    const getRes = await mf.dispatchFetch('http://localhost/api/expense?year=2026&month=06');
    const expenses = await getRes.json();
    const updated = expenses.find(e => e.rowid === createdExpenseId);
    expect(updated).toBeDefined();
    expect(updated.amount).toBe(999999);
    expect(updated.description).toBe('Updated lunch');
    expect(updated.category).toBe('Entertainment');
  });

  it('PUT /api/expense returns 400 for missing id', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-06-07T00:00:00Z', amount: 100, description: 'test', category: 'Food' }),
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/expense deletes the created expense', async () => {
    expect(createdExpenseId).toBeDefined();

    const res = await mf.dispatchFetch('http://localhost/api/expense', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: createdExpenseId }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Expense deleted successfully');

    // Verify deletion
    const getRes = await mf.dispatchFetch('http://localhost/api/expense?year=2026&month=06');
    const expenses = await getRes.json();
    const deleted = expenses.find(e => e.rowid === createdExpenseId);
    expect(deleted).toBeUndefined();
  });

  it('DELETE /api/expense returns 404 for non-existent id', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 999999 }),
    });
    expect(res.status).toBe(404);
  });

  it('CORS headers are present on API responses for allowed origins', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense?year=2025&month=06', {
      headers: { Origin: 'http://localhost:8787' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8787');
  });

  it('CORS returns null origin for disallowed origins', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense?year=2025&month=06', {
      headers: { Origin: 'https://evil.com' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });

  it('OPTIONS preflight returns 204 with CORS headers', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/expense', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8787',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8787');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
  });

  it('non-API routes return 404', async () => {
    const res = await mf.dispatchFetch('http://localhost/nonexistent');
    expect(res.status).toBe(404);
  });

  it('D1 schema views exist and are queryable', async () => {
    const stmt = db.prepare('SELECT COUNT(*) as cnt FROM v_monthly_category_spend WHERE year_month = ?');
    const { results } = await stmt.bind('2025-06').all();
    expect(Number(results[0].cnt)).toBeGreaterThan(0);
  });
});
