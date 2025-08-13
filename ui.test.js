import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

function loadPage(page) {
  const file = fs.readFileSync(path.join(__dirname, 'public', page, 'index.html'), 'utf-8');
  return new JSDOM(file);
}

describe('Expense Tracker UI', () => {
  it('renders expense page title', () => {
    const { window } = loadPage('expense');
    expect(window.document.title).toBe('Expense Tracker');
  });

  it('has navbar links to all pages', () => {
    const { window } = loadPage('expense');
    const links = Array.from(window.document.querySelectorAll('nav a'))
      .map(a => a.getAttribute('href'))
      .filter(href => href !== '#');
    expect(links).toEqual(['/expense', '/summary', '/insights']);
  });

  it('renders summary placeholder', () => {
    const { window } = loadPage('summary');
    const heading = window.document.querySelector('h1');
    expect(heading.textContent).toMatch(/summary/i);
  });

  it('renders insights placeholder', () => {
    const { window } = loadPage('insights');
    const heading = window.document.querySelector('h1');
    expect(heading.textContent).toMatch(/insights/i);
  });
});
