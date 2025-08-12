import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let webdriver;
let chrome;
let driver;
let seleniumAvailable = true;

try {
  const seleniumModule = 'selenium-webdriver';
  const chromeModule = 'selenium-webdriver/chrome';
  webdriver = require(seleniumModule);
  chrome = require(chromeModule);
} catch (err) {
  seleniumAvailable = false;
}

beforeAll(async () => {
  if (!seleniumAvailable) return;
  const { Builder } = webdriver;
  const options = new chrome.Options();
  options.addArguments('--headless', '--no-sandbox', '--disable-dev-shm-usage');

  try {
    driver = await Promise.race([
      new Builder().forBrowser('chrome').setChromeOptions(options).build(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Selenium unavailable')), 5000)
      ),
    ]);
  } catch (err) {
    seleniumAvailable = false;
  }
});

afterAll(async () => {
  if (driver) {
    await driver.quit();
  }
});

describe('Expense Tracker UI (Selenium)', () => {
  const testFn = (...args) =>
    seleniumAvailable ? it(...args) : it.skip(...args);

  testFn(
    'renders page title',
    async function () {
      if (!seleniumAvailable) this.skip();
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const fileUrl = 'file://' + path.resolve(__dirname, 'public/index.html');
      await driver.get(fileUrl);
      const title = await driver.getTitle();
      expect(title).toBe('Expense Tracker');
    },
    30000,
  );
});
