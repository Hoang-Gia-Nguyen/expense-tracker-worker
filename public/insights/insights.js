document.addEventListener("DOMContentLoaded", () => {
    loadInsights();
});

async function loadInsights() {
    const res = await fetch("/api/insights");
    const data = await res.json();

    renderChart(data.dailySeries);
    renderDailySpikes(data.dailySpikes);
    renderCategorySpikes(data.categorySpikes);
    renderTopTransactions(data.topTransactions);
}

function renderChart(series) {
    const ctx = document.getElementById("dailyChart");

    new Chart(ctx, {
        type: "line",
        data: {
            labels: series.map(d => d.date),
            datasets: [{
                label: "Daily Spending (VND)",
                data: series.map(d => d.total),
                tension: 0.3
            }]
        }
    });
}

function renderDailySpikes(spikes) {
    const container = document.getElementById("dailySpikes");
    container.innerHTML = "";

    if (spikes.length === 0) {
        container.innerHTML = "<p class='text-muted'>No abnormal daily spending detected.</p>";
        return;
    }

    spikes.forEach(s => {
        container.innerHTML += `
            <div class="mb-3 border-bottom pb-2">
                <strong>${s.date}</strong><br/>
                ${formatVND(s.total)}<br/>
                <small class="text-danger">
                    ${s.multiplier.toFixed(2)}× higher than average
                </small>
            </div>
        `;
    });
}

function renderCategorySpikes(spikes) {
    const container = document.getElementById("categorySpikes");
    container.innerHTML = "";

    if (spikes.length === 0) {
        container.innerHTML = "<p class='text-muted'>No abnormal category spending.</p>";
        return;
    }

    spikes.forEach(s => {
        container.innerHTML += `
            <div class="mb-3 border-bottom pb-2">
                <strong>${s.category}</strong><br/>
                ${formatVND(s.current)}<br/>
                <small class="text-warning">
                    +${s.percentIncrease.toFixed(0)}% vs 6-month average
                </small>
            </div>
        `;
    });
}

function renderTopTransactions(rows) {
    const tbody = document.getElementById("topTransactions");
    tbody.innerHTML = "";

    rows.forEach(r => {
        tbody.innerHTML += `
            <tr>
                <td>${r.Date}</td>
                <td>${r.Category}</td>
                <td>${r.Description}</td>
                <td class="text-end">${formatVND(r.Amount)}</td>
            </tr>
        `;
    });
}

function formatVND(value) {
    return new Intl.NumberFormat("vi-VN").format(value) + " VND";
}
