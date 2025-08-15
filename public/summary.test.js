import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createSummaryApp } from './summary.js';

function buildHTML() {
  return `
  <div id="category-charts"></div>
  <canvas id="total-chart"></canvas>
  `;
}

describe('summary.js', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-15T00:00:00Z'));
  });

  it('fetches last 6 months and renders charts', async () => {
    const dom = new JSDOM(buildHTML(), { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;

    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([
        { category: 'Food', spend_vnd: 100 },
        { category: 'Medical/Utility', spend_vnd: 200 },
        { category: 'Transportation', spend_vnd: 300 },
        { category: 'Entertainment', spend_vnd: 400 },
      ])
    });
    global.fetch = fetchMock;

    const chartFactory = vi.fn(() => ({}));
    global.Chart = chartFactory;

    const domElements = {
      categoryChartsDiv: document.getElementById('category-charts'),
      totalCanvas: document.getElementById('total-chart'),
    };

    const app = createSummaryApp(domElements);
    await app.fetchAndRender();

    expect(fetchMock).toHaveBeenCalledTimes(6);
    const urls = fetchMock.mock.calls.map(call => call[0]);
    expect(urls).toEqual([
      '/api/summary?year=2024&month=02',
      '/api/summary?year=2024&month=03',
      '/api/summary?year=2024&month=04',
      '/api/summary?year=2024&month=05',
      '/api/summary?year=2024&month=06',
      '/api/summary?year=2024&month=07'
    ]);
    expect(chartFactory).toHaveBeenCalledTimes(5);
    expect(domElements.categoryChartsDiv.querySelectorAll('canvas').length).toBe(4);
    expect(domElements.categoryChartsDiv.querySelectorAll('.chart-container').length).toBe(4);
  });
});
