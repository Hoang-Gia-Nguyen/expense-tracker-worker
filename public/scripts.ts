import Chart from 'chart.js/auto'; // Assuming chart.js is available globally or imported like this
import {
    Expense,
    NewExpenseInput,
    UpdateExpenseInput,
    DeleteExpenseInput,
    ApiExpense,
    Summary,
    InsightsResponse,
} from '../sharedTypes'; // Import types and schemas

// --- Configuration ---
// These should ideally be fetched from the backend or a config file
const API_URL = '/api'; // Base API URL
const MONTHLY_BUDGET = {
    'Food': 5000000,
    'Medical/Utility': 2000000,
    'Transportation': 1000000,
    'Entertainment': 1500000,
    'Home': 2000000,
    'Baby': 15000000,
};
const TOTAL_BUDGET = 20000000;

const CATEGORY_CONFIG = {
    'Food': { color: '#FF6384' },
    'Medical/Utility': { color: '#4BC0C0' },
    'Home': { color: '#FFCE56' },
    'Transportation': { color: '#36A2EB' },
    'Entertainment': { color: '#9966FF' },
    'Baby': { color: '#FF9F40' },
    'Gift': { color: '#C9CBCF' },
    'Other': { color: '#808080' },
};
const CATEGORY_ORDER = ['Food', 'Baby', 'Medical/Utility', 'Home', 'Transportation', 'Entertainment', 'Gift', 'Other'];
const START_OF_MONTH_CATEGORIES = ['Home', 'Baby'];

// --- DOM Element References ---
interface DOMElements {
    expenseForm: HTMLFormElement;
    expenseList: HTMLTableSectionElement;
    dateInput: HTMLInputElement;
    amountInput: HTMLInputElement;
    descriptionInput: HTMLInputElement;
    categoryInput: HTMLSelectElement;
    addExpenseBtn: HTMLButtonElement;
    monthPicker: HTMLInputElement;
    categoryFilter: HTMLSelectElement;
    totalSummaryDiv: HTMLDivElement;
    dailySpendingSummaryDiv: HTMLDivElement;
    startOfMonthSummaryDiv: HTMLDivElement;
    budgetedSummaryDiv: HTMLDivElement;
    otherSpendingSummaryDiv: HTMLDivElement;
    chartCanvas: HTMLCanvasElement;
    burndownCanvas: HTMLCanvasElement;
    deleteConfirmModal: bootstrap.Modal;
    deleteModalBody: HTMLDivElement;
    confirmDeleteBtn: HTMLButtonElement;
    deleteAmountInput: HTMLInputElement;
    deleteWarning: HTMLDivElement;
    modifyExpenseModal: bootstrap.Modal;
    modifyExpenseForm: HTMLFormElement;
    modifyExpenseIdInput: HTMLInputElement;
    modifyDateInput: HTMLInputElement;
    modifyAmountInput: HTMLInputElement;
    modifyDescriptionInput: HTMLInputElement;
    modifyCategoryInput: HTMLSelectElement;
    confirmModifyBtn: HTMLButtonElement;
}

let allExpensesForMonth: ApiExpense[] = [];
let expenseChart: Chart | null = null;
let burndownChart: Chart | null = null;

// --- Utility Functions ---
function formatNumber(value: string): string {
    const isNegative = value.startsWith('-');
    const digits = value.replace(/\D/g, '');
    const formattedDigits = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (isNegative) {
        return digits ? `-${formattedDigits}` : '-';
    }
    return formattedDigits;
}

function getProgressBarColor(percentage: number): string {
    if (percentage > 100) return 'bg-danger';
    if (percentage > 75) return 'bg-warning';
    return 'bg-success';
}

