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
let By;
let until;

try {
  const seleniumModule = 'selenium-webdriver';
  const chromeModule = 'selenium-webdriver/chrome';
  webdriver = require(seleniumModule);
  chrome = require(chromeModule);
  ({ By, until } = webdriver);
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
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const fileUrl = 'file://' + path.resolve(__dirname, 'public/index.html');
    await driver.get(fileUrl);
    const title = await driver.getTitle();
    expect(title).toBe('Expense Tracker');
  }, 30000);


  testFn('renders charts with seeded data', async () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const fileUrl = 'file://' + path.resolve(__dirname, 'public/index.html');
    const scriptUrl = 'file://' + path.resolve(__dirname, 'public/scripts.js');
    await driver.get(fileUrl);

    const sampleData = [
      { Date: '2020-01-01', Amount: 100000, Description: 'Lunch', Category: 'Food', rowid: 1 },
      { Date: '2020-01-02', Amount: 500000, Description: 'Movie', Category: 'Entertainment', rowid: 2 }
    ];

    await driver.executeAsyncScript(function (scriptUrl, expenses, done) {
      window.sampleExpenses = expenses.slice();
      window.fetch = async (url, opts = {}) => {
        if (url.includes('/api/expense')) {
          if (!opts.method || opts.method === 'GET') {
            return { ok: true, json: async () => window.sampleExpenses };
          }
          if (opts.method === 'POST') {
            const body = JSON.parse(opts.body);
            const newItem = {
              Date: body.date,
              Amount: body.amount,
              Description: body.description,
              Category: body.category,
              rowid: window.sampleExpenses.length + 1,
            };
            window.sampleExpenses.push(newItem);
            return { ok: true, json: async () => ({}) };
          }
        }
        throw new Error('Unknown fetch URL');
      };

      const dynamicImport = new Function('u', 'return import(u)');
      dynamicImport(scriptUrl)
        .then(mod => {
          window.testApp = mod.createExpenseTrackerApp({
            expenseForm: document.getElementById('expense-form'),
            expenseList: document.getElementById('expense-list'),
            dateInput: document.getElementById('date'),
            amountInput: document.getElementById('amount'),
            descriptionInput: document.getElementById('description'),
            categoryInput: document.getElementById('category'),
            addExpenseBtn: document.getElementById('add-expense-btn'),
            monthPicker: document.getElementById('month-picker'),
            categoryFilter: document.getElementById('category-filter'),
            totalSummaryDiv: document.getElementById('total-summary'),
            dailySpendingSummaryDiv: document.getElementById('daily-spending-summary'),
            startOfMonthSummaryDiv: document.getElementById('start-of-month-summary'),
            budgetedSummaryDiv: document.getElementById('budgeted-summary'),
            otherSpendingSummaryDiv: document.getElementById('other-spending-summary'),
            chartCanvas: document.getElementById('expense-chart'),
            burndownCanvas: document.getElementById('burndown-chart'),
            deleteConfirmModal: { show: () => {}, hide: () => {} },
            deleteModalBody: document.getElementById('delete-modal-body'),
            confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
            deleteAmountInput: document.getElementById('delete-amount-input'),
            deleteWarning: document.getElementById('delete-warning'),
            modifyExpenseModal: { show: () => {}, hide: () => {} },
            modifyExpenseForm: document.getElementById('modify-expense-form'),
            modifyExpenseIdInput: document.getElementById('modify-expense-id'),
            modifyDateInput: document.getElementById('modify-date'),
            modifyAmountInput: document.getElementById('modify-amount'),
            modifyDescriptionInput: document.getElementById('modify-description'),
            modifyCategoryInput: document.getElementById('modify-category'),
            confirmModifyBtn: document.getElementById('confirm-modify-btn')
          });
          done();
        })
        .catch(err => done(err.message));
    }, scriptUrl, sampleData);

    await driver.executeScript(() => {
      const mp = document.getElementById('month-picker');
      mp.value = '2020-01';
      mp.dispatchEvent(new Event('change'));
    });

    await driver.wait(() =>
      driver.executeScript(() => {
        const exp = Chart.getChart('expense-chart');
        const burn = Chart.getChart('burndown-chart');
        return exp && burn && exp.data.datasets[0].data[0] === 100000;
      }),
    10000);

    const pieData = await driver.executeScript(() => {
      const chart = Chart.getChart('expense-chart');
      return { labels: chart.data.labels, data: chart.data.datasets[0].data };
    });
    expect(pieData.labels).toEqual(['Food', 'Entertainment']);
    expect(pieData.data).toEqual([100000, 500000]);

    const burndownData = await driver.executeScript(() => {
      const chart = Chart.getChart('burndown-chart');
      return {
        labels: chart.data.labels.slice(0, 2),
        actual: chart.data.datasets[0].data.slice(0, 2)
      };
    });
    expect(burndownData.labels).toEqual([1, 2]);
    expect(burndownData.actual).toEqual([100000, 600000]);

    const dateField = await driver.findElement(By.id('date'));
    await dateField.clear();
    await dateField.sendKeys('2020-01-03');
    const amountField = await driver.findElement(By.id('amount'));
    await amountField.clear();
    await amountField.sendKeys('300000');
    const descField = await driver.findElement(By.id('description'));
    await descField.clear();
    await descField.sendKeys('Snacks');
    const categoryField = await driver.findElement(By.id('category'));
    await categoryField.sendKeys('Food');
    await driver.findElement(By.id('add-expense-btn')).click();

    await driver.wait(() =>
      driver.executeScript(() => {
        const chart = Chart.getChart('expense-chart');
        return chart.data.datasets[0].data[0] === 400000;
      }),
    10000);
  }, 60000);
});
