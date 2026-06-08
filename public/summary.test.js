import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createSummaryApp } from './summary/summary.js';

function buildHTML() {
  return `
  <div id="category-charts"></div>
  <div id="metric-total-current"></div>
  <div id="metric-avg"></div>
  <div id="metric-change"></div>
  <div id="metric-top-category"></div>
  <div id="metric-top-value"></div>
  <canvas id="trends-chart"></canvas>
  <canvas id="breakdown-chart"></canvas>
  <canvas id="total-chart"></canvas>
  <div id="category-charts"></div>
  <canvas id="comparison-chart"></canvas>
  <div id="category-table-section" class="d-none">
    <table><tbody id="category-table-body"></tbody></table>
  </div>
  <div id="top-transactions-section" class="d-none">
    <table><tbody id="top-transactions-body"></tbody></table>
  </div>
  <div id="ytd-section" class="d-none">
    <canvas id="ytd-monthly-chart"></canvas>
    <canvas id="ytd-category-chart"></canvas>
  </div>
  `;
}

function createMockChart() {
  return { destroy: vi.fn() };
}

/**
 * Create a mock fetch that returns canned data based on URL
 */
function createMockFetch() {
  return vi.fn((url) => {
    if (url.includes('/api/summary/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          totalSpent: 15000000,
          avgDaily: 500000,
          transactionCount: 30,
          biggestCategory: { name: 'Home', amount: 5000000 },
          vsLastMonth: { amount: 2000000, percent: 15.3 },
        }),
      });
    }
    if (url.includes('/api/summary/categories')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { category: 'Home', spend_vnd: 5000000, percentOfTotal: 33.33, vsLastMonth: 1000000 },
          { category: 'Food', spend_vnd: 3000000, percentOfTotal: 20.00, vsLastMonth: -500000 },
          { category: 'Medical/Utility', spend_vnd: 2500000, percentOfTotal: 16.67, vsLastMonth: 200000 },
          { category: 'Transportation', spend_vnd: 2000000, percentOfTotal: 13.33, vsLastMonth: 300000 },
          { category: 'Entertainment', spend_vnd: 1500000, percentOfTotal: 10.00, vsLastMonth: -100000 },
          { category: 'Other', spend_vnd: 1000000, percentOfTotal: 6.67, vsLastMonth: 400000 },
        ]),
      });
    }
    if (url.includes('/api/summary/top-transactions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { rowid: 1, date: '2024-07-15', amount: 2000000, description: 'Rent', category: 'Home' },
          { rowid: 2, date: '2024-07-20', amount: 500000, description: 'Groceries', category: 'Food' },
        ]),
      });
    }
    if (url.includes('/api/summary/comparison')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { category: 'Home', current: 5000000, previous: 4000000 },
          { category: 'Food', current: 3000000, previous: 3500000 },
          { category: 'Medical/Utility', current: 2500000, previous: 2300000 },
          { category: 'Transportation', current: 2000000, previous: 1700000 },
          { category: 'Entertainment', current: 1500000, previous: 1600000 },
          { category: 'Other', current: 1000000, previous: 600000 },
        ]),
      });
    }
    if (url.includes('/api/summary/ytd')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          totalSpent: 80000000,
          monthlyBreakdown: [
            { year_month: '2024-01', total: 10000000 },
            { year_month: '2024-02', total: 12000000 },
            { year_month: '2024-03', total: 9000000 },
            { year_month: '2024-04', total: 11000000 },
            { year_month: '2024-05', total: 13000000 },
            { year_month: '2024-06', total: 10000000 },
            { year_month: '2024-07', total: 15000000 },
          ],
          categoryBreakdown: [
            { category: 'Home', total: 30000000 },
            { category: 'Food', total: 15000000 },
            { category: 'Medical/Utility', total: 12000000 },
            { category: 'Transportation', total: 10000000 },
            { category: 'Entertainment', total: 8000000 },
            { category: 'Other', total: 5000000 },
          ],
        }),
      });
    }
    // For multi-month summary (original 6-month data)
    if (url.includes('/api/summary?year=')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { category: 'Food', spend_vnd: 100 },
          { category: 'Medical/Utility', spend_vnd: 200 },
          { category: 'Transportation', spend_vnd: 300 },
          { category: 'Entertainment', spend_vnd: 400 },
        ]),
      });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe('summary.js', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-15T00:00:00Z'));
  });

  it('fetches last 7 months and renders summary charts', async () => {
    const dom = new JSDOM(buildHTML(), { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;

    const fetchMock = createMockFetch();
    global.fetch = fetchMock;

    const chartFactory = vi.fn(createMockChart);
    global.Chart = chartFactory;

    const domElements = {
      monthPicker: document.getElementById('month-picker'),
      loadingSpinner: document.getElementById('loading-spinner'),
      errorMessage: document.getElementById('error-message'),
      statsCards: document.getElementById('stats-cards'),
      doughnutCanvas: document.getElementById('doughnut-chart'),
      totalCanvas: document.getElementById('total-chart'),
      categoryChartsDiv: document.getElementById('category-charts'),
      comparisonCanvas: document.getElementById('comparison-chart'),
      categoryTableSection: document.getElementById('category-table-section'),
      categoryTableBody: document.getElementById('category-table-body'),
      topTransactionsSection: document.getElementById('top-transactions-section'),
      topTransactionsBody: document.getElementById('top-transactions-body'),
      ytdSection: document.getElementById('ytd-section'),
      ytdMonthlyCanvas: document.getElementById('ytd-monthly-chart'),
      ytdCategoryCanvas: document.getElementById('ytd-category-chart'),
    };

    const app = createSummaryApp(domElements);
    await app.init();

    expect(fetchMock).toHaveBeenCalledTimes(7);
    const urls = fetchMock.mock.calls.map(call => call[0]);
    expect(urls).toEqual([
      '/api/summary?year=2024&month=02',
      '/api/summary?year=2024&month=03',
      '/api/summary?year=2024&month=04',
      '/api/summary?year=2024&month=05',
      '/api/summary?year=2024&month=06',
      '/api/summary?year=2024&month=07',
      '/api/summary?year=2024&month=08'
    ]);
    expect(chartFactory).toHaveBeenCalledTimes(2);
    // Code no longer creates individual category charts
    expect(domElements.categoryChartsDiv.querySelectorAll('canvas').length).toBe(0);
  });
});