// --- API Interaction ---
async function fetchExpensesForMonth(monthPickerValue: string): Promise<void> {
    const [year, month] = monthPickerValue.split('-');
    try {
        const response = await fetch(`${API_URL}/expense?year=${year}&month=${month}`);
        if (response.ok) {
            const data = await response.json();
            // Validate fetched data with Zod schema
            allExpensesForMonth = GetExpensesResponseSchema.parse(data);
            renderSummaries(allExpensesForMonth);
            applyFilter(); // Apply the current filter to the transaction list
        } else {
            console.error('Failed to fetch expenses:', await response.text());
            throw new Error(`Failed to fetch expenses: ${response.statusText}`);
        }
    } catch (error: any) {
        console.error('Error fetching expenses:', error);
        const expenseList = document.getElementById('expense-list') as HTMLTableSectionElement;
        expenseList.innerHTML = `<tr><td colspan="5" class="text-center">${error.message || 'Could not connect to the server.'}</td></tr>`;
        clearSummaries();
    }
}

async function addExpense(expenseData: NewExpenseInput): Promise<void> {
    try {
        const response = await fetch(`${API_URL}/expense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData),
        });

        if (response.ok) {
            console.log('Expense sent successfully!');
            // Refetch all data for the month
            const monthPicker = document.getElementById('month-picker') as HTMLInputElement;
            await fetchExpensesForMonth(monthPicker.value);
        } else {
            const errorText = await response.text();
            console.error('Failed to send expense:', errorText);
            throw new Error(`Failed to add expense. Server responded: ${response.statusText}`);
        }
    } catch (error: any) {
        console.error('Error sending expense:', error);
        throw new Error(error.message || 'Could not connect to the server to add the expense.');
    }
}

async function updateExpense(expenseData: UpdateExpenseInput): Promise<void> {
    try {
        const response = await fetch(`${API_URL}/expense`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData),
        });

        if (response.ok) {
            console.log('Expense updated successfully!');
            const monthPicker = document.getElementById('month-picker') as HTMLInputElement;
            await fetchExpensesForMonth(monthPicker.value);
        } else {
            const errorText = await response.text();
            console.error('Failed to update expense:', errorText);
            throw new Error(`Error: Could not update the expense on the server.`);
        }
    } catch (error: any) {
        console.error('Error updating expense:', error);
        throw new Error(error.message || 'Error: Could not connect to the server to update the expense.');
    }
}

async function deleteExpense(expenseId: number): Promise<void> {
    try {
        const response = await fetch(`${API_URL}/expense`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: expenseId }),
        });

        if (response.ok) {
            console.log('Expense deleted successfully!');
            const monthPicker = document.getElementById('month-picker') as HTMLInputElement;
            await fetchExpensesForMonth(monthPicker.value);
        } else {
            const errorText = await response.text();
            console.error('Failed to delete expense:', errorText);
            throw new Error('Error: Could not delete the expense from the server.');
        }
    } catch (error: any) {
        console.error('Error deleting expense:', error);
        throw new Error(error.message || 'Error: Could not connect to the server to delete the expense.');
    }
}

// --- Rendering Functions ---
function renderChart(summaryData: { [key: string]: number }): void {
    const chartLabels: string[] = [];
    const chartData: number[] = [];
    const chartColors: string[] = [];

    const budgetedCategories = CATEGORY_ORDER.filter(category => MONTHLY_BUDGET.hasOwnProperty(category) && !START_OF_MONTH_CATEGORIES.includes(category));

    budgetedCategories.forEach(category => {
        if (summaryData[category] > 0) {
            chartLabels.push(category);
            chartData.push(summaryData[category]);
            chartColors.push(CATEGORY_CONFIG[category]?.color || '#808080');
        }
    });

    const chartCanvas = document.getElementById('expense-chart') as HTMLCanvasElement;
    if (expenseChart) {
        expenseChart.destroy();
    }

    expenseChart = new Chart(chartCanvas, {
        type: 'pie',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Spending by Category',
                data: chartData,
                backgroundColor: chartColors,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Spending Distribution' }
            }
        }
    });
}

function renderBurndownChart(data: ApiExpense[]): void {
    const monthPicker = document.getElementById('month-picker') as HTMLInputElement;
    const [year, month] = monthPicker.value.split('-');
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();

    const dailySpendingCategories = CATEGORY_ORDER.filter(category => MONTHLY_BUDGET.hasOwnProperty(category) && !START_OF_MONTH_CATEGORIES.includes(category));
    const dailyBudget = dailySpendingCategories.reduce((sum, category) => sum + (MONTHLY_BUDGET[category] || 0), 0);

    const dailyTotals: number[] = Array(daysInMonth).fill(0);
    data.forEach(expense => {
        const date = new Date(expense.Date);
        const expMonth = String(date.getMonth() + 1).padStart(2, '0');
        const expYear = String(date.getFullYear());
        if (expYear === year && expMonth === month && dailySpendingCategories.includes(expense.Category)) {
            dailyTotals[date.getDate() - 1] += expense.Amount;
        }
    });

    const actual: (number | null)[] = [];
    const today = new Date();
    const currentYearStr = String(today.getFullYear());
    const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = today.getDate();
    const isCurrentMonth = year === currentYearStr && month === currentMonthStr;

    let running = 0;
    for (let i = 0; i < daysInMonth; i++) {
        running += dailyTotals[i];
        if (isCurrentMonth && i + 1 > currentDay) { // Show null for future days in current month
            actual.push(null);
        } else {
            actual.push(running);
        }
    }

    const expected: number[] = [];
    const dailyRate = dailyBudget / daysInMonth;
    for (let i = 0; i < daysInMonth; i++) {
        expected.push(dailyRate * (i + 1));
    }

    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const burndownCanvas = document.getElementById('burndown-chart') as HTMLCanvasElement;
    if (burndownChart) {
        burndownChart.destroy();
    }

    burndownChart = new Chart(burndownCanvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Actual Spending',
                    data: actual,
                    borderColor: '#36A2EB',
                    fill: false,
                    tension: 0
                },
                {
                    label: 'Expected Spending',
                    data: expected,
                    borderColor: '#FF6384',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Daily Spending Burndown' }
            }
        }
    });
}

function renderSummaries(data: ApiExpense[]): void {
    const summary: { [key: string]: number } = data.reduce((acc, expense) => {
        const category = expense.Category;
        const amount = expense.Amount;
        if (!acc[category]) {
            acc[category] = 0;
        }
        acc[category] += amount;
        return acc;
    }, {} as { [key: string]: number });

    renderChart(summary);
    renderBurndownChart(data);

    // Clear existing content to reset animations
    const totalSummaryDiv = document.getElementById('total-summary') as HTMLDivElement;
    const dailySpendingSummaryDiv = document.getElementById('daily-spending-summary') as HTMLDivElement;
    const startOfMonthSummaryDiv = document.getElementById('start-of-month-summary') as HTMLDivElement;
    const budgetedSummaryDiv = document.getElementById('budgeted-summary') as HTMLDivElement;
    const otherSpendingSummaryDiv = document.getElementById('other-spending-summary') as HTMLDivElement;

    totalSummaryDiv.innerHTML = '';
    dailySpendingSummaryDiv.innerHTML = '';
    startOfMonthSummaryDiv.innerHTML = '';
    budgetedSummaryDiv.innerHTML = '';
    otherSpendingSummaryDiv.innerHTML = '';

    // Recalculate and render with animation
    setTimeout(() => {
        const totalSpent = Object.values(summary).reduce((sum, total) => sum + total, 0);
        const totalPercentage = TOTAL_BUDGET > 0 ? Math.round((totalSpent / TOTAL_BUDGET) * 100) : 0;
        const totalProgressBarColor = getProgressBarColor(totalPercentage);

        totalSummaryDiv.innerHTML = `
            <div class="card text-center">
                <div class="card-header">Monthly Summary</div>
                <div class="card-body">
                    <h5 class="card-title">Total Spent: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalSpent)}</h5>
                    <p class="card-text">Total Budget: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(TOTAL_BUDGET)}</p>
                    <div class="progress" style="height: 25px;">
                        <div class="progress-bar ${totalProgressBarColor}" role="progressbar" style="width: ${totalPercentage}%;" aria-valuenow="${totalPercentage}" aria-valuemin="0" aria-valuemax="100">${totalPercentage}%</div>
                    </div>
                </div>
            </div>
        `;

        const dailySpendingCategories = CATEGORY_ORDER.filter(category => MONTHLY_BUDGET.hasOwnProperty(category) && !START_OF_MONTH_CATEGORIES.includes(category));
        const dailySpent = dailySpendingCategories.reduce((sum, category) => sum + (summary[category] || 0), 0);
        const dailyBudget = dailySpendingCategories.reduce((sum, category) => sum + (MONTHLY_BUDGET[category] || 0), 0);
        const dailyPercentage = dailyBudget > 0 ? Math.round((dailySpent / dailyBudget) * 100) : 0;
        const dailyProgressBarColor = getProgressBarColor(dailyPercentage);

        dailySpendingSummaryDiv.innerHTML = `
            <div class="card text-center">
                <div class="card-header">
                    Daily Spending Summary
                    <i class="bi bi-question-circle-fill" data-bs-toggle="tooltip" data-bs-placement="top" title="Excludes Home, Baby, Gift, and Other categories."></i>
                </div>
                <div class="card-body">
                    <h5 class="card-title">Total Spent: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dailySpent)}</h5>
                    <p class="card-text">Total Budget: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dailyBudget)}</p>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${dailyProgressBarColor}" role="progressbar" style="width: ${dailyPercentage}%;" aria-valuenow="${dailyPercentage}" aria-valuemin="0" aria-valuemax="100">${dailyPercentage}%</div>
                    </div>
                </div>
            </div>
        `;

        let startOfMonthHtml = '<h5>Start-of-month Spending</h5><div class="row">';
        START_OF_MONTH_CATEGORIES.forEach(category => {
            const budget = MONTHLY_BUDGET[category] || 0;
            const total = summary[category] || 0;
            const percentage = budget > 0 ? Math.round((total / budget) * 100) : 0;
            const progressBarColor = getProgressBarColor(percentage);
            startOfMonthHtml += `
                <div class="col-md-4 col-sm-6 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title text-center">${category}</h6>
                            <p class="card-text fs-5 text-center">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total)}</p>
                            <p class="card-text small text-center text-muted">Budget: ${new Intl.NumberFormat('vi-VN').format(budget)} ₫</p>
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar ${progressBarColor}" role="progressbar" style="width: ${percentage}%;" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">${percentage}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        startOfMonthHtml += '</div>';
        startOfMonthSummaryDiv.innerHTML = startOfMonthHtml;

        let budgetedHtml = '<h5>Budgeted Categories</h5><div class="row">';
        Object.entries(MONTHLY_BUDGET).filter(([category]) => !START_OF_MONTH_CATEGORIES.includes(category)).forEach(([category, budget]) => {
            const total = summary[category] || 0;
            const percentage = Math.round((total / budget) * 100);
            const progressBarColor = getProgressBarColor(percentage);
            budgetedHtml += `
                <div class="col-md-4 col-sm-6 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title text-center">${category}</h6>
                            <p class="card-text fs-5 text-center">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total)}</p>
                            <p class="card-text small text-center text-muted">Budget: ${new Intl.NumberFormat('vi-VN').format(budget)} ₫</p>
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar ${progressBarColor}" role="progressbar" style="width: ${percentage}%;" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">${percentage}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        budgetedHtml += '</div>';
        budgetedSummaryDiv.innerHTML = budgetedHtml;

        const otherSpending = Object.entries(summary).filter(([category]) => !MONTHLY_BUDGET[category]);
        let otherSpendingHtml = '<h5>Other Spending</h5><div class="row">';
        if (otherSpending.length > 0) {
            otherSpending.sort(([, a], [, b]) => b - a).forEach(([category, total]) => {
                otherSpendingHtml += `
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <h6 class="card-title">${category}</h6>
                                <p class="card-text fs-5">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total)}</p>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            otherSpendingHtml += '<p>No other spending this month.</p>';
        }
        otherSpendingHtml += '</div>';
        otherSpendingSummaryDiv.innerHTML = otherSpendingHtml;

        // Initialize tooltips after rendering
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }, 10); // A small delay to allow the browser to render the cleared state first
}

