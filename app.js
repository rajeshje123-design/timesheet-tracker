/* ============================================================
   app.js — Main Application Logic
   ============================================================ */

'use strict';

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculates duration from two HH:MM strings.
 * Returns { decimalHrs: Number, label: String } or null if invalid.
 */
function calcDuration(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;
  if (isNaN(startMins) || isNaN(endMins) || endMins <= startMins) return null;
  const totalMins = endMins - startMins;
  const decimalHrs = +(totalMins / 60).toFixed(2);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const label = m > 0 ? `${h}h ${m}m` : `${h}h`;
  return { decimalHrs, label };
}

/** Formats a decimal hours number into "Xh Ym" label */
function fmtHrs(decimalHrs) {
  const totalMins = Math.round(decimalHrs * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Parses a date string (YYYY-MM-DD) → Date object (local midnight) */
function parseDate(str) {
  if (!str) return null;
  const [y, mo, d] = str.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

/** Returns the ISO week number of a Date */
function isoWeek(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return { week: Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7), year: tmp.getUTCFullYear() };
}

/** Returns the quarter (1-4) for a Date */
function quarter(d) {
  return Math.ceil((d.getMonth() + 1) / 3);
}

// ── Toast Notification System ─────────────────────────────────────────────────

const Toast = (() => {
  const container = document.getElementById('toast-container');

  function show(message, type = 'success', durationMs = 4000) {
    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hiding');
      toast.addEventListener('animationend', () => toast.remove());
    }, durationMs);
  }

  return { show };
})();

// ── Loading Spinner ───────────────────────────────────────────────────────────

const Loader = (() => {
  const overlay = document.getElementById('loading-overlay');
  let count = 0;

  function show() { count++; overlay.style.display = 'flex'; }
  function hide() { count = Math.max(0, count - 1); if (!count) overlay.style.display = 'none'; }

  return { show, hide };
})();

// ── Auth State ────────────────────────────────────────────────────────────────

const authOverlay   = document.getElementById('auth-overlay');
const signInBtn     = document.getElementById('sign-in-btn');
const signOutBtn    = document.getElementById('sign-out-btn');
const userSection   = document.getElementById('user-section');
const userLabel     = document.getElementById('user-label');
const appContainer  = document.getElementById('app-container');

function updateAuthUI(isSignedIn) {
  if (isSignedIn) {
    authOverlay.classList.add('hidden');
    appContainer.style.display = 'block';
    userSection.style.display = 'flex';
    userLabel.textContent = 'Signed in';
    // Automatically load existing sheet data in background to feed recommendations
    loadDataForRecommendations();
  } else {
    authOverlay.classList.remove('hidden');
    appContainer.style.display = 'none';
    userSection.style.display = 'none';
    recommendIndex = null;
    clearRecommendations();
  }
}

async function loadDataForRecommendations() {
  try {
    const rows = await SheetsAPI.getAllRows();
    allRows = rows;
    initRecommendations(allRows);
    if (typeof populateFilterDropdowns === 'function') {
      populateFilterDropdowns();
    }
  } catch (err) {
    console.warn('Could not pre-load recommendations:', err);
  }
}

SheetsAPI.onAuthChange = updateAuthUI;

signInBtn.addEventListener('click', async () => {
  signInBtn.disabled = true;
  signInBtn.innerHTML = `<span class="inline-spinner"></span> Signing in…`;
  try {
    await SheetsAPI.signIn();
  } catch (err) {
    Toast.show(`Sign-in failed: ${err.message}`, 'error');
    signInBtn.disabled = false;
    signInBtn.innerHTML = `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google`;
  }
});

signOutBtn.addEventListener('click', async () => {
  await SheetsAPI.signOut();
  Toast.show('Signed out successfully.', 'warning');
  // Reset dashboard data
  allRows = [];
  renderTable([]);
  renderChart([]);
  renderPivot([]);
  updateSummaryCards([]);
});

// ── Tab Switching ─────────────────────────────────────────────────────────────

const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

