import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Builder, By } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let driver;

async function loadPage(page) {
  const filePath = path.join(__dirname, 'public', page, 'index.html');
  const url = pathToFileURL(filePath).href;
  await driver.get(url);
}

beforeAll(async () => {
  const options = new chrome.Options();
  options.addArguments('--headless', '--no-sandbox', '--disable-dev-shm-usage');
  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
});

afterAll(async () => {
  if (driver) {
    await driver.quit();
  }
});

describe('Expense Tracker UI', () => {
  it('renders expense page title', async () => {
    await loadPage('expense');
    const title = await driver.getTitle();
    expect(title).toBe('Expense Tracker');
  });

  it('has navbar links to all pages', async () => {
    await loadPage('expense');
    const links = await driver.findElements(By.css('nav a[href]'));
    const hrefs = [];
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (!href.endsWith('#')) {
        hrefs.push(new URL(href).pathname);
      }
    }
    expect(hrefs).toEqual(['/expense', '/summary', '/insights']);
  });

  it('renders summary layout', async () => {
    await loadPage('summary');
    const heading = await driver.findElement(By.css('h1')).getText();
    expect(heading.toLowerCase()).toContain('summary');
    await driver.findElement(By.id('month-picker'));
    await driver.findElement(By.id('summary-chart'));
  });

  it('renders insights placeholder', async () => {
    await loadPage('insights');
    const heading = await driver.findElement(By.css('h1')).getText();
    expect(heading.toLowerCase()).toContain('insights');
  });
});
