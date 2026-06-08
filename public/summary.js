/**
 * Summary page logic - fetches and displays comprehensive monthly summary
 */

import { applyThemeToChart } from './chartTheme.js';
const apiBase = '/api/summary';

// Category colors for charts - dynamic palette for any category
const categoryColorPalette = [
    '#FF6384', '#4BC0C0', '#36A2EB', '#9966FF', '#FFCE56',
    '#FF9F40', '#7BC8A4', '#E7E9ED', '#B57295', '#59C7EB',
    '#C9CBCF', '#F4A261', '#2A9D8F', '#E76F51', '#E9C46A',
    '#264653', '#A855F7', '#06B6D4', '#F97316', '#84CC16',
];

function getCategoryColor(index) {
    return categoryColorPalette[index % categoryColorPalette.length];
}

/**
 * Format currency in VND
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(amount);
}

/**
 * Format a year-month string for display
 */
function formatYearMonth(yearMonth) {
    const [y, m] = yearMonth.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

/**
 * Format a date string for display
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Get the most recent month with data from available data
 */
function getDefaultMonth() {
    const now = new Date();
    // Default to most recent complete month (last month if we're early in current month)
    const target = new Date(now);
    target.setDate(1);
    target.setMonth(target.getMonth() - 1);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    return { year, month, yearMonth: `${year}-${month}` };
}

/**
 * Fetch wrapper with error handling
 */
async function apiFetch(url) {
    const response = await fetch(url);
    if (!response.ok) {
        let message = `API error: ${response.status}`;
        try {
            message = await response.text();
        } catch (_) {}
        throw new Error(message);
    }
    return response.json();
}

/**
 * Create summary app - main controller
 */
export function createSummaryApp(dom) {
    const {
        monthPicker,
        loadingSpinner,
        errorMessage,
        statsCards,
        doughnutCanvas,
        totalCanvas,
        categoryChartsDiv,
        comparisonCanvas,
        categoryTableSection,
        categoryTableBody,
        topTransactionsSection,
        topTransactionsBody,
        ytdSection,
        ytdMonthlyCanvas,
        ytdCategoryCanvas,
    } = dom;

    let charts = [];

    function destroyCharts() {
        charts.forEach(c => c.destroy());
        charts = [];
    }

    function showLoading() {
        loadingSpinner.classList.remove('d-none');
        errorMessage.classList.add('d-none');
    }

    function hideLoading() {
        loadingSpinner.classList.add('d-none');
    }

    function showError(message) {
        hideLoading();
        errorMessage.textContent = `Error loading summary: ${message}`;
        errorMessage.classList.remove('d-none');
    }

    // ===== Month Picker =====
    function setupMonthPicker(onChange) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        monthPicker.max = `${currentYear}-${currentMonth}`;

        monthPicker.addEventListener('change', () => {
            if (monthPicker.value) {
                onChange(monthPicker.value);
            }
        });
    }

    // ===== Stats Cards =====
    async function renderStatsCards(year, month) {
        try {
            const data = await apiFetch(`${apiBase}/stats?year=${year}&month=${month}`);

            const deltaClass = data.vsLastMonth.amount >= 0 ? 'text-danger' : 'text-success';
            const deltaIcon = data.vsLastMonth.amount >= 0 ? 'bi-arrow-up' : 'bi-arrow-down';

            statsCards.innerHTML = `
                <div class="col-6 col-md-3">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body text-center">
                            <div class="text-muted small mb-1">Total Spent</div>
                            <div class="fs-5 fw-bold">${formatCurrency(data.totalSpent)}</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body text-center">
                            <div class="text-muted small mb-1">Avg Daily</div>
                            <div class="fs-5 fw-bold">${formatCurrency(data.avgDaily)}</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body text-center">
                            <div class="text-muted small mb-1">Transactions</div>
                            <div class="fs-5 fw-bold">${data.transactionCount}</div>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body text-center">
                            <div class="text-muted small mb-1">Biggest Category</div>
                            <div class="fs-5 fw-bold">${data.biggestCategory ? data.biggestCategory.name : 'N/A'}</div>
                            <div class="small">${data.biggestCategory ? formatCurrency(data.biggestCategory.amount) : ''}</div>
                        </div>
                    </div>
                </div>
                <div class="col-12 mt-2">
                    <div class="card shadow-sm border-0">
                        <div class="card-body text-center py-2">
                            <span class="text-muted">vs last month:</span>
                            <span class="${deltaClass} fw-semibold ms-1">
                                <i class="bi ${deltaIcon}"></i>
                                ${formatCurrency(Math.abs(data.vsLastMonth.amount))}
                                (${data.vsLastMonth.percent >= 0 ? '+' : ''}${data.vsLastMonth.percent}%)
                            </span>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            statsCards.innerHTML = `<div class="col-12"><div class="alert alert-warning">Could not load stats: ${err.message}</div></div>`;
        }
    }

    // ===== Doughnut Chart =====
    async function renderDoughnutChart(year, month) {
        try {
            const data = await apiFetch(`${apiBase}/categories?year=${year}&month=${month}`);

            if (data.length === 0) {
                return;
            }

            const labels = data.map(c => c.category);
            const values = data.map(c => c.spend_vnd);
            const colors = data.map((_, i) => getCategoryColor(i));

            const chart = new Chart(doughnutCanvas, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 1,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { boxWidth: 12, padding: 10 },
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const pct = ((context.parsed / total) * 100).toFixed(1);
                                    return `${context.label}: ${formatCurrency(context.parsed)} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
            charts.push(chart);
            applyThemeToChart(chart);
        } catch (err) {
            console.error('Error rendering doughnut chart:', err);
        }
    }

    // ===== Total Spending Line Chart (last 6 months) =====
    async function renderTotalLineChart() {
        const now = new Date();
        const months = [];
        const requests = [];
        for (let i = 6; i >= 1; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            months.push(`${y}-${m}`);
            requests.push(
                apiFetch(`${apiBase}?year=${y}&month=${m}`)
                    .then(data => data.reduce((sum, cat) => sum + cat.spend_vnd, 0))
                    .catch(() => 0)
            );
        }

        const totals = await Promise.all(requests);

        const labels = months.map(m => {
            const [y, mo] = m.split('-');
            const date = new Date(parseInt(y), parseInt(mo) - 1, 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        const chart = new Chart(totalCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Total Spending',
                    data: totals,
                    borderColor: '#FFCE56',
                    backgroundColor: 'rgba(255, 206, 86, 0.1)',
                    fill: true,
                    tension: 0.3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000) {
                                    return (value / 1000000).toFixed(1) + 'M';
                                }
                                if (value >= 1000) {
                                    return (value / 1000).toFixed(0) + 'K';
                                }
                                return value;
                            }
                        }
                    }
                }
            }
        });
        charts.push(chart);
        applyThemeToChart(chart);
    }

    // ===== Category Line Charts (original 4 categories) =====
    async function renderCategoryLineCharts() {
        const dailyCategories = ['Food', 'Medical/Utility', 'Transportation', 'Entertainment'];
        const categoryColors = {
            'Food': '#FF6384',
            'Medical/Utility': '#4BC0C0',
            'Transportation': '#36A2EB',
            'Entertainment': '#9966FF',
        };

        const now = new Date();
        const months = [];
        const requests = [];
        for (let i = 6; i >= 1; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            months.push(`${y}-${m}`);
            requests.push(
                apiFetch(`${apiBase}?year=${y}&month=${m}`).catch(() => [])
            );
        }

        const results = await Promise.all(requests);
        const dataByCategory = {};
        dailyCategories.forEach(cat => dataByCategory[cat] = []);
        const totals = [];

        results.forEach(monthData => {
            let monthTotal = 0;
            monthData.forEach(d => { monthTotal += d.spend_vnd; });
            totals.push(monthTotal);
            dailyCategories.forEach(cat => {
                const entry = monthData.find(d => d.category === cat);
                dataByCategory[cat].push(entry ? entry.spend_vnd : 0);
            });
        });

        categoryChartsDiv.innerHTML = '';

        dailyCategories.forEach(cat => {
            const col = document.createElement('div');
            col.className = 'col-12 col-md-6';
            const container = document.createElement('div');
            container.className = 'chart-container';
            const canvas = document.createElement('canvas');
            container.appendChild(canvas);
            col.appendChild(container);
            categoryChartsDiv.appendChild(col);

            const labels = months.map(m => {
                const [y, mo] = m.split('-');
                const date = new Date(parseInt(y), parseInt(mo) - 1, 1);
                return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            });

            const chart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: cat,
                        data: dataByCategory[cat],
                        borderColor: categoryColors[cat],
                        backgroundColor: categoryColors[cat],
                        fill: false,
                        tension: 0.3,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: `${cat} Spending` },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                                    return value;
                                }
                            }
                        }
                    }
                }
            });
            charts.push(chart);
            applyThemeToChart(chart);
        });
    }

    // ===== Month-over-Month Bar Chart =====
    async function renderComparisonChart(year, month) {
        try {
            const data = await apiFetch(`${apiBase}/comparison?year=${year}&month=${month}`);

            if (data.length === 0) {
                comparisonCanvas.parentElement.innerHTML = '<p class="text-muted text-center mt-4">No data available for comparison.</p>';
                return;
            }

            // Show only top 8 categories for readability
            const sorted = data.sort((a, b) => Math.max(b.current, b.previous) - Math.max(a.current, a.previous));
            const top = sorted.slice(0, 8);

            const labels = top.map(c => c.category);
            const currentData = top.map(c => c.current);
            const previousData = top.map(c => c.previous);

            const chart = new Chart(comparisonCanvas, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Current Month',
                            data: currentData,
                            backgroundColor: 'rgba(54, 162, 235, 0.7)',
                            borderColor: '#36A2EB',
                            borderWidth: 1,
                        },
                        {
                            label: 'Previous Month',
                            data: previousData,
                            backgroundColor: 'rgba(255, 159, 64, 0.7)',
                            borderColor: '#FF9F40',
                            borderWidth: 1,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                                    return value;
                                }
                            }
                        }
                    }
                }
            });
            charts.push(chart);
            applyThemeToChart(chart);
        } catch (err) {
            console.error('Error rendering comparison chart:', err);
        }
    }

    // ===== Category Data Table =====
    async function renderCategoryTable(year, month) {
        try {
            const data = await apiFetch(`${apiBase}/categories?year=${year}&month=${month}`);

            if (data.length === 0) {
                categoryTableSection.classList.add('d-none');
                return;
            }

            categoryTableSection.classList.remove('d-none');

            const rows = data.map(c => {
                const deltaClass = c.vsLastMonth >= 0 ? 'text-danger' : 'text-success';
                const deltaSign = c.vsLastMonth >= 0 ? '+' : '';
                const color = getCategoryColor(data.indexOf(c));
                return `
                    <tr>
                        <td>
                            <span class="badge" style="background-color:${color}">&nbsp;</span>
                            ${c.category}
                        </td>
                        <td class="text-end">${formatCurrency(c.spend_vnd)}</td>
                        <td class="text-end">${c.percentOfTotal.toFixed(1)}%</td>
                        <td class="text-end ${deltaClass}">${deltaSign}${formatCurrency(c.vsLastMonth)}</td>
                    </tr>
                `;
            }).join('');

            categoryTableBody.innerHTML = rows;
        } catch (err) {
            console.error('Error rendering category table:', err);
        }
    }

    // ===== Top Transactions =====
    async function renderTopTransactions(year, month) {
        try {
            const data = await apiFetch(`${apiBase}/top-transactions?year=${year}&month=${month}&limit=10`);

            if (data.length === 0) {
                topTransactionsSection.classList.add('d-none');
                return;
            }

            topTransactionsSection.classList.remove('d-none');

            const rows = data.map((tx, index) => `
                <tr>
                    <td>${formatDate(tx.date)}</td>
                    <td>${tx.description}</td>
                    <td><span class="badge bg-secondary">${tx.category}</span></td>
                    <td class="text-end">
                        <strong>${formatCurrency(tx.amount)}</strong>
                        ${index === 0 ? '<i class="bi bi-trophy-fill text-warning ms-2"></i>' : ''}
                    </td>
                </tr>
            `).join('');

            topTransactionsBody.innerHTML = rows;
        } catch (err) {
            console.error('Error rendering top transactions:', err);
        }
    }

    // ===== Year-to-Date Overview =====
    async function renderYtd(year) {
        try {
            const data = await apiFetch(`${apiBase}/ytd?year=${year}`);

            if (data.totalSpent === 0) {
                ytdSection.classList.add('d-none');
                return;
            }

            ytdSection.classList.remove('d-none');

            // Monthly bar chart
            const monthlyLabels = data.monthlyBreakdown.map(m => {
                const [y, mo] = m.year_month.split('-');
                const date = new Date(parseInt(y), parseInt(mo) - 1, 1);
                return date.toLocaleDateString('en-US', { month: 'short' });
            });
            const monthlyValues = data.monthlyBreakdown.map(m => m.total);

            const monthlyChart = new Chart(ytdMonthlyCanvas, {
                type: 'bar',
                data: {
                    labels: monthlyLabels,
                    datasets: [{
                        label: 'Monthly Spending',
                        data: monthlyValues,
                        backgroundColor: 'rgba(75, 192, 192, 0.7)',
                        borderColor: '#4BC0C0',
                        borderWidth: 1,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: `Monthly Spending (${year})` },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                                    return value;
                                }
                            }
                        }
                    }
                }
            });
            charts.push(monthlyChart);
            applyThemeToChart(monthlyChart);

            // Category doughnut chart for YTD
            const catLabels = data.categoryBreakdown.map(c => c.category);
            const catValues = data.categoryBreakdown.map(c => c.total);
            const catColors = catLabels.map((_, i) => getCategoryColor(i));

            const catChart = new Chart(ytdCategoryCanvas, {
                type: 'doughnut',
                data: {
                    labels: catLabels,
                    datasets: [{
                        data: catValues,
                        backgroundColor: catColors,
                        borderWidth: 1,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { boxWidth: 12, padding: 8, font: { size: 10 } },
                        },
                        title: { display: true, text: `Category Breakdown (${year})` },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const pct = ((context.parsed / total) * 100).toFixed(1);
                                    return `${context.label}: ${formatCurrency(context.parsed)} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
            charts.push(catChart);
            applyThemeToChart(catChart);
        } catch (err) {
            console.error('Error rendering YTD:', err);
        }
    }

    // ===== Main fetch and render =====
    async function fetchAndRender(yearMonth) {
        try {
            showLoading();
            destroyCharts();

            const [year, month] = yearMonth.split('-');

            // Run independent fetches in parallel where possible
            await Promise.all([
                renderStatsCards(year, month),
                renderDoughnutChart(year, month),
                renderCategoryTable(year, month),
                renderTopTransactions(year, month),
                renderComparisonChart(year, month),
            ]);

            // These depend on multi-month data
            await Promise.all([
                renderTotalLineChart(),
                renderCategoryLineCharts(),
            ]);

            // YTD for the selected year
            await renderYtd(year);

            hideLoading();
        } catch (err) {
            console.error('Error fetching summary:', err);
            showError(err.message);
        }
    }

    // ===== Init =====
    async function init() {
        const defaultMonth = getDefaultMonth();
        monthPicker.value = defaultMonth.yearMonth;

        setupMonthPicker((value) => {
            fetchAndRender(value);
        });

        await fetchAndRender(defaultMonth.yearMonth);
    }


    // Listen for theme changes to update chart colors without re-fetching
    window.addEventListener('theme-changed', function() {
      charts.forEach(function(chart) { applyThemeToChart(chart); });
    });
    return { init, fetchAndRender };
}
