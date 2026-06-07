/**
 * Settings module for Expense Tracker
 * Manages categories, budgets, and colors with localStorage persistence.
 */

const STORAGE_KEY = 'expense_tracker_settings';

const BUILTIN_CATEGORIES = ['Uncategorized'];

const DEFAULT_SETTINGS = {
  categories: [
    'Food', 'Medical/Utility', 'Home', 'Transportation',
    'Entertainment', 'Gift', 'Baby', 'Other', 'Uncategorized',
  ],
  budgets: {
    Food: 5000000,
    'Medical/Utility': 2000000,
    Transportation: 1000000,
    Entertainment: 1500000,
    Home: 2000000,
    Baby: 15000000,
    Uncategorized: 0,
  },
  totalBudget: 20000000,
  categoryColors: {
    Food: '#FF6384',
    'Medical/Utility': '#4BC0C0',
    Home: '#FFCE56',
    Transportation: '#36A2EB',
    Entertainment: '#9966FF',
    Baby: '#FF9F40',
    Gift: '#C9CBCF',
    Other: '#808080',
    Uncategorized: '#ADADAD',
  },
  categoryOrder: ['Food', 'Baby', 'Medical/Utility', 'Home', 'Transportation', 'Entertainment', 'Gift', 'Other', 'Uncategorized'],
  startOfMonthCategories: ['Home', 'Baby'],
};

const COLOR_PALETTE = [
  '#FF6384', '#4BC0C0', '#36A2EB', '#9966FF', '#FFCE56',
  '#FF9F40', '#7BC8A4', '#E7E9ED', '#B57295', '#59C7EB',
  '#F4A261', '#2A9D8F', '#E76F51', '#E9C46A', '#264653',
  '#A855F7', '#06B6D4', '#F97316', '#84CC16',
];

function getDefaultColor(index) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

/**
 * Merge saved settings with defaults to ensure all keys exist.
 */
function mergeSettings(saved) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...saved,
    categories:
      saved.categories && Array.isArray(saved.categories) && saved.categories.length > 0
        ? saved.categories
        : [...DEFAULT_SETTINGS.categories],
    budgets: { ...DEFAULT_SETTINGS.budgets, ...saved.budgets },
    categoryColors: { ...DEFAULT_SETTINGS.categoryColors, ...saved.categoryColors },
    categoryOrder:
      saved.categoryOrder && Array.isArray(saved.categoryOrder) && saved.categoryOrder.length > 0
        ? saved.categoryOrder
        : [...DEFAULT_SETTINGS.categoryOrder],
    startOfMonthCategories:
      saved.startOfMonthCategories && Array.isArray(saved.startOfMonthCategories)
        ? saved.startOfMonthCategories
        : [...DEFAULT_SETTINGS.startOfMonthCategories],
  };

  // Ensure every category has a color
  merged.categories.forEach((cat) => {
    if (!merged.categoryColors[cat]) {
      merged.categoryColors[cat] = getDefaultColor(merged.categories.indexOf(cat));
    }
  });

  // Ensure every budgeted category has a budget entry
  merged.categories.forEach((cat) => {
    if (merged.budgets[cat] === undefined) {
      merged.budgets[cat] = 0;
    }
  });

  return merged;
}

/**
 * Load settings from localStorage.
 */
export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return mergeSettings(JSON.parse(stored));
    }
  } catch (e) {
    console.warn('Failed to load settings from localStorage:', e);
  }
  return {
    ...DEFAULT_SETTINGS,
    categories: [...DEFAULT_SETTINGS.categories],
    categoryColors: { ...DEFAULT_SETTINGS.categoryColors },
  };
}

/**
 * Save settings to localStorage and dispatch change event.
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

/**
 * Get the current list of categories.
 */
export function getCategories() {
  const settings = loadSettings();
  return settings.categories;
}

/**
 * Get all settings.
 */
export function getSettings() {
  return loadSettings();
}

/**
 * Get category order.
 */
export function getCategoryOrder() {
  const settings = loadSettings();
  return settings.categoryOrder;
}

/**
 * Get category colors config.
 */
export function getCategoryColors() {
  const settings = loadSettings();
  return settings.categoryColors;
}

/**
 * Get monthly budgets.
 */
export function getBudgets() {
  const settings = loadSettings();
  return settings.budgets;
}

/**
 * Get total budget.
 */
export function getTotalBudget() {
  const settings = loadSettings();
  return settings.totalBudget;
}

/**
 * Get start-of-month categories.
 */
export function getStartOfMonthCategories() {
  const settings = loadSettings();
  return settings.startOfMonthCategories;
}

/**
 * Populate a <select> element with category options.
 */
