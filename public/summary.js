const apiUrl = '/api/summary';

export function createSummaryApp(dom) {
    const { monthPicker, chartCanvas, totalDiv } = dom;
    let chart = null;

    const today = new Date();
    monthPicker.value = today.toISOString().slice(0, 7);

    async function fetchAndRender() {
        const [year, month] = monthPicker.value.split('-');
        const resp = await fetch(`${apiUrl}?year=${year}&month=${month}`);
        const data = await resp.json();
        const labels = data.map(d => d.category);
        const values = data.map(d => d.spend_vnd);
        const total = values.reduce((sum, v) => sum + v, 0);
        totalDiv.textContent = `Total: ${total.toLocaleString('vi-VN')} ₫`;

        if (chart) chart.destroy();
        chart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Spend (VND)',
                    data: values,
                    backgroundColor: '#36A2EB',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Spending by Category' }
                }
            }
        });
    }

    monthPicker.addEventListener('change', fetchAndRender);
    fetchAndRender();

    return { fetchAndRender };
}
