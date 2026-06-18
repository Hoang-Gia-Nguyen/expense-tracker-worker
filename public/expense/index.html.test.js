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
    // Category options are now populated dynamically by settings.js
    expect(categoryInput.querySelectorAll('option').length).toBe(1);
    expect(categoryInput.querySelector('option').value).toBe('');
    expect(addBtn).toBeTruthy();
    expect(addBtn.disabled).toBe(true);
    expect(addBtn?.disabled).toBe(true);
  });

  it('links the stylesheet and module script', () => {
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.getAttribute('href'));
    expect(styleLinks).toContain('/styles.css');

    const script = document.querySelector('script[type="module"][src="/scripts.js"]');
    expect(script).not.toBeNull();
  });

  it('includes canvases for expense and burndown charts', () => {
    expect(document.getElementById('expense-chart')).not.toBeNull();
    expect(document.getElementById('burndown-chart')).not.toBeNull();
  });

  it('renders navigation links, theme toggle, and settings button', () => {
    const navLinks = Array.from(document.querySelectorAll('nav .nav-link')).map(a => a.getAttribute('href'));
    expect(navLinks).toEqual(['/expense', '/summary', '/insights']);
    const themeToggle = document.getElementById('theme-toggle-btn');
    expect(themeToggle).toBeTruthy();
    expect(themeToggle.querySelector('i').classList.contains('bi-sun-fill')).toBe(true);
    const settingsBtn = document.getElementById('settings-btn');
    expect(settingsBtn).toBeTruthy();
  });

  it('includes the settings.js module script', () => {
    const script = document.querySelector('script[type="module"][src="/settings.js"]');
    expect(script).not.toBeNull();
  });

  it('contains the expense-card-list container', () => {
    const cardList = document.getElementById('expense-card-list');
    expect(cardList).toBeTruthy();
    expect(cardList.tagName).toBe('DIV');
    expect(cardList.id).toBe('expense-card-list');
  });

  it('includes AI suggestion badges for category fields', () => {
    const aiBadge = document.getElementById('ai-suggestion-badge');
    expect(aiBadge).toBeTruthy();
    expect(aiBadge.textContent).toContain('AI');

    const modifyAiBadge = document.getElementById('modify-ai-suggestion-badge');
    expect(modifyAiBadge).toBeTruthy();
    expect(modifyAiBadge.textContent).toContain('AI');
  });
});
