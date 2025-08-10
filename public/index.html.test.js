import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dom = new JSDOM(html);
const { document } = dom.window;

describe('index.html structure', () => {
  it('has the correct title', () => {
    expect(document.title).toBe('Expense Tracker');
  });

  it('contains the expense form with required fields and disabled submit button', () => {
    const form = document.getElementById('expense-form');
    expect(form).toBeTruthy();

    const dateInput = document.getElementById('date');
    const amountInput = document.getElementById('amount');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');
    const addBtn = document.getElementById('add-expense-btn');
    expect(dateInput).toBeTruthy();
    expect(dateInput.getAttribute('type')).toBe('date');
    expect(amountInput).toBeTruthy();
    expect(descriptionInput).toBeTruthy();
    expect(categoryInput).toBeTruthy();
    expect(categoryInput.tagName).toBe('SELECT');
    expect(addBtn).toBeTruthy();
    expect(addBtn.disabled).toBe(true);
    expect(addBtn?.disabled).toBe(true);
  });

  it('links the stylesheet and module script', () => {
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.getAttribute('href'));
    expect(styleLinks).toContain('styles.css');

    const script = document.querySelector('script[type="module"][src="scripts.js"]');
    expect(script).not.toBeNull();
  });

  it('includes canvases for expense and burndown charts', () => {
    expect(document.getElementById('expense-chart')).not.toBeNull();
    expect(document.getElementById('burndown-chart')).not.toBeNull();
  });
});