function switchTab(target) {
  tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === target));
  tabPanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${target}`));

  // Sync mobile bottom nav active state
  document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === target);
  });

  if (target === 'dashboard') loadDashboard();
}

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Wire up mobile bottom nav buttons
document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Smart Autocomplete & Recommendations ──────────────────────────────────────

let recommendIndex = null;

function clearRecommendations() {
  fillDatalist('dl-company', []);
  fillDatalist('dl-taskgroup', []);
  fillDatalist('dl-tasktype', []);
  const hint = document.getElementById('nature-hint');
  if (hint) hint.classList.add('hidden');
}

/**
 * Builds recommendation hierarchy from rows
 */
function buildRecommendIndex(rows) {
  const idx = {
    companies: new Set(),
    allTaskGroups: new Set(),
    allTaskTypes: new Set(),
    byCompany: {}
  };

  if (!rows || !rows.length) return idx;

  // Iterate in chronological order so the latest entry determines defaults
  for (const row of rows) {
    const comp   = (row['Company'] || '').trim();
    const group  = (row['Task Group'] || '').trim();
    const type   = (row['Task Type'] || '').trim();
    const nature = (row['Task Nature'] || '').trim();

    if (!comp) continue;
    idx.companies.add(comp);

    if (!idx.byCompany[comp]) {
      idx.byCompany[comp] = {
        taskGroups: new Set(),
        byGroup: {}
      };
    }

    if (group) {
      idx.allTaskGroups.add(group);
      idx.byCompany[comp].taskGroups.add(group);

      if (!idx.byCompany[comp].byGroup[group]) {
        idx.byCompany[comp].byGroup[group] = {
          taskTypes: new Set(),
          lastNature: 'Regular'
        };
      }

      if (type) {
        idx.allTaskTypes.add(type);
        idx.byCompany[comp].byGroup[group].taskTypes.add(type);
      }

      if (nature) {
        idx.byCompany[comp].byGroup[group].lastNature = nature;
      }
    }
  }

  return idx;
}

function fillDatalist(id, items) {
  const dl = document.getElementById(id);
  if (!dl) return;
  dl.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = item;
    frag.appendChild(opt);
  }
  dl.appendChild(frag);
}

function updateRecommendations() {
  if (!recommendIndex) return;

  const currentComp  = companyInput.value.trim();
  const currentGroup = tgInput.value.trim();

  // 1. Populate Company suggestions
  fillDatalist('dl-company', [...recommendIndex.companies].sort());

  // 2. Populate Task Group suggestions (smart filtered by company if recognized)
  const compData = recommendIndex.byCompany[currentComp];
  if (compData && compData.taskGroups.size > 0) {
    fillDatalist('dl-taskgroup', [...compData.taskGroups].sort());
  } else {
    fillDatalist('dl-taskgroup', [...recommendIndex.allTaskGroups].sort());
  }

  // 3. Populate Task Type suggestions (smart filtered by company + group)
  if (compData && compData.byGroup[currentGroup] && compData.byGroup[currentGroup].taskTypes.size > 0) {
    fillDatalist('dl-tasktype', [...compData.byGroup[currentGroup].taskTypes].sort());
  } else if (compData) {
    const compTypes = new Set();
    Object.values(compData.byGroup).forEach(g => g.taskTypes.forEach(t => compTypes.add(t)));
    fillDatalist('dl-tasktype', compTypes.size > 0 ? [...compTypes].sort() : [...recommendIndex.allTaskTypes].sort());
  } else {
    fillDatalist('dl-tasktype', [...recommendIndex.allTaskTypes].sort());
  }

  // 4. Auto-recommend Task Nature if company + task group match known history
  const hintEl = document.getElementById('nature-hint');
  const hintVal = document.getElementById('nature-hint-val');
  if (compData && compData.byGroup[currentGroup]) {
    const recommendedNature = compData.byGroup[currentGroup].lastNature;
    if (recommendedNature) {
      const radio = document.querySelector(`input[name="task-nature"][value="${recommendedNature}"]`);
      if (radio && !radio.checked) {
        radio.checked = true;
      }
      if (hintEl && hintVal) {
        hintVal.textContent = recommendedNature;
        hintEl.classList.remove('hidden');
      }
    }
  } else if (hintEl) {
    hintEl.classList.add('hidden');
  }
}

function initRecommendations(rows) {
  recommendIndex = buildRecommendIndex(rows);
  updateRecommendations();
}

// ── Entry Form ────────────────────────────────────────────────────────────────

const entryForm     = document.getElementById('entry-form');
const dateInput     = document.getElementById('f-date');
const startInput    = document.getElementById('f-start');
const endInput      = document.getElementById('f-end');
const companyInput  = document.getElementById('f-company');
const tgInput       = document.getElementById('f-taskgroup');
const ttInput       = document.getElementById('f-tasktype');
const descInput     = document.getElementById('f-desc');
const durationDisp  = document.getElementById('duration-display');
const submitBtn     = document.getElementById('submit-btn');

// Set default date
dateInput.value = todayISO();

function updateDuration() {
  const result = calcDuration(startInput.value, endInput.value);
  if (result) {
    durationDisp.textContent = result.label;
    durationDisp.style.opacity = '1';
  } else {
    durationDisp.textContent = '— : —';
    durationDisp.style.opacity = '0.5';
  }
}

startInput.addEventListener('change', updateDuration);
endInput.addEventListener('change', updateDuration);
updateDuration();

// Hook up recommendations dynamically as the user types or selects
companyInput.addEventListener('input', updateRecommendations);
companyInput.addEventListener('change', updateRecommendations);
tgInput.addEventListener('input', updateRecommendations);
tgInput.addEventListener('change', updateRecommendations);
ttInput.addEventListener('input', updateRecommendations);
ttInput.addEventListener('change', updateRecommendations);

// Validation helpers
function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const msg   = document.getElementById(`err-${fieldId}`);
  if (input)  input.classList.add('error');
  if (msg)  { msg.textContent = message; msg.classList.add('visible'); }
}

function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const msg   = document.getElementById(`err-${fieldId}`);
  if (input) input.classList.remove('error');
  if (msg)   msg.classList.remove('visible');
}

function clearAllErrors() {
  ['f-date','f-start','f-end','f-company','f-taskgroup','f-tasktype'].forEach(clearFieldError);
}

function validateForm() {
  clearAllErrors();
  let valid = true;

  if (!dateInput.value)    { setFieldError('f-date',      'Date is required');       valid = false; }
  if (!startInput.value)   { setFieldError('f-start',     'Start time is required'); valid = false; }
  if (!endInput.value)     { setFieldError('f-end',       'End time is required');   valid = false; }
  if (!companyInput.value.trim())  { setFieldError('f-company',   'Company is required');    valid = false; }
  if (!tgInput.value.trim())       { setFieldError('f-taskgroup', 'Task Group is required'); valid = false; }
  if (!ttInput.value.trim())       { setFieldError('f-tasktype',  'Task Type is required');  valid = false; }

  if (startInput.value && endInput.value) {
    const dur = calcDuration(startInput.value, endInput.value);
    if (!dur) {
      setFieldError('f-end', 'End time must be after Start time');
      valid = false;
    }
  }
  return valid;
}

entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const dur = calcDuration(startInput.value, endInput.value);
  const taskNature = document.querySelector('input[name="task-nature"]:checked')?.value || 'Regular';

  const rowData = {
    date:            dateInput.value,
    startTime:       startInput.value,
    endTime:         endInput.value,
    durationHrs:     dur.decimalHrs,
    company:         companyInput.value.trim(),
    taskGroup:       tgInput.value.trim(),
    taskType:        ttInput.value.trim(),
    taskDescription: descInput.value.trim(),
    taskNature,
  };

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="inline-spinner"></span> Saving…`;

  try {
    await SheetsAPI.appendRow(rowData);
    Toast.show(`Entry saved — ${dur.label} logged for ${rowData.company}`, 'success');

    // Add to in-memory rows so recommendations and dashboard update immediately
    allRows.push({
      'Date': rowData.date,
      'Start Time': rowData.startTime,
      'End Time': rowData.endTime,
      'Duration (hrs)': rowData.durationHrs,
      'Company': rowData.company,
      'Task Group': rowData.taskGroup,
      'Task Type': rowData.taskType,
      'Task Description': rowData.taskDescription,
      'Task Nature': rowData.taskNature
    });
    initRecommendations(allRows);
    if (typeof populateFilterDropdowns === 'function') {
      populateFilterDropdowns();
    }

    // Reset form but keep date as today
    entryForm.reset();
    dateInput.value = todayISO();
    updateDuration();
    clearAllErrors();
    updateRecommendations();
  } catch (err) {
    Toast.show(`Failed to save: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Save Entry`;
  }
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

let allRows = [];
let sortState = { col: 'Date', dir: 'desc' };
let chartInstance = null;

const refreshBtn    = document.getElementById('refresh-btn');
const filterFrom    = document.getElementById('filter-from');
const filterTo      = document.getElementById('filter-to');
const filterCompany = document.getElementById('filter-company');
const filterGroup   = document.getElementById('filter-group');
const filterNature  = document.getElementById('filter-nature');
const applyFilters  = document.getElementById('apply-filters');
const clearFilters  = document.getElementById('clear-filters');

refreshBtn.addEventListener('click', () => loadDashboard(true));
applyFilters.addEventListener('click', renderDashboard);
clearFilters.addEventListener('click', () => {
  filterFrom.value    = '';
  filterTo.value      = '';
  filterCompany.value = '';
  filterGroup.value   = '';
  filterNature.value  = '';
  renderDashboard();
});

async function loadDashboard(forceRefresh = false) {
  if (!SheetsAPI.isSignedIn()) return;
  if (!forceRefresh && allRows.length > 0) { renderDashboard(); return; }

  Loader.show();
  try {
    allRows = await SheetsAPI.getAllRows();
    initRecommendations(allRows);
    populateFilterDropdowns();
    renderDashboard();
  } catch (err) {
    Toast.show(`Error loading data: ${err.message}`, 'error');
  } finally {
    Loader.hide();
  }
}

function populateFilterDropdowns() {
  const companies = [...new Set(allRows.map(r => r['Company']).filter(Boolean))].sort();
  const groups    = [...new Set(allRows.map(r => r['Task Group']).filter(Boolean))].sort();

  _populateSelect(filterCompany, companies);
  _populateSelect(filterGroup,   groups);
}

function _populateSelect(el, options) {
  const current = el.value;
  el.innerHTML = `<option value="">All</option>` +
    options.map(o => `<option value="${_esc(o)}"${o === current ? ' selected' : ''}>${_esc(o)}</option>`).join('');
}

function getFilteredRows() {
  let rows = [...allRows];

  const from    = filterFrom.value    ? parseDate(filterFrom.value)    : null;
  const to      = filterTo.value      ? parseDate(filterTo.value)      : null;
  const company = filterCompany.value;
  const group   = filterGroup.value;
  const nature  = filterNature.value;

  return rows.filter(r => {
    const d = parseDate(r['Date']);
    if (from && d && d < from) return false;
    if (to   && d && d > to)   return false;
    if (company && r['Company']    !== company) return false;
    if (group   && r['Task Group'] !== group)   return false;
    if (nature  && r['Task Nature']!== nature)  return false;
    return true;
  });
}

function renderDashboard() {
  const filtered = getFilteredRows();
  updateSummaryCards(filtered);
  renderTable(filtered);
  renderChart(filtered);
  renderPivot(filtered);
}

// ── Summary Cards ─────────────────────────────────────────────────────────────

function updateSummaryCards(rows) {
  let total = 0, regular = 0, additional = 0;
  rows.forEach(r => {
    const h = parseFloat(r['Duration (hrs)']) || 0;
    total += h;
    if (r['Task Nature'] === 'Additional') additional += h;
    else regular += h;
  });

  document.getElementById('card-total').textContent    = fmtHrs(total);
  document.getElementById('card-regular').textContent  = fmtHrs(regular);
  document.getElementById('card-additional').textContent = fmtHrs(additional);
  document.getElementById('card-count').textContent    = rows.length;
}

// ── Data Table ────────────────────────────────────────────────────────────────

const tableBody    = document.getElementById('table-body');
const tableHeaders = document.querySelectorAll('#data-table th[data-col]');
const emptyState   = document.getElementById('table-empty');
const tableWrapper = document.getElementById('table-wrapper');

tableHeaders.forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortState.col === col) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.col = col;
      sortState.dir = 'asc';
    }
    tableHeaders.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
    th.classList.add(sortState.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    renderDashboard();
  });
});

