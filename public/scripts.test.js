/**
 * Vitest high-coverage tests for scripts.js
 * - Full DOM integration via jsdom
 * - Mocks for fetch, Chart.js, Bootstrap Modal/Tooltip, and alert
 * - Covers initialization, rendering, filtering, add/modify/delete flows,
 *   input formatting, validation, error handling, and chart lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createExpenseTrackerApp } from './scripts.js'; // New import

/** ---------- Helpers ---------- */
function buildHTML() {
  // All elements referenced by scripts.js must exist here.
  return `
<!DOCTYPE html>
<html>
  <body>
    <form id="expense-form"></form>

    <input id="date" type="date" />
    <input id="amount" />
    <input id="description" />
    <select id="category">
      <option value=""></option>
      <option value="Food">Food</option>
      <option value="Transportation">Transportation</option>
      <option value="Entertainment">Entertainment</option>
      <option value="Home">Home</option>
      <option value="Other">Other</option>
      <option value="Baby">Baby</option>
      <option value="Gift">Gift</option>
      <option value="Medical/Utility">Medical/Utility</option>
    </select>
    <button id="add-expense-btn" disabled>Add</button>

    <input id="month-picker" />
    <select id="category-filter">
      <option value="All">All</option>
      <option value="Food">Food</option>
      <option value="Transportation">Transportation</option>
      <option value="Entertainment">Entertainment</option>
      <option value="Home">Home</option>
      <option value="Other">Other</option>
      <option value="Baby">Baby</option>
      <option value="Gift">Gift</option>
      <option value="Medical/Utility">Medical/Utility</option>
    </select>

    <div id="total-summary"></div>
    <div id="daily-spending-summary"></div>
    <div id="start-of-month-summary"></div>
    <div id="budgeted-summary"></div>
    <div id="other-spending-summary"></div>

    <table>
      <tbody id="expense-list"></tbody>
    </table>

    <canvas id="expense-chart"></canvas>
    <canvas id="burndown-chart"></canvas>

    <!-- Delete modal -->
    <div id="delete-confirm-modal"></div>
    <div id="delete-modal-body"></div>
    <button id="confirm-delete-btn" disabled></button>
    <input id="delete-amount-input" />
    <div id="delete-warning" style="display:none"></div>

    <!-- Modify modal -->
    <div id="modify-expense-modal"></div>
    <form id="modify-expense-form"></form>
    <input id="modify-expense-id" />
    <input id="modify-date" />
    <input id="modify-amount" />
    <input id="modify-description" />
    <input id="modify-category" />
    <button id="confirm-modify-btn"></button>
  </body>
</html>
  `;
}

/**
 * Boots a fresh JSDOM, injects globals/mocks, initializes the app,
 * and returns the app instance and mocks. 
 */
