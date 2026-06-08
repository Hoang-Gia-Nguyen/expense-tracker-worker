const apiUrl = '/api/summary';

const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#7BC225', '#58508d', '#bc5090',
    '#ff6361', '#ffa600'
];

export function createSummaryApp(dom) {
    const { categoryChartsDiv, totalCanvas } = dom; // totalCanvas is now trends-chart
    let trendsChart = null;
    let breakdownChart = null;

    function formatVND(value) {
        return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
    }

    async function fetchAndRender() {
        const now = new Date();
        const months = [];
        const requests = [];

        // Fetch last 7 months to calculate % change for the current month
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            months.push(`${year}-${month}`);
            requests.push(fetch(`${apiUrl}?year=${year}&month=${month}`).then(r => r.json()));
        }

        const results = await Promise.all(requests);

        // 1. Process all categories found across all months
        const allCategoriesSet = new Set();
        results.forEach(monthData => {
            monthData.forEach(item => allCategoriesSet.add(item.category));
        });
        const categories = Array.from(allCategoriesSet);

        // 2. Organize data for Stacked Chart
        const datasets = categories.map((cat, idx) => ({
            label: cat,
            data: results.map(monthData => {
                const entry = monthData.find(d => d.category === cat);
                return entry ? entry.spend_vnd : 0;
            }),
            backgroundColor: colors[idx % colors.length],
            borderColor: colors[idx % colors.length],
            fill: true
        }));

        const totals = results.map(monthData =>
            monthData.reduce((sum, item) => sum + item.spend_vnd, 0)
        );

        // 3. Metrics
        const currentTotal = totals[6];
        const lastTotal = totals[5];
        const avgTotal = totals.slice(1).reduce((a, b) => a + b, 0) / 6;

        document.getElementById('metric-total-current').textContent = formatVND(currentTotal);
        document.getElementById('metric-avg').textContent = formatVND(avgTotal);

        const changeEl = document.getElementById('metric-change');
        if (lastTotal > 0) {
            const pct = ((currentTotal - lastTotal) / lastTotal) * 100;
            changeEl.textContent = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs last month`;
            changeEl.className = pct > 0 ? 'small text-danger' : 'small text-success';
        }

        const currentMonthData = results[6];
        if (currentMonthData.length > 0) {
            const top = [...currentMonthData].sort((a, b) => b.spend_vnd - a.spend_vnd)[0];
            document.getElementById('metric-top-category').textContent = top.category;
            document.getElementById('metric-top-value').textContent = formatVND(top.spend_vnd);
        }

        // 4. Render Stacked Trends Chart
        if (trendsChart) trendsChart.destroy();
        trendsChart = new Chart(document.getElementById('trends-chart'), {
            type: 'line',
            data: {
                labels: months,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { mode: 'index' }
                },
                scales: {
                    y: { stacked: true, beginAtZero: true },
                    x: { grid: { display: false } }
                }
            }
        });

        // 5. Render Breakdown Donut Chart
        if (breakdownChart) breakdownChart.destroy();
        breakdownChart = new Chart(document.getElementById('breakdown-chart'), {
            type: 'doughnut',
            data: {
                labels: currentMonthData.map(d => d.category),
                datasets: [{
                    data: currentMonthData.map(d => d.spend_vnd),
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    return { fetchAndRender };
}