export function populateCategorySelect(selectEl, options = {}) {
  const { includeAll = false, placeholder = null, selectedValue = null } = options;
  const categories = getCategories();

  selectEl.innerHTML = '';

  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    opt.disabled = true;
    if (!selectedValue) opt.selected = true;
    selectEl.appendChild(opt);
  }

  if (includeAll) {
    const opt = document.createElement('option');
    opt.value = 'All';
    opt.textContent = 'All Categories';
    if (selectedValue === 'All') opt.selected = true;
    selectEl.appendChild(opt);
  }

  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (selectedValue === cat) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

// ===== Settings Modal HTML =====

const SETTINGS_MODAL_HTML = `
<div class="modal fade" id="settings-modal" tabindex="-1" aria-labelledby="settingsModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-scrollable">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="settingsModalLabel"><i class="bi bi-gear-fill"></i> Settings</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <ul class="nav nav-tabs mb-3" id="settings-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="categories-tab" data-bs-toggle="tab" data-bs-target="#categories-panel" type="button" role="tab" aria-controls="categories-panel" aria-selected="true">
              <i class="bi bi-tags-fill"></i> Categories
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="budgets-tab" data-bs-toggle="tab" data-bs-target="#budgets-panel" type="button" role="tab" aria-controls="budgets-panel" aria-selected="false">
              <i class="bi bi-piggy-bank-fill"></i> Budgets
            </button>
          </li>
        </ul>

        <div class="tab-content" id="settings-tab-content">
          <!-- Categories Panel -->
          <div class="tab-pane fade show active" id="categories-panel" role="tabpanel" aria-labelledby="categories-tab">
            <div id="settings-category-list"></div>
            <div class="input-group mt-3">
              <input type="text" class="form-control" id="new-category-input" placeholder="New category name">
              <button class="btn btn-outline-primary" id="add-category-btn" type="button">
                <i class="bi bi-plus-lg"></i> Add
              </button>
            </div>
            <div id="add-category-error" class="text-danger mt-1 small" style="display:none;"></div>
          </div>

          <!-- Budgets Panel -->
          <div class="tab-pane fade" id="budgets-panel" role="tabpanel" aria-labelledby="budgets-tab">
            <div class="mb-3">
              <label for="settings-total-budget" class="form-label">Total Monthly Budget (VND)</label>
              <input type="number" class="form-control" id="settings-total-budget" min="0" step="100000">
            </div>
            <hr>
            <h6>Per-Category Budgets (VND)</h6>
            <div id="settings-budget-list"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" id="save-settings-btn">
          <i class="bi bi-check-lg"></i> Save Settings
        </button>
      </div>
    </div>
  </div>
</div>
`;

/**
 * Render the category row in the settings modal.
 */
