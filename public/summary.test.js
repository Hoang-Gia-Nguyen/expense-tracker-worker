import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createSummaryApp } from './summary.js';

function buildHTML() {
  return `
  <input id="month-picker" />
  <div id="summary-total"></div>
  <canvas id="summary-chart"></canvas>
  `;
}

describe('summary.js', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T00:00:00Z'));
  });

  it('fetches data and renders chart', async () => {
    const dom = new JSDOM(buildHTML(), { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;

    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([
        { category: 'Food', spend_vnd: 1000 },
        { category: 'Home', spend_vnd: 2000 },
      ])
    });
    global.fetch = fetchMock;

    const chartFactory = vi.fn(() => ({ destroy: vi.fn() }));
    global.Chart = chartFactory;

    const domElements = {
      monthPicker: document.getElementById('month-picker'),
      chartCanvas: document.getElementById('summary-chart'),
      totalDiv: document.getElementById('summary-total'),
    };

    createSummaryApp(domElements);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith('/api/summary?year=2024&month=06');
    expect(chartFactory).toHaveBeenCalledTimes(1);
    expect(document.getElementById('summary-total').textContent).toMatch(/3[.,]000/);
  });
});