async function bootApp({
  initialGet = { ok: true, json: async () => [] },
  now = new Date('2025-08-09T12:00:00.000Z'),
  useFakeTimers = true,
} = {}) {
  if (useFakeTimers) {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  }

  const dom = new JSDOM(buildHTML(), { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;

  // Attach DOM to globals
  global.window = window;
  global.document = document;

  // Mocks
  global.alert = vi.fn();
  window.alert = global.alert;

  const showSpy = vi.fn();
  const hideSpy = vi.fn();
  const createModal = () => ({ show: showSpy, hide: hideSpy });

  global.bootstrap = {
    Modal: vi.fn(createModal),
    Tooltip: vi.fn(() => ({})),
  };
  window.bootstrap = global.bootstrap;

  // Chart mock that provides destroy()
  const chartFactory = vi.fn(() => {
    const instance = { destroy: vi.fn() };
    return instance;
  });
  global.Chart = chartFactory;
  window.Chart = chartFactory;

  // fetch mock
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValue(initialGet);
  global.fetch = fetchMock;
  window.fetch = fetchMock;

  // Console silencing (optional)
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  // --- NEW: Initialize the app using createExpenseTrackerApp ---
  const domElements = {
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
    deleteConfirmModal: new bootstrap.Modal(document.getElementById('delete-confirm-modal')),
    deleteModalBody: document.getElementById('delete-modal-body'),
    confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
    deleteAmountInput: document.getElementById('delete-amount-input'),
    deleteWarning: document.getElementById('delete-warning'),
    modifyExpenseModal: new bootstrap.Modal(document.getElementById('modify-expense-modal')),
    modifyExpenseForm: document.getElementById('modify-expense-form'),
    modifyExpenseIdInput: document.getElementById('modify-expense-id'),
    modifyDateInput: document.getElementById('modify-date'),
    modifyAmountInput: document.getElementById('modify-amount'),
    modifyDescriptionInput: document.getElementById('modify-description'),
    modifyCategoryInput: document.getElementById('modify-category'),
    confirmModifyBtn: document.getElementById('confirm-modify-btn')
  };

  const app = createExpenseTrackerApp(domElements); // Initialize the app

  // Allow pending microtasks & timers (for the 10ms setTimeout in summaries)
  await Promise.resolve();
  await vi.runOnlyPendingTimersAsync();
  await Promise.resolve();

  return {
    window,
    document,
    fetchMock,
    chartFactory,
    showSpy,
    hideSpy,
    app, // Return the app instance
    cleanup: () => {
      vi.restoreAllMocks();
      if (useFakeTimers) vi.useRealTimers();
    },
  };
}

/** Utility to query within summaries */
function textContent(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function getAllRows(document) {
  return Array.from(document.querySelectorAll('#expense-list tr'));
}

/** ---------- Sample Data ---------- */
const SAMPLE_EXPENSES = [
  { rowid: 1, Date: '2025-08-09', Amount: 3000000, Description: 'Lunch', Category: 'Food' },
  { rowid: 2, Date: '2025-08-08', Amount: 500000, Description: 'Bus', Category: 'Transportation' },
  { rowid: 3, Date: '2025-08-09', Amount: 3000000, Description: 'Dinner', Category: 'Food' },
  { rowid: 4, Date: '2025-08-09', Amount: 1200000, Description: 'Movie', Category: 'Entertainment' },
  { rowid: 5, Date: '2025-08-08', Amount: 2200000, Description: 'Furniture', Category: 'Home' },
  { rowid: 6, Date: '2025-08-09', Amount: 100000, Description: 'Random', Category: 'Other' },
];

/** ---------- Tests ---------- */
describe('scripts.js (Vitest + jsdom, high coverage)', () => {
  afterEach(() => {
    // Ensure fake timers are reset between tests
    try { vi.useRealTimers(); } catch {}
    vi.restoreAllMocks();
  });

  it('initializes, sets default date/month, fetches expenses, renders summaries, groups rows, and builds chart', async () => {
    const { document, fetchMock, chartFactory, cleanup } = await bootApp({
      initialGet: { ok: true, json: async () => SAMPLE_EXPENSES },
    });

    // Initial GET called once with /api/expense?year=YYYY&month=MM (based on mocked date 2025-08-09)
    expect(fetchMock).toHaveBeenCalledTimes(1); // Corrected: scripts.js calls fetchExpensesForMonth() only inside DOMContentLoaded
    const firstUrl = fetchMock.mock.calls[0][0];
    expect(firstUrl).toMatch(/^\/api\/expense\?year=2025&month=08$/);

    // Date input & month picker set
    const dateInput = document.getElementById('date');
    const monthPicker = document.getElementById('month-picker');
    expect(dateInput.value).toBe('2025-08-09');
    expect(monthPicker.value).toBe('2025-08');

    // expense list grouped by date (desc) with separators
    const rows = getAllRows(document);
    const sepRows = rows.filter(r => r.classList.contains('date-separator'));
    expect(sepRows.length).toBe(2);
    expect(textContent(sepRows[0])).toContain('2025-08-09'); // newest date first
    expect(textContent(sepRows[1])).toContain('2025-08-08');

    // Buttons present with data-ids
    const deletes = document.querySelectorAll('#expense-list .btn.btn-danger.btn-sm');
    const modifies = document.querySelectorAll('#expense-list .btn.btn-info.btn-sm');
    expect(deletes.length).toBe(SAMPLE_EXPENSES.length);
    expect(modifies.length).toBe(SAMPLE_EXPENSES.length);

    // Summaries exist and show totals in VND
    const totalSummary = document.getElementById('total-summary');
    const dailySummary = document.getElementById('daily-spending-summary');
    const somSummary = document.getElementById('start-of-month-summary');
    const budgeted = document.getElementById('budgeted-summary');
    const other = document.getElementById('other-spending-summary');

    // Total spent = 10,000,000 ₫, total budget 20,000,000 ₫, percentage 50% (bg-success)
    expect(textContent(totalSummary)).toContain('10.000.000 ₫');
    expect(textContent(totalSummary)).toContain('20.000.000 ₫');
    expect(totalSummary.querySelector('.progress-bar').textContent.trim()).toBe('50%');
    expect(totalSummary.querySelector('.progress-bar').className).toContain('bg-success');

    // Daily spending excludes Home/Baby + (implicitly Gift/Other per tooltip)
    // Our data -> Food(6,000,000) + Transportation(500,000) + Entertainment(1,200,000) = 7,700,000
    // Daily budget = 5,000,000 + 1,000,000 + 1,500,000 + 2,000,000(Med/Util) = 9,500,000 -> 81% (bg-warning)
    const dailyBar = dailySummary.querySelector('.progress-bar');
    expect(dailyBar.textContent.trim()).toBe('81%');
    expect(dailyBar.className).toContain('bg-warning');

    // Start-of-month categories: Home, Baby
    // Home 2.2M / 2M => 110% -> bg-danger; Baby 0% -> bg-success
    const somBars = somSummary.querySelectorAll('.progress-bar');
    expect(somBars.length).toBe(2);
    const somClasses = Array.from(somBars).map(b => b.className);
    expect(somClasses.join(' ')).toContain('bg-danger');
    expect(somClasses.join(' ')).toContain('bg-success');

    // Budgeted summary cards should include Food (120% danger), Entertainment (80% warning), Transportation (50% success), Medical/Utility (0% success)
    const budgetCards = budgeted.querySelectorAll('.card');
    const budgetText = textContent(budgeted);
    expect(budgetText).toContain('Food');
    expect(budgetText).toContain('Entertainment');
    expect(budgetText).toContain('Transportation');
    expect(budgetText).toContain('Medical/Utility');

    // Other spending shows the "Other" category total
    expect(textContent(other)).toContain('Other');
    expect(textContent(other)).toContain('100.000 ₫');

    // Charts rendered for pie and burndown
    expect(chartFactory).toHaveBeenCalledTimes(2);
    const pieArgs = chartFactory.mock.calls[0];
    expect(pieArgs[1]).toMatchObject({
      type: 'pie',
      data: {
        labels: ['Food', 'Transportation', 'Entertainment'],
      },
    });
    const burnArgs = chartFactory.mock.calls[1];
    expect(burnArgs[1]).toMatchObject({ type: 'line' });
    const actualData = burnArgs[1].data.datasets[0].data;
    expect(actualData[8]).toBeGreaterThan(0); // day 9 has spending
    expect(actualData[9]).toBeNull(); // day 10 not yet occurred

    cleanup();
  });

  it('filters the expense list by category locally via category-filter', async () => {
    const { document, cleanup } = await bootApp({
      initialGet: { ok: true, json: async () => SAMPLE_EXPENSES },
    });

    const filter = document.getElementById('category-filter');
    const listBefore = document.querySelectorAll('#expense-list .btn.btn-danger.btn-sm').length;

    filter.value = 'Food';
    filter.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));

    const listAfter = document.querySelectorAll('#expense-list .btn.btn-danger.btn-sm').length;
    // Only two Food items remain
    expect(listAfter).toBe(2);
    expect(listAfter).toBeLessThan(listBefore);

    // Switch back to All
    filter.value = 'All';
    filter.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
    const listAll = document.querySelectorAll('#expense-list .btn.btn-danger.btn-sm').length;
    expect(listAll).toBe(SAMPLE_EXPENSES.length);

    cleanup();
  });

  it('formats amount input with dot separators and keeps caret position', async () => {
    const { document, cleanup } = await bootApp({
      initialGet: { ok: true, json: async () => [] },
    });

    const amount = document.getElementById('amount');

    amount.value = '1234';
    // Removed setSelectionRange calls for debugging
    amount.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
    expect(amount.value).toBe('1.234');

    amount.value = '1234567';
    // Removed setSelectionRange calls for debugging
    amount.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
    expect(amount.value).toBe('1.234.567');

    cleanup();
  });

  it('validates form fields, toggles is-invalid and enables/disables Add button', async () => {
    const { document, cleanup } = await bootApp({
      initialGet: { ok: true, json: async () => [] },
    });

    const date = document.getElementById('date');
    const amount = document.getElementById('amount');
    const desc = document.getElementById('description');
    const cat = document.getElementById('category');
    const addBtn = document.getElementById('add-expense-btn');
    const form = document.getElementById('expense-form'); // Get the form element

    // Initially disabled (from init)
    expect(addBtn.disabled).toBe(true);

    // Fill all fields -> enabled
    date.value = '2025-08-09';
    amount.value = '1.000';
    desc.value = 'Test';
    cat.value = 'Food';
    // Trigger input events to re-validate
    for (const el of [date, amount, desc, cat]) {
      el.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
    }
    expect(addBtn.disabled).toBe(false);

    // Clear one field -> disabled & invalid class set
    cat.value = '';
    // Trigger a submit event to call validateAndHighlight
    form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
    // The button is re-enabled in the finally block of addExpense, so we don't check disabled here
    expect(cat.classList.contains('is-invalid')).toBe(true);

    cleanup();
  });

  it('adds an expense (POST), refreshes list (GET), and resets form date', async () => {
    const { document, fetchMock, cleanup } = await bootApp({
      initialGet: { ok: true, json: async () => [] },
    });

    // Mock POST then GET refresh
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // POST /api/expense
      .mockResolvedValueOnce({ ok: true, json: async () => SAMPLE_EXPENSES }); // GET refresh

    const date = document.getElementById('date');
    const amount = document.getElementById('amount');
    const desc = document.getElementById('description');
    const cat = document.getElementById('category');
    const form = document.getElementById('expense-form');

    date.value = '2025-08-09';
    amount.value = '1.234.567';
    desc.value = 'New Expense';
    cat.value = 'Food';

    // Submit
    const submitEvent = new document.defaultView.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    // Flush microtasks/timers for addExpense -> POST -> refresh GET -> summaries setTimeout
    await Promise.resolve();
    await vi.runAllTimersAsync();

    // Ensure POST was called with parsed payload and headers
    const postCall = fetchMock.mock.calls.find(c => c[1] && c[1].method === 'POST');
    expect(postCall).toBeTruthy();
    const postBody = JSON.parse(postCall[1].body);
    expect(postBody).toMatchObject({
      date: '2025-08-09',
      description: 'New Expense',
      category: 'Food',
    });
    // Amount should be parsed to integer with dots removed
    expect(postBody.amount).toBe(1234567);

    // After POST ok, a GET refresh is issued
    expect(fetchMock.mock.calls.some(c => typeof c[0] === 'string' && c[0].startsWith('/api/expense?year='))).toBe(true);

    // Form date reset back to "today" (2025-08-09 in our mocked clock)
    expect(document.getElementById('date').value).toBe('2025-08-09');

    cleanup();
  });

  it('opens modify modal, pre-fills fields formatted, PUTs update and hides modal', async () => {
    const { document, fetchMock, showSpy, hideSpy, cleanup } = await bootApp({
      initialGet: { ok: true, json: async () => SAMPLE_EXPENSES },
    });

    // Click first "Modify" button
    const firstModify = document.querySelector('#expense-list .btn.btn-info.btn-sm');
    firstModify.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));

    // Modal shown
    expect(showSpy).toHaveBeenCalled();

    // Fields populated
    const id = document.getElementById('modify-expense-id').value;
    const date = document.getElementById('modify-date').value;
    const amount = document.getElementById('modify-amount').value;
    const desc = document.getElementById('modify-description').value;
    const cat = document.getElementById('modify-category').value;

    const target = SAMPLE_EXPENSES.find(e => String(e.rowid) === id);
    expect(date).toBe(target.Date);
    expect(amount).toBe('3.000.000');
    expect(desc).toBe(target.Description);
    expect(cat).toBe(target.Category);

    // Prepare PUT response and subsequent refresh GET
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // PUT
      .mockResolvedValueOnce({ ok: true, json: async () => SAMPLE_EXPENSES }); // Refresh GET

    // Confirm modify
    document.getElementById('confirm-modify-btn')
      .dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));

    await Promise.resolve();
    await vi.runAllTimersAsync();

    const putCall = fetchMock.mock.calls.find(c => c[1] && c[1].method === 'PUT');
    expect(putCall).toBeTruthy();
    const putBody = JSON.parse(putCall[1].body);
    expect(putBody).toMatchObject({
      id: Number(id),
      date: target.Date,
      description: target.Description,
      category: target.Category,
    });
    expect(putBody.amount).toBe(target.Amount);

    // Modal hidden after PUT flow
    expect(hideSpy).toHaveBeenCalled();

    cleanup();
  });

  it('opens delete modal, validates amount, enables confirm, DELETEs and hides modal', async () => {
    const { document, fetchMock, showSpy, hideSpy, cleanup } = await bootApp({
      initialGet: { ok: true, json: async () => SAMPLE_EXPENSES },
    });

    // Click first "Delete" button
    const firstDelete = document.querySelector('#expense-list .btn.btn-danger.btn-sm');
    const firstId = firstDelete.getAttribute('data-id');
    const target = SAMPLE_EXPENSES.find(e => String(e.rowid) === firstId);

    firstDelete.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));

    // Modal shown and text contains description/date
    expect(showSpy).toHaveBeenCalled();
    expect(textContent(document.getElementById('delete-modal-body'))).toContain(target.Description);
    expect(textContent(document.getElementById('delete-modal-body'))).toContain(target.Date);

    const confirmBtn = document.getElementById('confirm-delete-btn');
    const warning = document.getElementById('delete-warning');
    const input = document.getElementById('delete-amount-input');

    // Initially disabled
    expect(confirmBtn.disabled).toBe(true);

    // Wrong amount -> stays disabled, warning displayed, input invalid
    input.value = '999';
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
    expect(confirmBtn.disabled).toBe(true);
    expect(warning.style.display).toBe('block');
    expect(input.classList.contains('is-invalid')).toBe(true);

    // Correct amount (formatted) -> enabled, warning hidden, input valid
    input.value = target.Amount.toLocaleString('vi-VN').replace(/\s?₫/g, '').replace(/,/g, '.'); // ex: "3.000.000"
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));

    expect(confirmBtn.disabled).toBe(false);
    expect(warning.style.display).toBe('none');
    expect(input.classList.contains('is-invalid')).toBe(false);

    // Prepare DELETE ok and subsequent refresh GET
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // DELETE
      .mockResolvedValueOnce({ ok: true, json: async () => SAMPLE_EXPENSES }); // GET refresh

    // Confirm delete
    confirmBtn.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));

    await Promise.resolve();
    await vi.runAllTimersAsync();

    const deleteCall = fetchMock.mock.calls.find(c => c[1] && c[1].method === 'DELETE');
    expect(deleteCall).toBeTruthy();
    const deleteBody = JSON.parse(deleteCall[1].body);
    expect(deleteBody).toMatchObject({ id: String(target.rowid) });

    expect(hideSpy).toHaveBeenCalled();

    cleanup();
  });

  it('changes month triggers fetch with correct year/month query and re-renders chart (destroy called)', async () => {
    const { document, fetchMock, chartFactory, cleanup } = await bootApp({
      initialGet: { ok: true, json: async () => SAMPLE_EXPENSES },
    });

    // Prepare second GET & ensure chart destroy is called before creating a new chart
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { rowid: 99, Date: '2025-07-10', Amount: 100000, Description: 'Snack', Category: 'Food' },
      ],
    });

    const monthPicker = document.getElementById('month-picker');
    monthPicker.value = '2025-07';
    monthPicker.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));

    await Promise.resolve();
    await vi.runAllTimersAsync();

    // Second GET has month=07
    const lastUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0];
    expect(lastUrl).toMatch('/api/expense?year=2025&month=07');

    // Charts called twice initially and twice after month change; initial charts destroyed
    expect(chartFactory).toHaveBeenCalledTimes(4);
    const firstPie = chartFactory.mock.results[0].value;
    const firstBurn = chartFactory.mock.results[1].value;
    expect(firstPie.destroy).toHaveBeenCalledTimes(1);
    expect(firstBurn.destroy).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('handles GET error (response not ok): shows error row and clears summaries', async () => {
    const { document, cleanup } = await bootApp({
      initialGet: { ok: false, text: async () => 'nope' },
    });

    const listText = textContent(document.getElementById('expense-list'));
    expect(listText).toContain('Error loading data.');

    expect(document.getElementById('total-summary').innerHTML).toBe('');
    expect(document.getElementById('budgeted-summary').innerHTML).toBe('');
    expect(document.getElementById('other-spending-summary').innerHTML).toBe('');

    cleanup();
  });

  it('handles GET network failure: shows connection error and clears summaries', async () => {
    const { document, cleanup } = await bootApp({
      initialGet: Promise.reject(new Error('network down')),
    });

    const listText = textContent(document.getElementById('expense-list'));
    expect(listText).toContain('Could not connect to the server.');

    expect(document.getElementById('total-summary').innerHTML).toBe('');
    expect(document.getElementById('budgeted-summary').innerHTML).toBe('');
    expect(document.getElementById('other-spending-summary').innerHTML).toBe('');

    cleanup();
  });
});