function renderTable(rows) {
  // Sort
  const col = sortState.col;
  const dir = sortState.dir === 'asc' ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    let av = a[col] ?? '', bv = b[col] ?? '';
    if (col === 'Date') { av = parseDate(av) || 0; bv = parseDate(bv) || 0; }
    else if (col === 'Duration (hrs)') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
    return av < bv ? -dir : av > bv ? dir : 0;
  });

  if (sorted.length === 0) {
    tableWrapper.style.display = 'none';
    emptyState.style.display   = 'block';
    return;
  }

  tableWrapper.style.display = '';
  emptyState.style.display   = 'none';

  tableBody.innerHTML = sorted.map(r => {
    const durationHrs = parseFloat(r['Duration (hrs)']) || 0;
    const nature = r['Task Nature'] || 'Regular';
    const badgeClass = nature === 'Additional' ? 'badge-additional' : 'badge-regular';
    return `
      <tr>
        <td>${_esc(r['Date'] || '')}</td>
        <td>${_esc(r['Company'] || '')}</td>
        <td>${_esc(r['Task Group'] || '')}</td>
        <td>${_esc(r['Task Type'] || '')}</td>
        <td><span class="badge ${badgeClass}">${_esc(nature)}</span></td>
        <td><strong>${fmtHrs(durationHrs)}</strong></td>
        <td title="${_esc(r['Task Description'] || '')}">${_esc(r['Task Description'] || '—')}</td>
      </tr>`;
  }).join('');
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function renderChart(rows) {
  const companyHours = {};
  rows.forEach(r => {
    const c = r['Company'] || 'Unknown';
    const h = parseFloat(r['Duration (hrs)']) || 0;
    companyHours[c] = (companyHours[c] || 0) + h;
  });

  const labels = Object.keys(companyHours).sort();
  const data   = labels.map(l => +companyHours[l].toFixed(2));

  const ctx = document.getElementById('hours-chart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  if (labels.length === 0) {
    document.getElementById('chart-empty').style.display = 'block';
    document.getElementById('hours-chart').style.display = 'none';
    return;
  }

  document.getElementById('chart-empty').style.display = 'none';
  document.getElementById('hours-chart').style.display = 'block';

  const palette = [
    '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981',
    '#3b82f6','#f97316','#14b8a6','#ef4444','#84cc16',
  ];

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Hours',
        data,
        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${fmtHrs(ctx.raw)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: (v) => `${v}h`,
            color: '#64748b',
          },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' },
        },
      },
    },
  });
}

