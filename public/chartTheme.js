/**
 * Chart theme utility - adapts Chart.js visual styling to the current theme.
 * Provides functions to apply light/dark mode colors to chart elements
 * (grid lines, tick labels, legend text, titles) without re-fetching data.
 */
import { loadSettings } from './settings.js';

/**
 * Get chart color theme based on current application theme.
 * @returns {{ gridColor: string, tickColor: string, legendColor: string, titleColor: string }}
 */
export function getChartTheme() {
  const settings = loadSettings();
  const isDark = settings.theme === 'dark';
  return {
    gridColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
    tickColor: isDark ? '#cccccc' : '#666666',
    legendColor: isDark ? '#e0e0e0' : '#333333',
    titleColor: isDark ? '#e0e0e0' : '#333333',
  };
}

/**
 * Apply theme colors to an existing Chart.js chart instance.
 * Updates scales (grid/ticks), legend, and title colors; calls chart.update().
 * Gracefully handles mock/incomplete chart objects (e.g. in tests).
 * @param {Chart|null} chart - Chart.js instance to update
 */
export function applyThemeToChart(chart) {
  if (!chart) return;
  try {
    const theme = getChartTheme();

    // Update grid line and tick colors on all scales
    if (chart.options && chart.options.scales) {
      Object.values(chart.options.scales).forEach((scale) => {
        if (scale && scale.grid) {
          scale.grid.color = theme.gridColor;
        }
        if (scale && scale.ticks) {
          scale.ticks.color = theme.tickColor;
        }
      });
    }

    // Update legend label color
    if (chart.options && chart.options.plugins) {
      const plugins = chart.options.plugins;
      if (plugins.legend && plugins.legend.labels) {
        plugins.legend.labels.color = theme.legendColor;
      }
      if (plugins.title) {
        plugins.title.color = theme.titleColor;
      }
    }

    if (typeof chart.update === 'function') {
      chart.update();
    }
  } catch (e) {
    // Silently ignore — chart may be a mock or partial object in tests
  }
}