function renderExpenses(data: ApiExpense[]): void {
    const expenseList = document.getElementById('expense-list') as HTMLTableSectionElement;
    expenseList.innerHTML = '';

    // Sort expenses by date in descending order
    data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

    // Group expenses by date
    const groupedExpenses: { [date: string]: ApiExpense[] } = data.reduce((acc, expense) => {
        const date = expense.Date.split('T')[0]; // Get only the date part
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(expense);
        return acc;
    }, {});

    // Render expenses with date separators
    for (const date in groupedExpenses) {
        const separatorRow = document.createElement('tr');
        separatorRow.classList.add('date-separator');
        separatorRow.innerHTML = `<td colspan="5">${date}</td>`;
        expenseList.appendChild(separatorRow);

        groupedExpenses[date].forEach((expense) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(expense.Amount)}</td>
                <td>${expense.Description}</td>
                <td>${expense.Category}</td>
                <td class="actions-cell">
                    <button class="btn btn-info btn-sm modify-btn" data-id="${expense.rowid}">Modify</button>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${expense.rowid}">Delete</button>
                </td>
            `;
            expenseList.appendChild(row);
        });
    }
}

function clearSummaries(): void {
    const totalSummaryDiv = document.getElementById('total-summary') as HTMLDivElement;
    const dailySpendingSummaryDiv = document.getElementById('daily-spending-summary') as HTMLDivElement;
    const startOfMonthSummaryDiv = document.getElementById('start-of-month-summary') as HTMLDivElement;
    const budgetedSummaryDiv = document.getElementById('budgeted-summary') as HTMLDivElement;
    const otherSpendingSummaryDiv = document.getElementById('other-spending-summary') as HTMLDivElement;

    totalSummaryDiv.innerHTML = '';
    dailySpendingSummaryDiv.innerHTML = '';
    startOfMonthSummaryDiv.innerHTML = '';
    budgetedSummaryDiv.innerHTML = '';
    otherSpendingSummaryDiv.innerHTML = '';
}

// --- Event Handlers ---
function checkFormValidity(
    dateInput: HTMLInputElement,
    amountInput: HTMLInputElement,
    descriptionInput: HTMLInputElement,
    categoryInput: HTMLSelectElement,
    addExpenseBtn: HTMLButtonElement
): void {
    const amountValue = amountInput.value.replace(/\./g, '');
    const isAmountValid = amountValue !== '' && amountValue !== '-';
    const otherFieldsValid = [dateInput, descriptionInput, categoryInput].every(field => field.value.trim() !== '');
    addExpenseBtn.disabled = !(isAmountValid && otherFieldsValid);
}

function validateAndHighlight(
    dateInput: HTMLInputElement,
    amountInput: HTMLInputElement,
    descriptionInput: HTMLInputElement,
    categoryInput: HTMLSelectElement
): boolean {
    let allValid = true;

    const amountValue = amountInput.value.replace(/\./g, '');
    if (!amountValue || amountValue === '-') {
        amountInput.classList.add('is-invalid');
        allValid = false;
    } else {
        amountInput.classList.remove('is-invalid');
    }

    [dateInput, descriptionInput].forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('is-invalid');
            allValid = false;
        } else {
            field.classList.remove('is-invalid');
        }
    });

    if (!categoryInput.value) {
        categoryInput.classList.add('is-invalid');
        allValid = false;
    } else {
        categoryInput.classList.remove('is-invalid');
    }

    return allValid;
}

function validateDeleteConfirmation(
    deleteAmountInput: HTMLInputElement,
    confirmDeleteBtn: HTMLButtonElement,
    deleteWarning: HTMLDivElement,
    correctAmount: string
): void {
    const enteredAmount = deleteAmountInput.value.replace(/\./g, '');

    if (correctAmount === enteredAmount) {
        confirmDeleteBtn.disabled = false;
        deleteAmountInput.classList.remove('is-invalid');
        deleteWarning.style.display = 'none';
    } else {
        confirmDeleteBtn.disabled = true;
        if (deleteAmountInput.value) { // Only show warning if user has typed something
            deleteAmountInput.classList.add('is-invalid');
            deleteWarning.style.display = 'block';
        }
    }
}

// --- Form and Modal Handlers ---
async function handleAddExpenseSubmit(event: Event, domElements: DOMElements): Promise<void> {
    event.preventDefault();
    const {
        expenseForm, expenseList, dateInput, amountInput, descriptionInput, categoryInput,
        addExpenseBtn, monthPicker, categoryFilter, totalSummaryDiv, dailySpendingSummaryDiv,
        startOfMonthSummaryDiv, budgetedSummaryDiv, otherSpendingSummaryDiv, chartCanvas, burndownCanvas,
        deleteConfirmModal, deleteModalBody, confirmDeleteBtn, deleteAmountInput, deleteWarning,
        modifyExpenseModal, modifyExpenseForm, modifyExpenseIdInput, modifyDateInput,
        modifyAmountInput, modifyDescriptionInput, modifyCategoryInput, confirmModifyBtn
    } = domElements;

    if (!validateAndHighlight(dateInput, amountInput, descriptionInput, categoryInput)) {
        return;
    }

    addExpenseBtn.disabled = true; // Disable button to prevent multiple submissions

    const newExpenseData: NewExpenseInput = {
        Date: dateInput.value,
        Amount: parseInt(amountInput.value.replace(/\./g, '')),
        Description: descriptionInput.value,
        Category: categoryInput.value,
    };

    try {
        await addExpense(newExpenseData);
        expenseForm.reset();
        dateInput.value = new Date().toISOString().split('T')[0]; // Reset date to today
        checkFormValidity(dateInput, amountInput, descriptionInput, categoryInput, addExpenseBtn); // Re-check validity for reset form
    } catch (error: any) {
        alert(error.message); // Show error to user
    } finally {
        addExpenseBtn.disabled = false;
    }
}

function handleModifyExpenseClick(event: Event, domElements: DOMElements): void {
    const { modifyExpenseModal, modifyExpenseIdInput, modifyDateInput, modifyAmountInput, modifyDescriptionInput, modifyCategoryInput } = domElements;
    const target = event.target as HTMLElement;

    if (target.classList.contains('modify-btn')) {
        const expenseId = target.getAttribute('data-id');
        const expenseToModify = allExpensesForMonth.find(exp => exp.rowid === parseInt(expenseId!));

        if (expenseToModify) {
            modifyExpenseIdInput.value = expenseToModify.rowid.toString();
            modifyDateInput.value = expenseToModify.Date.split('T')[0]; // Ensure only date part is set
            modifyAmountInput.value = formatNumber(expenseToModify.Amount.toString());
            modifyDescriptionInput.value = expenseToModify.Description;
            modifyCategoryInput.value = expenseToModify.Category;
            modifyExpenseModal.show();
        }
    }
}

async function handleConfirmModify(domElements: DOMElements): Promise<void> {
    const { modifyExpenseModal, modifyExpenseForm, modifyExpenseIdInput, modifyDateInput, modifyAmountInput, modifyDescriptionInput, modifyCategoryInput, confirmModifyBtn } = domElements;

    // Re-validate inputs before submission
    let formValid = true;
    if (!modifyDateInput.value) { modifyDateInput.classList.add('is-invalid'); formValid = false; } else { modifyDateInput.classList.remove('is-invalid'); }
    const modifyAmountValue = modifyAmountInput.value.replace(/\./g, '');
    if (!modifyAmountValue || modifyAmountValue === '-') { modifyAmountInput.classList.add('is-invalid'); formValid = false; } else { modifyAmountInput.classList.remove('is-invalid'); }
    if (!modifyDescriptionInput.value.trim()) { modifyDescriptionInput.classList.add('is-invalid'); formValid = false; } else { modifyDescriptionInput.classList.remove('is-invalid'); }
    if (!modifyCategoryInput.value) { modifyCategoryInput.classList.add('is-invalid'); formValid = false; } else { modifyCategoryInput.classList.remove('is-invalid'); }

    if (!formValid) return;

    const updatedExpenseData: UpdateExpenseInput = {
        id: parseInt(modifyExpenseIdInput.value),
        date: modifyDateInput.value,
        amount: parseInt(modifyAmountValue),
        description: modifyDescriptionInput.value,
        category: modifyCategoryInput.value,
    };

    try {
        await updateExpense(updatedExpenseData);
        modifyExpenseModal.hide();
    } catch (error: any) {
        alert(error.message);
    }
}


function handleDeleteExpenseClick(event: Event, domElements: DOMElements): void {
    const { deleteConfirmModal, confirmDeleteBtn, deleteAmountInput, deleteWarning, deleteModalBody } = domElements;
    const target = event.target as HTMLElement;

    if (target.classList.contains('delete-btn')) {
        const expenseId = target.getAttribute('data-id');
        const expenseToDelete = allExpensesForMonth.find(exp => exp.rowid === parseInt(expenseId!));

        if (expenseToDelete) {
            deleteModalBody.textContent = `You are attempting to delete the expense for '${expenseToDelete.Description}' from ${expenseToDelete.Date.split('T')[0]}.`;
            confirmDeleteBtn.dataset.id = expenseId!;
            confirmDeleteBtn.dataset.amount = expenseToDelete.Amount.toString();

            // Reset form state
            deleteAmountInput.value = '';
            confirmDeleteBtn.disabled = true;
            deleteWarning.style.display = 'none';
            deleteAmountInput.classList.remove('is-invalid');
            
            deleteConfirmModal.show();
        }
    }
}

async function handleConfirmDelete(domElements: DOMElements): Promise<void> {
    const { deleteConfirmModal, confirmDeleteBtn } = domElements;
    const expenseId = parseInt(confirmDeleteBtn.dataset.id!);

    try {
        await deleteExpense(expenseId);
        deleteConfirmModal.hide();
    } catch (error: any) {
        alert(error.message);
    }
}

function applyFilter(categoryFilter: HTMLSelectElement): void {
    const selectedCategory = categoryFilter.value;
    if (selectedCategory === 'All') {
        renderExpenses(allExpensesForMonth);
    } else {
        const filteredExpenses = allExpensesForMonth.filter(expense => expense.Category === selectedCategory);
        renderExpenses(filteredExpenses);
    }
}

// --- Initialization ---
function initializeApp(domElements: DOMElements): void {
    const {
        expenseForm, expenseList, dateInput, amountInput, descriptionInput, categoryInput,
        addExpenseBtn, monthPicker, categoryFilter, deleteConfirmModal, confirmDeleteBtn, deleteAmountInput, deleteWarning,
        modifyExpenseModal, modifyExpenseForm, confirmModifyBtn
    } = domElements;

    // Set default date and month
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    dateInput.value = todayString;
    monthPicker.value = today.toISOString().slice(0, 7);

    // Event listeners for form input validation
    amountInput.addEventListener('input', () => {
        amountInput.value = formatNumber(amountInput.value);
        checkFormValidity(dateInput, amountInput, descriptionInput, categoryInput, addExpenseBtn);
        if (amountInput.value.replace(/\./g, '') !== '' && amountInput.value !== '-') {
            amountInput.classList.remove('is-invalid');
        }
    });

    [dateInput, descriptionInput].forEach(field => {
        field.addEventListener('input', () => {
            checkFormValidity(dateInput, amountInput, descriptionInput, categoryInput, addExpenseBtn);
            if (field.value.trim() !== '') {
                field.classList.remove('is-invalid');
            }
        });
    });

    categoryInput.addEventListener('change', () => {
        checkFormValidity(dateInput, amountInput, descriptionInput, categoryInput, addExpenseBtn);
        if (categoryInput.value) {
            categoryInput.classList.remove('is-invalid');
        }
    });

    // Event listener for adding expense
    expenseForm.addEventListener('submit', (e) => {
        // Pass DOM elements to the handler
        handleAddExpenseSubmit(e, domElements);
    });

    // Event listeners for expense list actions (modify, delete)
    expenseList.addEventListener('click', (e) => {
        handleModifyExpenseClick(e, domElements);
        handleDeleteExpenseClick(e, domElements);
    });

    // Event listeners for modal confirmations
    confirmModifyBtn.addEventListener('click', () => handleConfirmModify(domElements));
    confirmDeleteBtn.addEventListener('click', () => handleConfirmDelete(domElements));

    // Event listener for delete amount input validation
    deleteAmountInput.addEventListener('input', () => {
        deleteAmountInput.value = formatNumber(deleteAmountInput.value);
        validateDeleteConfirmation(deleteAmountInput, confirmDeleteBtn, deleteWarning, confirmDeleteBtn.dataset.amount || '');
    });

    // Month picker and category filter change events
    monthPicker.addEventListener('change', () => {
        fetchExpensesForMonth(monthPicker.value);
    });

    categoryFilter.addEventListener('change', () => {
        applyFilter(categoryFilter);
    });

    // Initial form validity check and fetch expenses
    checkFormValidity(dateInput, amountInput, descriptionInput, categoryInput, addExpenseBtn);
    fetchExpensesForMonth(monthPicker.value);
}

// --- Document Ready ---
document.addEventListener('DOMContentLoaded', () => {
    const domElements: DOMElements = {
        expenseForm: document.getElementById('expense-form') as HTMLFormElement,
        expenseList: document.getElementById('expense-list') as HTMLTableSectionElement,
        dateInput: document.getElementById('date') as HTMLInputElement,
        amountInput: document.getElementById('amount') as HTMLInputElement,
        descriptionInput: document.getElementById('description') as HTMLInputElement,
        categoryInput: document.getElementById('category') as HTMLSelectElement,
        addExpenseBtn: document.getElementById('add-expense-btn') as HTMLButtonElement,
        monthPicker: document.getElementById('month-picker') as HTMLInputElement,
        categoryFilter: document.getElementById('category-filter') as HTMLSelectElement,
        totalSummaryDiv: document.getElementById('total-summary') as HTMLDivElement,
        dailySpendingSummaryDiv: document.getElementById('daily-spending-summary') as HTMLDivElement,
        startOfMonthSummaryDiv: document.getElementById('start-of-month-summary') as HTMLDivElement,
        budgetedSummaryDiv: document.getElementById('budgeted-summary') as HTMLDivElement,
        otherSpendingSummaryDiv: document.getElementById('other-spending-summary') as HTMLDivElement,
        chartCanvas: document.getElementById('expense-chart') as HTMLCanvasElement,
        burndownCanvas: document.getElementById('burndown-chart') as HTMLCanvasElement,
        deleteConfirmModal: new bootstrap.Modal(document.getElementById('delete-confirm-modal') as HTMLElement),
        deleteModalBody: document.getElementById('delete-modal-body') as HTMLDivElement,
        confirmDeleteBtn: document.getElementById('confirm-delete-btn') as HTMLButtonElement,
        deleteAmountInput: document.getElementById('delete-amount-input') as HTMLInputElement,
        deleteWarning: document.getElementById('delete-warning') as HTMLDivElement,
        modifyExpenseModal: new bootstrap.Modal(document.getElementById('modify-expense-modal') as HTMLElement),
        modifyExpenseForm: document.getElementById('modify-expense-form') as HTMLFormElement,
        modifyExpenseIdInput: document.getElementById('modify-expense-id') as HTMLInputElement,
        modifyDateInput: document.getElementById('modify-date') as HTMLInputElement,
        modifyAmountInput: document.getElementById('modify-amount') as HTMLInputElement,
        modifyDescriptionInput: document.getElementById('modify-description') as HTMLInputElement,
        modifyCategoryInput: document.getElementById('modify-category') as HTMLSelectElement,
        confirmModifyBtn: document.getElementById('confirm-modify-btn') as HTMLButtonElement
    };
    initializeApp(domElements);
});