// ── Pivot Table ───────────────────────────────────────────────────────────────

const pivotBtns  = document.querySelectorAll('.pivot-tab-btn');
const pivotBody  = document.getElementById('pivot-body');
const pivotEmpty = document.getElementById('pivot-empty');

pivotBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    pivotBtns.forEach(b => b.classList.toggle('active', b === btn));
    renderPivot(getFilteredRows());
  });
});

function renderPivot(rows) {
  const period = document.querySelector('.pivot-tab-btn.active')?.dataset.period || 'monthly';

  // Build grouping key per row
  function periodKey(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return 'Unknown';
    switch (period) {
      case 'weekly': {
        const { week, year } = isoWeek(d);
        return `${year}-W${String(week).padStart(2, '0')}`;
      }
      case 'monthly':
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      case 'quarterly':
        return `${d.getFullYear()}-Q${quarter(d)}`;
      case 'yearly':
        return `${d.getFullYear()}`;
      default:
        return dateStr;
    }
  }

  // Aggregate: { periodKey → { company → { group → { hrs, count } } } }
  const agg = {};
  rows.forEach(r => {
    const pk  = periodKey(r['Date']);
    const co  = r['Company']    || 'Unknown';
    const grp = r['Task Group'] || 'Unknown';
    const hrs = parseFloat(r['Duration (hrs)']) || 0;

    if (!agg[pk])        agg[pk]        = {};
    if (!agg[pk][co])    agg[pk][co]    = {};
    if (!agg[pk][co][grp]) agg[pk][co][grp] = { hrs: 0, count: 0 };
    agg[pk][co][grp].hrs   += hrs;
    agg[pk][co][grp].count += 1;
  });

  const periods = Object.keys(agg).sort();

  if (periods.length === 0) {
    pivotEmpty.style.display = 'block';
    pivotBody.innerHTML = '';
    return;
  }

  pivotEmpty.style.display = 'none';

  let html = '';
  periods.forEach(pk => {
    const companies = Object.keys(agg[pk]).sort();
    let first = true;
    companies.forEach(co => {
      const groups = Object.keys(agg[pk][co]).sort();
      groups.forEach((grp, gi) => {
        const { hrs, count } = agg[pk][co][grp];
        html += `<tr>
          ${first && gi === 0 ? `<td class="font-semibold text-indigo-700" rowspan="${companies.reduce((a,c) => a + Object.keys(agg[pk][c]).length, 0)}">${_esc(pk)}</td>` : ''}
          ${gi === 0 ? `<td class="font-medium" rowspan="${groups.length}">${_esc(co)}</td>` : ''}
          <td>${_esc(grp)}</td>
          <td class="font-semibold">${fmtHrs(hrs)}</td>
          <td>${count}</td>
        </tr>`;
        if (gi === 0) first = false;
      });
    });
  });

  pivotBody.innerHTML = html;
}

// ── Escape HTML ───────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

// Mark the first pivot tab as active on load
document.querySelector('.pivot-tab-btn[data-period="monthly"]')?.classList.add('active');

// Set default sort indicator
document.querySelector('th[data-col="Date"]')?.classList.add('sorted-desc');
