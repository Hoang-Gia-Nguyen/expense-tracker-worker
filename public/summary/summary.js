const apiUrl = '/api/summary';
const dailyCategories = ['Food', 'Medical/Utility', 'Transportation', 'Entertainment'];
const categoryColors = {
    'Food': '#FF6384',
    'Medical/Utility': '#4BC0C0',
    'Transportation': '#36A2EB',
    'Entertainment': '#9966FF',
};

export function createSummaryApp(dom) {
    const { categoryChartsDiv, totalCanvas } = dom;
    let charts = [];

    async function fetchAndRender() {
        const now = new Date();
        const months = [];
        const requests = [];
        for (let i = 6; i >= 1; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            months.push(`${year}-${month}`);
            requests.push(fetch(`${apiUrl}?year=${year}&month=${month}`).then(r => r.json()));
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

        charts.forEach(c => c.destroy());
        charts = [];
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
            const chart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: cat,
                        data: dataByCategory[cat],
                        borderColor: categoryColors[cat],
                        backgroundColor: categoryColors[cat],
                        fill: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: `${cat} Spending` },
                    }
                }
            });
            charts.push(chart);
        });

        const totalChart = new Chart(totalCanvas, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Total',
                    data: totals,
                    borderColor: '#FFCE56',
                    backgroundColor: '#FFCE56',
                    fill: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Total Spending' },
                }
            }
        });
        charts.push(totalChart);
    }

    return { fetchAndRender };
}