function renderCategoryRow(cat, index, settings) {
  const color = settings.categoryColors[cat] || getDefaultColor(index);
  const isBuiltin = BUILTIN_CATEGORIES.includes(cat);
  return `
    <div class="d-flex align-items-center gap-2 mb-2 p-2 border rounded settings-category-row" data-category="${cat}">
      <input type="color" class="form-control form-control-color settings-cat-color" value="${color}" data-category="${cat}" style="width: 48px; padding: 2px;" title="Category color">
      <span class="flex-grow-1 settings-cat-name" data-category="${cat}">${cat}</span>
      <span class="settings-cat-edit" style="display:none;">
        <input type="text" class="form-control form-control-sm settings-cat-rename-input" data-category="${cat}" value="${cat}" style="width: 180px;">
        <button class="btn btn-sm btn-outline-success settings-cat-rename-save" data-category="${cat}" title="Save">
          <i class="bi bi-check-lg"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary settings-cat-rename-cancel" data-category="${cat}" title="Cancel">
          <i class="bi bi-x-lg"></i>
        </button>
      </span>
      <div class="form-check form-switch mb-0">
        <input class="form-check-input settings-som-cat" type="checkbox" role="switch" id="som-${index}" data-category="${cat}" ${settings.startOfMonthCategories.includes(cat) ? 'checked' : ''}>
        <label class="form-check-label small" for="som-${index}">Start of month</label>
      </div>
      <button class="btn btn-outline-secondary btn-sm settings-rename-cat" data-category="${cat}" ${isBuiltin ? 'disabled' : ''} title="Rename category">
        <i class="bi bi-pencil"></i>
      </button>
      <button class="btn btn-outline-danger btn-sm settings-remove-cat" data-category="${cat}" ${isBuiltin || settings.categories.length <= 1 ? 'disabled' : ''} title="${isBuiltin ? 'Built-in category' : 'Remove category'}">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;
}

/**
 * Render the budget row in the settings modal.
 */
function renderBudgetRow(cat) {
  const settings = loadSettings();
  const budget = settings.budgets[cat] || 0;
  return `
    <div class="mb-2">
      <label class="form-label small mb-1">${cat}</label>
      <input type="number" class="form-control settings-budget-input" data-category="${cat}" value="${budget}" min="0" step="100000">
    </div>
  `;
}

/**
 * Open the settings modal — populates with current data.
 */
export function openSettingsModal() {
  const modalEl = document.getElementById('settings-modal');
  if (!modalEl) return;

  const settings = loadSettings();

  // Populate categories tab
  const categoryList = document.getElementById('settings-category-list');
  categoryList.innerHTML = settings.categories
    .map((cat, i) => renderCategoryRow(cat, i, settings))
    .join('');

  // Populate budgets tab
  const budgetList = document.getElementById('settings-budget-list');
  budgetList.innerHTML = settings.categories
    .map((cat) => renderBudgetRow(cat))
    .join('');

  document.getElementById('settings-total-budget').value = settings.totalBudget;

  // Show modal
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

/**
 * Bind settings modal event handlers.
 */
export function initSettingsModal() {
  const categoryList = document.getElementById('settings-category-list');
  const budgetList = document.getElementById('settings-budget-list');
  const newCatInput = document.getElementById('new-category-input');
  const addCatBtn = document.getElementById('add-category-btn');
  const addCatError = document.getElementById('add-category-error');
  const saveBtn = document.getElementById('save-settings-btn');
  const totalBudgetInput = document.getElementById('settings-total-budget');

  // Add category
  function handleAddCategory() {
    const name = newCatInput.value.trim();
    if (!name) {
      addCatError.textContent = 'Please enter a category name.';
      addCatError.style.display = 'block';
      return;
    }

    const settings = loadSettings();
    if (settings.categories.includes(name)) {
      addCatError.textContent = 'This category already exists.';
      addCatError.style.display = 'block';
      return;
    }

    settings.categories.push(name);
    settings.categoryOrder.push(name);
    if (!settings.budgets[name]) settings.budgets[name] = 0;
    if (!settings.categoryColors[name]) settings.categoryColors[name] = getDefaultColor(settings.categories.indexOf(name));
    saveSettings(settings);
    openSettingsModal(); // Re-render
  }

  addCatBtn.addEventListener('click', handleAddCategory);
  newCatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  });
  newCatInput.addEventListener('input', () => {
    addCatError.style.display = 'none';
  });

  // Delegate events for remove, color change, start-of-month toggle
  categoryList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.settings-remove-cat');
    if (!removeBtn) return;

    const cat = removeBtn.dataset.category;
    const settings = loadSettings();
    if (settings.categories.length <= 1) return;

    if (!confirm('Delete category "' + cat + '"?\n\nAll expenses with this category will be moved to "Uncategorized".')) {
      return;
    }

    // Reassign DB entries to Uncategorized via API
    fetch('/api/expenses/category', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldCategory: cat, newCategory: 'Uncategorized' }),
    }).catch(function(err) {
      console.error('Failed to reassign expenses:', err);
    });

    settings.categories = settings.categories.filter(function(c) { return c !== cat; });
    settings.categoryOrder = settings.categoryOrder.filter(function(c) { return c !== cat; });
    delete settings.budgets[cat];
    delete settings.categoryColors[cat];
    settings.startOfMonthCategories = settings.startOfMonthCategories.filter(function(c) { return c !== cat; });
    saveSettings(settings);
    openSettingsModal(); // Re-render
  });

  // Delegate events for rename
  categoryList.addEventListener('click', (e) => {
    const renameBtn = e.target.closest('.settings-rename-cat');
    if (!renameBtn) return;
    const cat = renameBtn.dataset.category;
    // Show edit input, hide display name
    const row = renameBtn.closest('.settings-category-row');
    const nameSpan = row.querySelector('.settings-cat-name');
    const editSpan = row.querySelector('.settings-cat-edit');
    nameSpan.style.display = 'none';
    editSpan.style.display = 'inline';
    const input = editSpan.querySelector('.settings-cat-rename-input');
    input.value = cat;
    input.focus();
    input.select();
  });

  categoryList.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.settings-cat-rename-save');
    if (!saveBtn) return;
    const cat = saveBtn.dataset.category;
    const row = saveBtn.closest('.settings-category-row');
    const input = row.querySelector('.settings-cat-rename-input');
    const newName = input.value.trim();
    if (!newName || newName === cat) {
      // Cancel if empty or same name
      row.querySelector('.settings-cat-name').style.display = 'inline';
      row.querySelector('.settings-cat-edit').style.display = 'none';
      return;
    }
    const settings = loadSettings();
    if (settings.categories.includes(newName) && newName !== cat) {
      alert('Category "' + newName + '" already exists.');
      return;
    }
    // Rename in all settings fields
    const idx = settings.categories.indexOf(cat);
    if (idx !== -1) settings.categories[idx] = newName;
    const orderIdx = settings.categoryOrder.indexOf(cat);
    if (orderIdx !== -1) settings.categoryOrder[orderIdx] = newName;
    if (settings.budgets[cat] !== undefined) {
      settings.budgets[newName] = settings.budgets[cat];
      delete settings.budgets[cat];
    }
    if (settings.categoryColors[cat]) {
      settings.categoryColors[newName] = settings.categoryColors[cat];
      delete settings.categoryColors[cat];
    }
    const somIdx = settings.startOfMonthCategories.indexOf(cat);
    if (somIdx !== -1) settings.startOfMonthCategories[somIdx] = newName;
    saveSettings(settings);
    openSettingsModal(); // Re-render
  });

  categoryList.addEventListener('click', (e) => {
    const cancelBtn = e.target.closest('.settings-cat-rename-cancel');
    if (!cancelBtn) return;
    const row = cancelBtn.closest('.settings-category-row');
    row.querySelector('.settings-cat-name').style.display = 'inline';
    row.querySelector('.settings-cat-edit').style.display = 'none';
  });

  // Allow pressing Enter in rename input to save
  categoryList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('settings-cat-rename-input')) {
      const saveBtn = e.target.closest('.settings-category-row').querySelector('.settings-cat-rename-save');
      if (saveBtn) saveBtn.click();
    }
    if (e.key === 'Escape' && e.target.classList.contains('settings-cat-rename-input')) {
      const cancelBtn = e.target.closest('.settings-category-row').querySelector('.settings-cat-rename-cancel');
      if (cancelBtn) cancelBtn.click();
    }
  });

  categoryList.addEventListener('change', (e) => {
    const colorInput = e.target.closest('.settings-cat-color');
    const somCheckbox = e.target.closest('.settings-som-cat');

    if (colorInput) {
      const cat = colorInput.dataset.category;
      const settings = loadSettings();
      settings.categoryColors[cat] = colorInput.value;
      saveSettings(settings);
    }

    if (somCheckbox) {
      const cat = somCheckbox.dataset.category;
      const settings = loadSettings();
      if (somCheckbox.checked) {
        if (!settings.startOfMonthCategories.includes(cat)) {
          settings.startOfMonthCategories.push(cat);
        }
      } else {
        settings.startOfMonthCategories = settings.startOfMonthCategories.filter((c) => c !== cat);
      }
      saveSettings(settings);
    }
  });

  // Helper: save budget inputs from the budgets tab to settings
  function saveBudgetInputs() {
    const settings = loadSettings();
    const budgetInputs = budgetList.querySelectorAll('.settings-budget-input');
    budgetInputs.forEach((input) => {
      const cat = input.dataset.category;
      const val = parseInt(input.value, 10);
      settings.budgets[cat] = isNaN(val) ? 0 : val;
    });
    const totalBudgetVal = parseInt(totalBudgetInput.value, 10);
    if (!isNaN(totalBudgetVal) && totalBudgetVal >= 0) {
      settings.totalBudget = totalBudgetVal;
    }
    saveSettings(settings);
  }

  // Auto-save budget inputs on change so budgets stay in sync when categories are added/removed
  budgetList.addEventListener('change', (e) => {
    if (e.target.classList.contains('settings-budget-input')) {
      saveBudgetInputs();
    }
  });

  // Also save on input blur (when user tabs away or clicks elsewhere)
  budgetList.addEventListener('blur', (e) => {
    if (e.target.classList.contains('settings-budget-input')) {
      saveBudgetInputs();
    }
  }, true);

  totalBudgetInput.addEventListener('change', saveBudgetInputs);

  // Save settings button
  saveBtn.addEventListener('click', () => {
    saveBudgetInputs();

    // Close modal
    const modalEl = document.getElementById('settings-modal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  });
}

/**
 * Inject settings modal into the page body.
 */
export function injectSettingsModal() {
  if (document.getElementById('settings-modal')) return;

  const div = document.createElement('div');
  div.innerHTML = SETTINGS_MODAL_HTML;
  document.body.appendChild(div.firstElementChild);
}

/**
 * Initialize the settings system on a page.
 */
export function initSettings() {
  injectSettingsModal();
  initSettingsModal();
}
