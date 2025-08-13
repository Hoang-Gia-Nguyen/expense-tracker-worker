import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let webdriver;
let chrome;
let driver;
let seleniumAvailable = true;
let server;
let baseUrl;
const expenses = [];

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

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const publicDir = path.resolve(__dirname, 'public');

  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const serveFile = (filePath, contentType) => {
      fs.readFile(path.join(publicDir, filePath), (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    };

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      serveFile('index.html', 'text/html');
    } else if (req.method === 'GET' && url.pathname === '/scripts.js') {
      serveFile('scripts.js', 'application/javascript');
    } else if (req.method === 'GET' && url.pathname === '/styles.css') {
      serveFile('styles.css', 'text/css');
    } else if (url.pathname === '/api/expense') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(expenses));
      } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          let data;
          try {
            data = JSON.parse(body || '{}');
          } catch (e) {
            res.writeHead(400);
            res.end();
            return;
          }

          const newExpense = {
            rowid: expenses.length + 1,
            Date: data.date,
            Amount: data.amount,
            Description: data.description,
            Category: data.category,
          };
          expenses.push(newExpense);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newExpense));
        });
      } else {
        res.writeHead(405);
        res.end();
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
});

afterAll(async () => {
  if (driver) {
    await driver.quit();
  }
  if (server) {
    server.close();
  }
});

describe('Expense Tracker UI (Selenium)', () => {
  const testFn = seleniumAvailable ? it : it.skip;

  testFn('renders page title', async () => {
    await driver.get(baseUrl + '/index.html');
    const title = await driver.getTitle();
    expect(title).toBe('Expense Tracker');
  }, 30000);

  testFn('submits new expense and displays it', async () => {
    const { By, until } = webdriver;

    await driver.get(baseUrl + '/index.html');

    await driver.wait(until.elementLocated(By.id('expense-form')), 5000);

    const date = await driver.findElement(By.id('date'));
    await date.clear();
    await date.sendKeys('2024-01-01');

    const amount = await driver.findElement(By.id('amount'));
    await amount.clear();
    await amount.sendKeys('100000');

    const description = await driver.findElement(By.id('description'));
    await description.clear();
    await description.sendKeys('Test expense');

    const category = await driver.findElement(By.id('category'));
    await category.sendKeys('Food');

    const submitBtn = await driver.findElement(By.id('add-expense-btn'));
    await driver.wait(until.elementIsEnabled(submitBtn), 5000);
    await submitBtn.click();

    const row = await driver.wait(
      until.elementLocated(By.xpath("//tr[td[contains(text(),'Test expense')]]")),
      5000
    );

    const cells = await row.findElements(By.css('td'));
    const amountText = await cells[0].getText();
    const descriptionText = await cells[1].getText();
    const categoryText = await cells[2].getText();

    const numericAmount = parseInt(amountText.replace(/[^0-9]/g, ''));
    expect(numericAmount).toBe(100000);
    expect(descriptionText).toBe('Test expense');
    expect(categoryText).toBe('Food');
  }, 30000);

  testFn('renders pie chart with correct data', async () => {
    expenses.length = 0;
    expenses.push(
      { rowid: 1, Date: '2000-01-05', Amount: 100000, Description: 'Groceries', Category: 'Food' },
      { rowid: 2, Date: '2000-01-10', Amount: 200000, Description: 'Taxi', Category: 'Transportation' }
    );

    await driver.get(baseUrl + '/index.html');

    await driver.wait(
      async () => await driver.executeScript("return !!Chart.getChart('expense-chart');"),
      10000
    );

    const labels = await driver.executeScript(
      "return Chart.getChart('expense-chart').data.labels;"
    );
    const data = await driver.executeScript(
      "return Chart.getChart('expense-chart').data.datasets[0].data;"
    );

    expect(labels).toEqual(['Food', 'Transportation']);
    expect(data[0]).toBe(100000);
    expect(data[1]).toBe(200000);
  }, 30000);

  testFn('renders burndown chart with cumulative totals', async () => {
    expenses.length = 0;
    expenses.push(
      { rowid: 1, Date: '2000-01-01', Amount: 100000, Description: 'Groceries', Category: 'Food' },
      { rowid: 2, Date: '2000-01-10', Amount: 200000, Description: 'Taxi', Category: 'Transportation' }
    );

    await driver.get(baseUrl + '/index.html');
    await driver.executeScript(
      "const mp=document.getElementById('month-picker'); mp.value='2000-01'; mp.dispatchEvent(new Event('change'));"
    );

    await driver.wait(
      async () => await driver.executeScript("return !!Chart.getChart('burndown-chart');"),
      10000
    );

    const actual = await driver.executeScript(
      "return Chart.getChart('burndown-chart').data.datasets[0].data;"
    );
    const expected = await driver.executeScript(
      "return Chart.getChart('burndown-chart').data.datasets[1].data;"
    );

    expect(actual.length).toBe(31);
    expect(actual[0]).toBe(100000);
    expect(actual[9]).toBe(300000);
    expect(actual[30]).toBe(300000);

    const dailyBudget = 9500000;
    const dailyRate = dailyBudget / 31;
    expect(expected.length).toBe(31);
    expect(expected[0]).toBeCloseTo(dailyRate, 0);
    expect(expected[30]).toBeCloseTo(dailyBudget, 0);
  }, 30000);
});
