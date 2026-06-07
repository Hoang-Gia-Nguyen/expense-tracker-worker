/**
 * Insights page logic - fetches and displays spending insights
 */

// Format currency in VND
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

// Fetch insights data from API
async function fetchInsights() {
  const response = await fetch('/api/insights');
  if (!response.ok) {
    throw new Error(`Failed to fetch insights: ${response.statusText}`);
  }
  return response.json();
}

// Create daily spending chart
function createDailySpendingChart(canvas, dailySeries) {
  const ctx = canvas.getContext('2d');
  
  const labels = dailySeries.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
  });
  
  const data = dailySeries.map(d => d.total);
  
  // Calculate average for reference line
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Daily Spending',
          data: data,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Average',
          data: new Array(data.length).fill(avg),
          borderColor: 'rgb(255, 159, 64)',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
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
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });
}

// Render daily spikes section
function renderDailySpikes(container, dailySpikes) {
  if (dailySpikes.length === 0) {
    container.innerHTML = '<p class="text-muted">No unusual spending days detected. Your daily spending has been consistent!</p>';
    return;
  }
  
  const html = dailySpikes.map(spike => `
    <div class="alert alert-warning d-flex justify-content-between align-items-center mb-2">
      <div>
        <strong>${formatDate(spike.date)}</strong>
        <span class="ms-2">${formatCurrency(spike.total)}</span>
      </div>
      <span class="badge bg-warning text-dark">${spike.multiplier.toFixed(1)}x average</span>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

// Render category spikes section
function renderCategorySpikes(container, categorySpikes) {
  if (categorySpikes.length === 0) {
    container.innerHTML = '<p class="text-muted">No significant category increases this month. Your spending is on track!</p>';
    return;
  }
  
  const html = categorySpikes.map(spike => `
    <div class="alert alert-danger d-flex justify-content-between align-items-center mb-2">
      <div>
        <strong><i class="bi bi-tag-fill"></i> ${spike.category}</strong>
        <span class="ms-2">${formatCurrency(spike.current)}</span>
      </div>
      <span class="badge bg-danger">+${spike.percentIncrease.toFixed(0)}%</span>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

// Render top transactions table
function renderTopTransactions(tbody, topTransactions) {
  if (topTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No transactions this month</td></tr>';
    return;
  }
  
  const html = topTransactions.map((tx, index) => `
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
  
  tbody.innerHTML = html;
}

// Show/hide sections based on data availability
function updateSectionVisibility(sections, data) {
  sections.dailyChart.classList.remove('d-none');
  
  if (data.dailySpikes.length > 0) {
    sections.dailySpikes.classList.remove('d-none');
  }
  
  if (data.categorySpikes.length > 0) {
    sections.categorySpikes.classList.remove('d-none');
  }
  
  if (data.topTransactions.length > 0) {
    sections.topTransactions.classList.remove('d-none');
  }
}

// Main app creation function
export function createInsightsApp(elements) {
  let chartInstance = null;
  
  async function fetchAndRender() {
    try {
      // Show loading
      elements.loadingSpinner.classList.remove('d-none');
      elements.errorMessage.classList.add('d-none');
      
      // Fetch data
      const data = await fetchInsights();
      
      // Hide loading
      elements.loadingSpinner.classList.add('d-none');
      
      // Render daily spending chart
      if (chartInstance) {
        chartInstance.destroy();
      }
      chartInstance = createDailySpendingChart(elements.dailyChart, data.dailySeries);
      
      // Render other sections
      renderDailySpikes(elements.dailySpikesContent, data.dailySpikes);
      renderCategorySpikes(elements.categorySpikesContent, data.categorySpikes);
      renderTopTransactions(elements.topTransactionsTbody, data.topTransactions);
      
      // Show sections
      updateSectionVisibility(elements.sections, data);
      
    } catch (error) {
      console.error('Error fetching insights:', error);
      elements.loadingSpinner.classList.add('d-none');
      elements.errorMessage.textContent = `Error loading insights: ${error.message}`;
      elements.errorMessage.classList.remove('d-none');
    }
  }
  
  return {
    fetchAndRender
  };
}
