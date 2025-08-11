const apiUrl = '/api/expense';
const monthlyBudget = {
    'Food': 5000000,
    'Medical/Utility': 2000000,
    'Transportation': 1000000,
    'Entertainment': 1500000,
    'Home': 2000000,
    'Baby': 15000000,
};
const totalBudget = 20000000;

const categoryConfig = {
    'Food': { color: '#FF6384' },
    'Medical/Utility': { color: '#4BC0C0' },
    'Home': { color: '#FFCE56' },
    'Transportation': { color: '#36A2EB' },
    'Entertainment': { color: '#9966FF' },
    'Baby': { color: '#FF9F40' },
    'Gift': { color: '#C9CBCF' },
    'Other': { color: '#808080' },
};
const categoryOrder = ['Food', 'Baby', 'Medical/Utility', 'Home', 'Transportation', 'Entertainment', 'Gift', 'Other'];
const startOfMonthCategories = ['Home', 'Baby'];

export function createExpenseTrackerApp(domElements) {
    // Moved inside to ensure correct scope
    function formatNumber(value) {
        return value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    // Moved inside to ensure correct scope
    function getProgressBarColor(percentage) {
        if (percentage > 100) return 'bg-danger';
        if (percentage > 75) return 'bg-warning';
        return 'bg-success';
    }

    const {
        expenseForm, expenseList, dateInput, amountInput, descriptionInput, categoryInput,
        addExpenseBtn, monthPicker, categoryFilter, totalSummaryDiv, dailySpendingSummaryDiv,
        startOfMonthSummaryDiv, budgetedSummaryDiv, otherSpendingSummaryDiv, chartCanvas, burndownCanvas,
        deleteConfirmModal, deleteModalBody, confirmDeleteBtn, deleteAmountInput, deleteWarning,
        modifyExpenseModal, modifyExpenseForm, modifyExpenseIdInput, modifyDateInput,
        modifyAmountInput, modifyDescriptionInput, modifyCategoryInput, confirmModifyBtn
    } = domElements;

    let expenseChart = null;
    let burndownChart = null;
    let allExpensesForMonth = [];

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    dateInput.value = todayString;
    monthPicker.value = today.toISOString().slice(0, 7);

    amountInput.addEventListener('input', (e) => {
        // Removed cursor position logic for testing in JSDOM
        const formattedValue = formatNumber(e.target.value);
        e.target.value = formattedValue;
    });

    function checkFormValidity() {
        const fields = [dateInput, amountInput, descriptionInput, categoryInput];
        const allFieldsFilled = fields.every(field => field.value.trim() !== '');
        addExpenseBtn.disabled = !allFieldsFilled;
    }

    function validateAndHighlight() {
        const fields = [dateInput, amountInput, descriptionInput, categoryInput];
        let allValid = true;

        fields.forEach(field => {
            if (!field.value.trim()) {
                allValid = false;
                field.classList.add('is-invalid');
            } else {
                field.classList.remove('is-invalid');
            }
        });

        return allValid;
    }

    function renderChart(summary) {
        const chartLabels = [];
        const chartData = [];
        const chartColors = [];

        const budgetedCategories = categoryOrder.filter(category => monthlyBudget.hasOwnProperty(category) && !startOfMonthCategories.includes(category));

        budgetedCategories.forEach(category => {
            if (summary[category] > 0) {
                chartLabels.push(category);
                chartData.push(summary[category]);
                chartColors.push(categoryConfig[category]?.color || '#808080');
            }
        });

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
    function renderBurndownChart(data) {
        const [year, month] = monthPicker.value.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();

        const dailySpendingCategories = categoryOrder.filter(category => monthlyBudget.hasOwnProperty(category) && !startOfMonthCategories.includes(category));
        const dailyBudget = dailySpendingCategories.reduce((sum, category) => sum + (monthlyBudget[category] || 0), 0);

        const dailyTotals = Array(daysInMonth).fill(0);
        data.forEach(expense => {
            const date = new Date(expense.Date);
            const expMonth = String(date.getMonth() + 1).padStart(2, '0');
            const expYear = String(date.getFullYear());
            if (expYear === year && expMonth === month && dailySpendingCategories.includes(expense.Category)) {
                dailyTotals[date.getDate() - 1] += expense.Amount;
            }
        });

        const actual = [];
        const currentYear = String(today.getFullYear());
        const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
        const currentDay = today.getDate();
        const isCurrentMonth = year === currentYear && month === currentMonth;
        let running = 0;
        for (let i = 0; i < daysInMonth; i++) {
            running += dailyTotals[i];
            if (isCurrentMonth && i >= currentDay) {
                actual.push(null);
            } else {
                actual.push(running);
            }
        }

        const expected = [];
        const dailyRate = dailyBudget / daysInMonth;
        for (let i = 0; i < daysInMonth; i++) {
            expected.push(dailyRate * (i + 1));
        }

        const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

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

    function renderSummaries(data) {
        const summary = data.reduce((acc, expense) => {
            const category = expense.Category;
            const amount = expense.Amount;
            if (!acc[category]) {
                acc[category] = 0;
            }
            acc[category] += amount;
            return acc;
        }, {});

        renderChart(summary);
        renderBurndownChart(data);

        // Clear existing content to reset animations
        totalSummaryDiv.innerHTML = '';
        dailySpendingSummaryDiv.innerHTML = '';
        startOfMonthSummaryDiv.innerHTML = '';
        budgetedSummaryDiv.innerHTML = '';
        otherSpendingSummaryDiv.innerHTML = '';

        // Recalculate and render with animation
        setTimeout(() => {
            const totalSpent = Object.values(summary).reduce((sum, total) => sum + total, 0);
            const totalPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
            const totalProgressBarColor = getProgressBarColor(totalPercentage);

            totalSummaryDiv.innerHTML = `
                <div class="card text-center">
                    <div class="card-header">Monthly Summary</div>
                    <div class="card-body">
                        <h5 class="card-title">Total Spent: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalSpent)}</h5>
                        <p class="card-text">Total Budget: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalBudget)}</p>
                        <div class="progress" style="height: 25px;">
                            <div class="progress-bar ${totalProgressBarColor}" role="progressbar" style="width: ${totalPercentage}%;" aria-valuenow="${totalPercentage}" aria-valuemin="0" aria-valuemax="100">${totalPercentage}%</div>
                        </div>
                    </div>
                </div>
            `;

            const dailySpendingCategories = categoryOrder.filter(category => monthlyBudget.hasOwnProperty(category) && !startOfMonthCategories.includes(category));
            const dailySpent = dailySpendingCategories.reduce((sum, category) => sum + (summary[category] || 0), 0);
            const dailyBudget = dailySpendingCategories.reduce((sum, category) => sum + (monthlyBudget[category] || 0), 0);
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
            startOfMonthCategories.forEach(category => {
                const budget = monthlyBudget[category] || 0;
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
            Object.entries(monthlyBudget).filter(([category]) => !startOfMonthCategories.includes(category)).forEach(([category, budget]) => {
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

            const otherSpending = Object.entries(summary).filter(([category]) => !monthlyBudget[category]);
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

    function renderExpenses(data) {
        expenseList.innerHTML = '';

        // Sort expenses by date in descending order
        data.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        // Group expenses by date
        const groupedExpenses = data.reduce((acc, expense) => {
            const date = expense.Date;
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(expense);
            return acc;
        }, {});

        // Render expenses with date separators
        for (const date in groupedExpenses) {
            // Add a date separator row
            const separatorRow = document.createElement('tr');
            separatorRow.classList.add('date-separator');
            separatorRow.innerHTML = `<td colspan="5">${date}</td>`;
            expenseList.appendChild(separatorRow);

            // Add expense rows for that date
            groupedExpenses[date].forEach((expense) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(expense.Amount)}</td>
                    <td>${expense.Description}</td>
                    <td>${expense.Category}</td>
                    <td class="actions-cell">
                        <button class="btn btn-info btn-sm" data-id="${expense.rowid}">Modify</button>
                        <button class="btn btn-danger btn-sm" data-id="${expense.rowid}">Delete</button>
                    </td>
                `;
                expenseList.appendChild(row);
            });
        }
    }

    // --- Local filtering function ---
    function applyFilter() {
        const selectedCategory = categoryFilter.value;
        if (selectedCategory === 'All') {
            renderExpenses(allExpensesForMonth);
        } else {
            const filteredExpenses = allExpensesForMonth.filter(expense => expense.Category === selectedCategory);
            renderExpenses(filteredExpenses);
        }
    }

    async function fetchExpensesForMonth() {
        const [year, month] = monthPicker.value.split('-');
        try {
            const response = await fetch(`${apiUrl}?year=${year}&month=${month}`);
            if (response.ok) {
                allExpensesForMonth = await response.json();
                renderSummaries(allExpensesForMonth); // Render summaries based on all data
                applyFilter(); // Apply the current filter to the transaction list
            } else {
                console.error('Failed to fetch expenses:', await response.text());
                expenseList.innerHTML = '<tr><td colspan="5" class="text-center">Error loading data.</td></tr>';
                totalSummaryDiv.innerHTML = '';
                dailySpendingSummaryDiv.innerHTML = '';
                startOfMonthSummaryDiv.innerHTML = '';
                budgetedSummaryDiv.innerHTML = '';
                otherSpendingSummaryDiv.innerHTML = '';
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
            expenseList.innerHTML = '<tr><td colspan="5" class="text-center">Could not connect to the server.</td></tr>';
            totalSummaryDiv.innerHTML = '';
            dailySpendingSummaryDiv.innerHTML = '';
            startOfMonthSummaryDiv.innerHTML = '';
            budgetedSummaryDiv.innerHTML = '';
            otherSpendingSummaryDiv.innerHTML = '';
        }
    }

    async function addExpense(e) {
        e.preventDefault();
        if (!validateAndHighlight()) {
            return;
        }

        // Disable button to prevent multiple submissions
        addExpenseBtn.disabled = true;

        const newExpense = {
            date: dateInput.value,
            amount: parseInt(amountInput.value.replace(/\./g, '')),
            description: descriptionInput.value,
            category: categoryInput.value,
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newExpense),
            });

            if (response.ok) {
                console.log('Expense sent successfully!');
                fetchExpensesForMonth(); // Refetch all data for the month
                expenseForm.reset();
                dateInput.value = todayString;
            } else {
                console.error('Failed to send expense:', await response.text());
                alert(`Failed to add expense. Server responded: ${response.statusText}. Please try again.`);
            }
        } catch (error) {
            console.error('Error sending expense:', error);
            alert('Could not connect to the server to add the expense.');
        } finally {
            addExpenseBtn.disabled = false;
        }
    }

    function modifyExpense(e) {
        const expenseId = e.target.getAttribute('data-id');
        const expenseToModify = allExpensesForMonth.find(exp => exp.rowid == expenseId);

        if (expenseToModify) {
            modifyExpenseIdInput.value = expenseToModify.rowid;
            modifyDateInput.value = expenseToModify.Date;
            modifyAmountInput.value = formatNumber(expenseToModify.Amount.toString());
            modifyDescriptionInput.value = expenseToModify.Description;
            modifyCategoryInput.value = expenseToModify.Category;
            modifyExpenseModal.show();
        }
    }

    async function handleConfirmModify() {
        const expenseId = modifyExpenseIdInput.value;
        const updatedExpense = {
            id: parseInt(expenseId),
            date: modifyDateInput.value,
            amount: parseInt(modifyAmountInput.value.replace(/\./g, '')),
            description: modifyDescriptionInput.value,
            category: modifyCategoryInput.value,
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedExpense),
            });

            if (response.ok) {
                console.log('Expense updated successfully!');
                fetchExpensesForMonth(); // Refetch all data for the month
            } else {
                console.error('Failed to update expense:', await response.text());
                alert('Error: Could not update the expense on the server.');
            }
        } catch (error) {
            console.error('Error updating expense:', error);
            alert('Error: Could not connect to the server to update the expense.');
        } finally {
            modifyExpenseModal.hide();
        }
    }

    async function deleteExpense(e) {
        if (!e.target.classList.contains('btn-danger')) return;

        const expenseId = e.target.getAttribute('data-id');
        const expenseToDelete = allExpensesForMonth.find(exp => exp.rowid == expenseId);

        if (expenseToDelete) {
            // Set modal content and store data
            deleteModalBody.textContent = `You are attempting to delete the expense for '${expenseToDelete.Description}' from ${expenseToDelete.Date}.`;
            confirmDeleteBtn.dataset.id = expenseId;
            confirmDeleteBtn.dataset.amount = expenseToDelete.Amount;

            // Reset form state
            deleteAmountInput.value = '';
            confirmDeleteBtn.disabled = true;
            deleteWarning.style.display = 'none';
            deleteAmountInput.classList.remove('is-invalid');
            
            deleteConfirmModal.show();
        }
    }

    function validateDeleteConfirmation() {
        const correctAmount = confirmDeleteBtn.dataset.amount;
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

    deleteAmountInput.addEventListener('input', (e) => {
        // Removed cursor position logic for testing in JSDOM
        const formattedValue = formatNumber(e.target.value);
        e.target.value = formattedValue;
        
        validateDeleteConfirmation();
    });

    async function handleConfirmDelete() {
        const expenseId = confirmDeleteBtn.dataset.id;
        if (!expenseId) return;

        try {
            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: expenseId }),
            });

            if (response.ok) {
                console.log('Expense deleted successfully!');
                fetchExpensesForMonth(); // Refetch all data for the month
            } else {
                console.error('Failed to delete expense:', await response.text());
                alert('Error: Could not delete the expense from the server.');
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Error: Could not connect to the server to delete the expense.');
        } finally {
            deleteConfirmModal.hide();
        }
    }

    [dateInput, amountInput, descriptionInput, categoryInput].forEach(input => {
        input.addEventListener('input', () => {
            checkFormValidity();
            if (input.value.trim() !== '') {
                input.classList.remove('is-invalid');
            }
        });
    });

    monthPicker.addEventListener('change', fetchExpensesForMonth);
    categoryFilter.addEventListener('change', applyFilter); // Just apply the filter locally
    expenseForm.addEventListener('submit', addExpense);
    expenseList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-danger')) {
            deleteExpense(e);
        } else if (e.target.classList.contains('btn-info')) {
            modifyExpense(e);
        }
    });
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    confirmModifyBtn.addEventListener('click', handleConfirmModify);

    // Initial load
    fetchExpensesForMonth();
    checkFormValidity();

    return {
        fetchExpensesForMonth,
        addExpense,
        modifyExpense,
        deleteExpense,
        handleConfirmModify,
        handleConfirmDelete,
        checkFormValidity,
        validateAndHighlight,
        renderChart,
        renderSummaries,
        renderExpenses,
        applyFilter,
        formatNumber,
        getProgressBarColor,
        validateDeleteConfirmation
    };
}

document.addEventListener('DOMContentLoaded', () => {
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
    createExpenseTrackerApp(domElements);
});
