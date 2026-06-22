const API = window.location.port === '5000' ? '' : 'http://localhost:5000';

// ── Toast notifications ───────────────────────────────────────────────────────
// Replaces browser alert() with non-blocking floating messages.

const shelf = Object.assign(document.createElement('div'), { className: 'toast-shelf' });
document.body.appendChild(shelf);

function toast(msg, type = 'ok', duration = 3500) {
  const t = Object.assign(document.createElement('div'), {
    className: `toast ${type}`,
    textContent: msg
  });
  shelf.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ── API helper ────────────────────────────────────────────────────────────────

async function apiFetch(path, opts) {
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ── Backend status dot ────────────────────────────────────────────────────────
// Green dot = backend running. Red = offline. Checked on page load.

async function checkBackendStatus() {
  const dot = document.getElementById('statusDot');
  if (!dot) return;
  try {
    await apiFetch('/api/health');
    dot.classList.add('online');
    dot.title = 'Backend connected';
  } catch {
    dot.classList.add('offline');
    dot.title = 'Backend offline — start python app.py';
  }
}

// ── Chart setup ───────────────────────────────────────────────────────────────

const colors = ['#166534', '#22C55E', '#4ADE80', '#86EFAC', '#EAB308'];
const charts = {};

function makeChart(id, opt) {
  const el = document.getElementById(id);
  if (!el) return null;
  const c = echarts.init(el);
  c.setOption(opt);
  window.addEventListener('resize', () => c.resize());
  return c;
}

function fmtRM(val) {
  if (val >= 1000) return 'RM' + (val / 1000).toFixed(1) + 'k';
  return 'RM' + Math.round(val);
}

function trendLabel(pct) {
  // Extreme swings (>60%) usually mean partial-day data vs a full prior day — flag rather than mislead
  if (Math.abs(pct) > 60) {
    return { text: 'Partial day reading', cls: '' };
  }
  const dir = pct <= 0 ? '↓' : '↑';
  return {
    text: dir + ' ' + Math.abs(pct).toFixed(1) + '% from yesterday',
    cls: pct <= 0 ? 'positive' : 'warning'
  };
}

// ── Charts — render immediately with placeholder data ─────────────────────────

function initCharts() {
  charts.energy = makeChart('energyChart', {
    color: colors,
    tooltip: { trigger: 'axis' },
    grid: { left: 45, right: 20, top: 30, bottom: 35 },
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    yAxis: { type: 'value', name: 'kWh' },
    series: [{
      name: 'Energy kWh', type: 'line', smooth: true, symbolSize: 8,
      lineStyle: { width: 4 }, areaStyle: { opacity: 0.18 },
      data: [1200, 1350, 1280, 1420, 1500, 1100, 980]
    }]
  });

  charts.room = makeChart('roomChart', {
    color: ['#22C55E', '#86EFAC', '#EAB308'],
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/><b>${p.value}%</b> of total floor space`
    },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['48%', '72%'], center: ['50%', '43%'],
      data: [{ value: 52, name: 'Occupied' }, { value: 28, name: 'Available' }, { value: 20, name: 'Idle' }]
    }]
  });

  const days30 = Array.from({ length: 30 }, (_, i) => 'D' + (i + 1));
  const base = [35,36,36,37,38,37,39,40,40,41,42,41,43,44,45,44,46,47,46,48,49,50,50,51,52,51,53,54,55,56];
  charts.forecast = makeChart('forecastChart', {
    color: ['#166534', '#22C55E', '#22C55E'],
    tooltip: {
      trigger: 'axis',
      formatter: ps => ps[0].name + '<br>' + ps.map(p =>
        `${p.seriesName}: <b>${p.value} kWh</b>`).join('<br>')
    },
    legend: { top: 0 },
    grid: { left: 45, right: 20, top: 45, bottom: 35 },
    xAxis: { type: 'category', data: days30 },
    yAxis: { type: 'value', name: 'kWh' },
    series: [
      { name: 'Forecast', type: 'line', smooth: true, data: base, lineStyle: { width: 4 }, areaStyle: { opacity: 0.12 } },
      { name: 'Upper Band', type: 'line', smooth: true, data: base.map(v => v + 3), lineStyle: { type: 'dashed' }, symbol: 'none' },
      { name: 'Lower Band', type: 'line', smooth: true, data: base.map(v => v - 3), lineStyle: { type: 'dashed' }, symbol: 'none' }
    ]
  });
}

// ── Dashboard KPI cards ───────────────────────────────────────────────────────
/*
  Energy Usage   → how many kWh your building consumed today vs yesterday
  Water Usage    → total liters consumed today vs yesterday
  Occupancy      → average % of floor space occupied (from monthly KPI history)
  Carbon Emission→ total CO₂ produced (kg) this month
  Monthly Cost   → sum of electricity + water costs today (scales to monthly view)
*/

async function loadDashboard() {
  const cards = document.querySelectorAll('.kpi-card');
  if (!cards.length) return;

  try {
    const [summary, kpi] = await Promise.all([
      apiFetch('/api/resources/summary'),
      apiFetch('/api/kpi/current').catch(() => null)
    ]);

    const elec = summary.electricity || {};
    const water = summary.water || {};

    // Energy
    cards[0].querySelector('h3').textContent = (elec.value || 0).toLocaleString() + ' kWh';
    const et = trendLabel(elec.trend_pct || 0);
    const ep = cards[0].querySelector('p');
    ep.textContent = et.text; ep.className = et.cls;

    // Water
    cards[1].querySelector('h3').textContent = (water.value || 0).toLocaleString() + ' L';
    const wt = trendLabel(water.trend_pct || 0);
    const wp = cards[1].querySelector('p');
    wp.textContent = wt.text; wp.className = wt.cls;

    // Occupancy (monthly avg from KPI history)
    if (kpi?.avg_occupancy_rate != null) {
      cards[2].querySelector('h3').textContent = kpi.avg_occupancy_rate.toFixed(0) + '%';
      cards[2].querySelector('p').textContent =
        kpi.avg_occupancy_rate > 70 ? 'Peak usage detected' : 'Normal occupancy';
    }

    // Carbon footprint
    if (kpi?.carbon_footprint != null) {
      cards[3].querySelector('h3').textContent = kpi.carbon_footprint.toFixed(0) + ' kg';
      cards[3].querySelector('p').textContent = 'CO₂e this week';
    }

    // Monthly cost — extrapolate today's daily spend × 30 for a monthly estimate
    const totalCost = (elec.cost || 0) + (water.cost || 0);
    if (totalCost > 0) {
      const monthlyCostEst = totalCost * 30;
      cards[4].querySelector('h3').textContent = fmtRM(monthlyCostEst);
      cards[4].querySelector('p').textContent = 'Estimated from today\'s usage';
    }

    // Hero stats — efficiency score + carbon reduction
    if (kpi) {
      const stats = document.querySelectorAll('.hero-stats strong');
      if (stats[2] && kpi.efficiency_score != null)
        stats[2].textContent = kpi.efficiency_score + '/100';
      if (stats[0] && kpi.cost_reduction != null)
        stats[0].textContent = kpi.cost_reduction.toFixed(0) + '%';
    }
  } catch (e) {
    console.warn('Dashboard load failed:', e);
  }
}

// ── Energy chart (7-day trend) ────────────────────────────────────────────────
/*
  Shows how much electricity (kWh) the building used each day for the past 7 days.
  Rising trend = more energy consumed = higher cost. Falling = improving efficiency.
*/

async function loadEnergyChart() {
  try {
    const data = await apiFetch('/api/resources/trend?days=7&resource_type=electricity');
    if (!data.length) return;
    charts.energy.setOption({
      xAxis: { data: data.map(d => d.date.slice(5)) },
      series: [{ data: data.map(d => d.value) }]
    });
  } catch (e) {
    console.warn('Energy chart failed:', e);
  }
}

// ── Room utilization pie ──────────────────────────────────────────────────────
/*
  Occupied = % of floor space with people in it.
  Available = empty rooms ready to be booked.
  Idle = floors/rooms with lights/AC on but nobody there — a waste target.
*/

async function loadRoomChart() {
  try {
    const kpi = await apiFetch('/api/kpi/current');
    const used = Math.max(0, Math.round(kpi.avg_occupancy_rate || 52));
    const rem = 100 - used;
    charts.room.setOption({
      series: [{
        data: [
          { value: used, name: 'Occupied' },
          { value: Math.round(rem * 0.6), name: 'Available' },
          { value: Math.round(rem * 0.4), name: 'Idle' }
        ]
      }]
    });
  } catch (e) {
    console.warn('Room chart failed:', e);
  }
}

// ── Forecast cards ────────────────────────────────────────────────────────────
/*
  Next Month Projection = what the AI predicts you'll pay next month (RM).
  Expected Energy       = the kWh load behind that cost (cost ÷ RM0.51/kWh).
  Budget Risk           = High if growth % > 7%, Low otherwise.
  A "High" budget risk means you're likely to exceed your monthly budget.
*/

async function loadForecast() {
  try {
    const f = await apiFetch('/api/forecast/next-month');
    const cards = document.querySelectorAll('.forecast-card');
    if (!cards.length) return;

    if (f.projected_cost != null) {
      cards[0].querySelector('h3').textContent = fmtRM(f.projected_cost);
      const sign = f.growth_percentage >= 0 ? '+' : '';
      const driver = f.drivers?.[0] || '';
      cards[0].querySelector('p').textContent =
        sign + (f.growth_percentage || 0).toFixed(1) + '% predicted change. ' + driver;
    }

    if (f.projected_cost) {
      const kwh = Math.round(f.projected_cost / 0.51);
      cards[1].querySelector('h3').textContent = kwh.toLocaleString() + ' kWh';
      cards[1].querySelector('p').textContent =
        'Predicted electricity demand for next month.';
    }

    if (f.budget_risk != null) {
      const riskEl = cards[2].querySelector('h3');
      riskEl.textContent = f.budget_risk ? 'High' : 'Low';
      riskEl.style.color = f.budget_risk ? '#dc2626' : '#16a34a';
      cards[2].querySelector('p').textContent = f.budget_risk_message
        || (f.budget_risk ? 'Cost trending above budget — action recommended.' : 'Spending within expected range.');
    }
  } catch (e) {
    console.warn('Forecast cards failed:', e);
  }
}

// ── Forecast chart (30-day) ───────────────────────────────────────────────────
/*
  Forecast line = ML model's best prediction (Random Forest trained on your data).
  Upper/Lower Band = confidence range — actual cost will likely fall between them.
  The wider the band, the less certain the model is.
*/

async function loadForecastChart() {
  try {
    const data = await apiFetch('/api/forecast/trend?days=30');
    if (!data.length) return;
    charts.forecast.setOption({
      xAxis: { data: data.map((_, i) => 'D' + (i + 1)) },
      series: [
        { data: data.map(d => d.estimated) },
        { data: data.map(d => d.high) },
        { data: data.map(d => d.low) }
      ]
    });
  } catch (e) {
    console.warn('Forecast chart failed:', e);
  }
}

// ── Anomalies & recommendations ───────────────────────────────────────────────
/*
  Anomaly cards = real detected problems from the building sensors.
    - Critical = requires immediate attention (e.g. 250% energy spike at 2AM).
    - Medium   = worth investigating (e.g. water surge on a floor).
  Recommendation card = the highest-value suggestion the AI found to reduce waste.

  ACKNOWLEDGE = you've seen the anomaly and someone is handling it.
    The card greys out so you know it's been logged, not ignored.
  IMPLEMENT   = you're applying the recommendation. It's marked as done.
*/

async function loadAnomalies() {
  try {
    const [allAnomalies, recs] = await Promise.all([
      apiFetch('/api/anomalies?limit=50&status=pending'),
      apiFetch('/api/recommendations?limit=3')
    ]);
    // Deduplicate: keep only the first occurrence of each floor+type combo
    const seenSigs = new Set();
    const anomalies = allAnomalies.filter(a => {
      const sig = `${a.floor}|${a.anomaly_type}`;
      if (seenSigs.has(sig)) return false;
      seenSigs.add(sig);
      return true;
    }).slice(0, 2);

    const grid = document.querySelector('.insight-grid');
    if (!grid) return;
    grid.innerHTML = '';

    anomalies.forEach(a => {
      const badgeCls = a.severity === 'critical' ? 'danger' : 'warning';
      const badgeTxt = a.severity === 'critical' ? 'Critical' : 'Medium';
      const timeAgo = a.created_at ? timeSince(a.created_at) : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="insight-card" id="anomaly-${a.id}">
          <div class="alert-badge ${badgeCls}">${badgeTxt}</div>
          <h3>${a.floor} — ${a.anomaly_type.replace(/_/g, ' ')}</h3>
          <p>${a.message}</p>
          ${timeAgo ? `<small style="color:var(--muted);font-size:12px">${timeAgo}</small>` : ''}
          <br><br>
          <button type="button" onclick="acknowledgeAnomaly(${a.id}, this)">Acknowledge</button>
        </div>
      `);
    });

    recs.forEach(r => {
      const saving = r.estimated_savings ? ` Estimated savings: ${fmtRM(r.estimated_savings)}/month.` : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="insight-card" id="rec-${r.id}">
          <div class="alert-badge success">High Impact</div>
          <h3>${r.title}</h3>
          <p>${r.description}${saving}</p>
          ${r.carbon_impact ? `<small style="color:var(--muted);font-size:12px">Carbon saved: ${r.carbon_impact.toFixed(0)} kg CO₂/month</small>` : ''}
          <br><br>
          <button type="button" onclick="implementRec(${r.id}, this)">Implement</button>
        </div>
      `);
    });

    if (!anomalies.length && !recs.length) restoreStaticAlerts(grid);
  } catch (e) {
    console.warn('Anomalies failed:', e);
  }
}

function restoreStaticAlerts(grid) {
  grid.innerHTML = `
    <div class="insight-card">
      <div class="alert-badge danger">Critical</div>
      <h3>Level 18 Energy Spike</h3>
      <p>250% above normal at 2:00 AM. Possible AC or lighting left on.</p>
      <button>Dispatch Team</button>
    </div>
    <div class="insight-card">
      <div class="alert-badge warning">Medium</div>
      <h3>Level 10 Water Surge</h3>
      <p>Water usage increased by 42%. Possible leak near pantry area.</p>
      <button>Schedule Check</button>
    </div>
    <div class="insight-card">
      <div class="alert-badge success">High Impact</div>
      <h3>Consolidate Low-Occupancy Floors</h3>
      <p>Move after-hours meetings to Level 7. Estimated savings: RM4,700/month.</p>
      <button>Implement</button>
    </div>
  `;
}

// Tracks which anomaly IDs have been acknowledged this session
// so they are never re-shown even if loadAnomalies() reruns.
const acknowledgedIds = new Set();

async function acknowledgeAnomaly(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    await apiFetch(`/api/anomalies/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' })
    });

    acknowledgedIds.add(id);
    btn.textContent = 'Acknowledged ✓';

    // Animate the card out, then remove it and load the next pending anomaly
    const card = document.getElementById('anomaly-' + id);
    if (card) {
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.96)';
      setTimeout(() => {
        card.remove();
        loadNextAnomaly(); // pull in the next unacknowledged one
      }, 420);
    }

    toast('Anomaly acknowledged. Team has been notified.');
  } catch (e) {
    btn.textContent = 'Acknowledge';
    btn.disabled = false;
    toast('Failed to acknowledge — is the backend running?', 'err');
  }
}

// Fetches the next pending anomaly not already shown and injects it
async function loadNextAnomaly() {
  try {
    const grid = document.querySelector('.insight-grid');
    if (!grid) return;

    // How many anomaly cards still visible?
    const remaining = grid.querySelectorAll('[id^="anomaly-"]').length;
    if (remaining >= 2) return; // already have enough

    const all = await apiFetch('/api/anomalies?limit=50&status=pending');
    // Skip already shown IDs and acknowledged ones
    const shown = new Set(
      [...grid.querySelectorAll('[id^="anomaly-"]')]
        .map(el => parseInt(el.id.replace('anomaly-', '')))
    );
    // Also skip floor+type combos already visible (no duplicates)
    const shownSignatures = new Set(
      [...grid.querySelectorAll('[id^="anomaly-"]')]
        .map(el => el.querySelector('h3')?.textContent || '')
    );
    const next = all.find(a => {
      const sig = `${a.floor} — ${a.anomaly_type.replace(/_/g, ' ')}`;
      return !shown.has(a.id) && !acknowledgedIds.has(a.id) && !shownSignatures.has(sig);
    });
    if (!next) return;

    const badgeCls = next.severity === 'critical' ? 'danger' : 'warning';
    const badgeTxt = next.severity === 'critical' ? 'Critical' : 'Medium';
    const timeAgo = next.created_at ? timeSince(next.created_at) : '';

    const div = document.createElement('div');
    div.className = 'insight-card';
    div.id = 'anomaly-' + next.id;
    div.style.opacity = '0';
    div.style.transform = 'scale(0.96)';
    div.innerHTML = `
      <div class="alert-badge ${badgeCls}">${badgeTxt}</div>
      <h3>${next.floor} — ${next.anomaly_type.replace(/_/g, ' ')}</h3>
      <p>${next.message}</p>
      ${timeAgo ? `<small style="color:var(--muted);font-size:12px">${timeAgo}</small>` : ''}
      <br><br>
      <button type="button" onclick="acknowledgeAnomaly(${next.id}, this)">Acknowledge</button>
    `;

    // Insert before the recommendation card (last child)
    const recCard = grid.querySelector('[id^="rec-"]');
    grid.insertBefore(div, recCard || null);

    // Fade in
    requestAnimationFrame(() => {
      div.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      div.style.opacity = '1';
      div.style.transform = 'scale(1)';
    });
  } catch (e) {
    console.warn('loadNextAnomaly failed:', e);
  }
}

// When Implement is pressed:
//   1. Backend marks the recommendation as implemented
//   2. Card greys out — the suggestion is now "in progress"
//   3. Toast confirms
async function implementRec(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Applying…';
  try {
    await apiFetch(`/api/recommendations/${id}/implement`, { method: 'PUT' });
    btn.textContent = 'Implemented';
    const card = document.getElementById('rec-' + id);
    if (card) card.classList.add('acknowledged');
    toast('Recommendation marked as implemented!');
  } catch (e) {
    btn.textContent = 'Implement';
    btn.disabled = false;
    toast('Failed to implement — is the backend running?', 'err');
  }
}

// ── Hero stats — potential savings from recommendations ───────────────────────

async function loadHeroStats() {
  try {
    const s = await apiFetch('/api/recommendations/summary');
    if (s.total_potential_savings > 0) {
      const stats = document.querySelectorAll('.hero-stats strong');
      if (stats[1]) stats[1].textContent = fmtRM(s.total_potential_savings);
    }
  } catch (e) {
    console.warn('Hero stats failed:', e);
  }
}

// ── Scheduler integration ─────────────────────────────────────────────────────
/*
  Calls all three scheduler endpoints and updates:
    1. Hero panel — Live Building Status floors + AI Action note
    2. Hero stats — Monthly Savings (domino-effect total)
    3. Alerts section — Space Consolidation card + Logistics card
*/

async function loadScheduler() {
  try {
    const [consolidation, logistics] = await Promise.all([
      apiFetch('/api/scheduler/consolidation'),
      apiFetch('/api/scheduler/logistics')
    ]);

    // ── 1. Live Building Status floors ──────────────────────────────────────
    const visual = document.querySelector('.building-visual');
    if (visual && consolidation.underused_floors?.length) {
      const underused = new Set(consolidation.underused_floors.map(String));
      // Keep existing floor divs but reclassify based on real consolidation data
      visual.querySelectorAll('.floor').forEach(div => {
        const lvlMatch = div.textContent.match(/Level\s+(\d+)/);
        if (!lvlMatch) return;
        const lvl = lvlMatch[1];
        if (underused.has(lvl)) {
          div.className = 'floor warn';
          div.querySelector('span').textContent = 'Low Occupancy';
        }
      });
    }

    // ── 2. AI Action note — real consolidation advice ────────────────────────
    const aiNote = document.querySelector('.ai-note');
    if (aiNote && consolidation.recommended_consolidation?.length) {
      const floors = consolidation.recommended_consolidation.join(' & Floor ');
      const saving = fmtRM(consolidation.total_savings);
      aiNote.innerHTML =
        `<strong>AI Action:</strong> Consolidate Floor ${floors} — ` +
        `below ${consolidation.utilization_threshold_pct}% utilisation. ` +
        `Estimated saving: <strong>${saving}/month</strong>.`;
    }

    // ── 3. Monthly Savings hero stat — use domino-effect total ──────────────
    const primarySavings = consolidation.primary_savings || 0;
    if (primarySavings > 0) {
      const domino = await apiFetch(
        `/api/scheduler/domino-effect?primary_savings=${primarySavings}`
      );
      const stats = document.querySelectorAll('.hero-stats strong');
      if (stats[1] && domino.total_savings > 0)
        stats[1].textContent = fmtRM(domino.total_savings);
    }

    // ── 4. Scheduler cards in Alerts section ────────────────────────────────
    const grid = document.querySelector('.insight-grid');
    if (!grid) return;

    // Space Consolidation card
    if (consolidation.recommended_consolidation?.length) {
      const floors = consolidation.recommended_consolidation.join(', Floor ');
      const card = document.createElement('div');
      card.className = 'insight-card recommendation';
      card.innerHTML = `
        <span class="badge" style="background:#e0f2fe;color:#0369a1">Space Scheduling</span>
        <h3>Consolidate Floor ${floors}</h3>
        <p>
          ${consolidation.recommended_consolidation.length} floor(s) operating below
          ${consolidation.utilization_threshold_pct}% utilisation threshold.
          Shutting down HVAC &amp; lighting saves
          <strong>${fmtRM(consolidation.primary_savings)}/month</strong> in energy.
          Additional savings: janitorial (${fmtRM(consolidation.secondary?.janitorial_savings || 0)}),
          security (${fmtRM(consolidation.secondary?.security_savings || 0)}),
          cleaning (${fmtRM(consolidation.secondary?.cleaning_supplies_savings || 0)}).
        </p>
        <small style="color:var(--muted)">Total projected saving: <strong>${fmtRM(consolidation.total_savings)}/month</strong> · Trigger: ${consolidation.trigger}</small>
      `;
      grid.appendChild(card);
    }

    // Logistics Optimisation card
    if (logistics.estimated_monthly_savings > 0) {
      const card = document.createElement('div');
      card.className = 'insight-card recommendation';
      card.innerHTML = `
        <span class="badge" style="background:#fef9c3;color:#854d0e">Logistics</span>
        <h3>Logistics Optimisation</h3>
        <p>
          <strong>Deliveries:</strong> ${logistics.transportation}<br>
          <strong>Inventory:</strong> ${logistics.materials}<br>
          <strong>Workforce:</strong> ${logistics.manpower}
        </p>
        <small style="color:var(--muted)">
          Delivery trips ↓ ${logistics.delivery_reduction_pct}% ·
          Inventory cost ↓ ${logistics.inventory_cost_reduction_pct}% ·
          Estimated saving: <strong>${fmtRM(logistics.estimated_monthly_savings)}/month</strong>
        </small>
      `;
      grid.appendChild(card);
    }

  } catch (e) {
    console.warn('Scheduler load failed:', e);
  }
}

// ── Simulator ─────────────────────────────────────────────────────────────────

let lastSimQuery = '';

const SIM_KEYWORDS = /energy|power|hvac|water|cool|heat|cost|electr|carbon|emission|sav|floor|room|occupan|solar|renew|effici|leak|pipe|light|sustain|reduc|optim|cut|lower|improv|wast/i;

function detectQueryType(q) {
  const s = q.toLowerCase();
  if (/^(what|how much|tell me|show me|what will|predict|what.s|whats)/i.test(s) &&
      /bill|cost|price|spend|budget|charg|kwh|litr|watt|next month|two month|three month|next.*month|month.*bill/i.test(s)) return 'forecast';
  if (/^(what|how much|show me|tell me)/i.test(s) &&
      /usage|consumption|energy|water|electric|carbon|emission|occupan/i.test(s) &&
      !/reduc|optim|improv|cut|lower|sav/i.test(s)) return 'summary';
  return 'strategy';
}

function detectSimTopic(q) {
  const s = (q || '').toLowerCase();
  if (/hvac|cool|heat|thermostat|air.con|chiller/.test(s)) return 'hvac';
  if (/water|leak|pipe|plumb|flood/.test(s)) return 'water';
  if (/carbon|co2|emission|green|sustain/.test(s)) return 'carbon';
  if (/solar|renew|panel|battery|pv/.test(s)) return 'renewable';
  if (/occupan|space|floor|room|consoli/.test(s)) return 'occupancy';
  return 'energy';
}

const RISK_META = {
  hvac:      { labels: ['Thermal Comfort','HVAC Change Effort','Energy Savings','Rollout Time'],
               comfort: { good:'Maintained', warn:'Minor Shift', bad:'Noticeable' },
               biz:     { good:'Low', warn:'Moderate', bad:'High' },
               roi:     { good:'Excellent', warn:'Good', bad:'Moderate' } },
  water:     { labels: ['Service Disruption','Repair Effort','Water Savings ROI','Fix Timeline'],
               comfort: { good:'Minimal', warn:'Moderate', bad:'Significant' },
               biz:     { good:'Low', warn:'Moderate', bad:'High' },
               roi:     { good:'Very High', warn:'High', bad:'Moderate' } },
  carbon:    { labels: ['Env. Benefit','Operational Change','Carbon ROI','Cert. Timeline'],
               comfort: { good:'Positive', warn:'Neutral', bad:'Trade-off' },
               biz:     { good:'Minimal', warn:'Moderate', bad:'Significant' },
               roi:     { good:'Very High', warn:'High', bad:'Medium' } },
  renewable: { labels: ['Grid Dependency','Install Complexity','Energy ROI','Install Time'],
               comfort: { good:'Independent', warn:'Reduced', bad:'Dependent' },
               biz:     { good:'Simple', warn:'Moderate', bad:'Complex' },
               roi:     { good:'Excellent', warn:'Strong', bad:'Moderate' } },
  occupancy: { labels: ['Occupant Comfort','Space Disruption','Space ROI','Migration Time'],
               comfort: { good:'High', warn:'Moderate', bad:'Low' },
               biz:     { good:'Minimal', warn:'Moderate', bad:'Significant' },
               roi:     { good:'Very High', warn:'High', bad:'Medium' } },
  energy:    { labels: ['Comfort Impact','Business Impact','ROI','Payback'],
               comfort: { good:'Low', warn:'Moderate', bad:'High' },
               biz:     { good:'Low', warn:'Moderate', bad:'High' },
               roi:     { good:'Very High', warn:'High', bad:'Medium' } },
};

async function handleForecastQuestion(query, grid, btn) {
  if (btn) { btn.textContent = 'Fetching…'; btn.disabled = true; }
  if (grid) grid.innerHTML = `<div class="scenario-card" style="grid-column:1/-1;opacity:0.5;padding:30px;text-align:center"><p>Fetching forecast data…</p></div>`;
  const riskBox = document.querySelector('.risk-box');
  if (riskBox) riskBox.style.display = 'none';
  try {
    const forecast = await apiFetch('/api/forecast/next-month');
    const s = query.toLowerCase();
    const months = /two|2/.test(s) ? 2 : /three|3/.test(s) ? 3 : /six|6/.test(s) ? 6 : 1;
    const totalCost = (forecast.projected_cost || 0) * months;
    const sign = (forecast.growth_percentage || 0) >= 0 ? '+' : '';
    grid.innerHTML = `<div class="scenario-card" style="grid-column:1/-1;padding:32px">
      <span style="color:var(--primary);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em">AI Forecast Answer</span>
      <h3 style="font-size:2.2rem;color:var(--primary);margin:14px 0 6px">${fmtRM(totalCost)}</h3>
      <p>Projected total cost for the next <strong>${months} month${months > 1 ? 's' : ''}</strong>.</p>
      <ul style="margin-top:18px;line-height:2">
        <li>Per-month estimate: <strong>${fmtRM(forecast.projected_cost)}</strong></li>
        <li>Trend vs last month: <strong>${sign}${(forecast.growth_percentage || 0).toFixed(1)}%</strong></li>
        <li>Expected energy: <strong>${Math.round((forecast.projected_cost || 0) / 0.51).toLocaleString()} kWh</strong></li>
        <li>Budget risk: <strong style="color:${forecast.budget_risk ? '#dc2626' : '#16a34a'}">${forecast.budget_risk ? 'High' : 'Low'}</strong></li>
        ${forecast.drivers?.[0] ? `<li>Key cost driver: <strong>${forecast.drivers[0]}</strong></li>` : ''}
      </ul>
      <p style="margin-top:20px;color:var(--muted);font-size:13px">Want to cut this cost? Try: <em>"How can we reduce energy costs by 15%?"</em></p>
    </div>`;
    toast('Forecast data loaded', 'info');
  } catch (e) {
    if (grid) grid.innerHTML = `<div class="scenario-card" style="grid-column:1/-1;text-align:center;padding:40px"><h3>Could not fetch forecast</h3><p>Make sure the backend is running.</p></div>`;
    toast('Could not fetch forecast', 'err');
  } finally {
    if (btn) { btn.textContent = 'Simulate'; btn.disabled = false; }
    if (grid) grid.classList.remove('simulating');
  }
}

async function handleSummaryQuestion(query, grid, btn) {
  if (btn) { btn.textContent = 'Fetching…'; btn.disabled = true; }
  if (grid) grid.innerHTML = `<div class="scenario-card" style="grid-column:1/-1;opacity:0.5;padding:30px;text-align:center"><p>Fetching live data…</p></div>`;
  const riskBox = document.querySelector('.risk-box');
  if (riskBox) riskBox.style.display = 'none';
  try {
    const [summary, kpi] = await Promise.all([
      apiFetch('/api/resources/summary'),
      apiFetch('/api/kpi/current').catch(() => null)
    ]);
    const elec = summary.electricity || {};
    const water = summary.water || {};
    grid.innerHTML = `<div class="scenario-card" style="grid-column:1/-1;padding:32px">
      <span style="color:var(--primary);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Live Building Data</span>
      <h3 style="margin:14px 0 6px">Today's Resource Summary</h3>
      <ul style="margin-top:12px;line-height:2.2">
        <li>Energy used today: <strong>${Math.round(elec.value || 0).toLocaleString()} kWh</strong></li>
        <li>Water used today: <strong>${Math.round(water.value || 0).toLocaleString()} L</strong></li>
        ${kpi ? `<li>Occupancy: <strong>${(kpi.avg_occupancy_rate || 0).toFixed(0)}%</strong></li>` : ''}
        ${kpi ? `<li>Carbon emission: <strong>${(kpi.carbon_footprint || 0).toFixed(0)} kg CO₂e</strong></li>` : ''}
        ${kpi ? `<li>Efficiency score: <strong>${kpi.efficiency_score || '—'}%</strong></li>` : ''}
        <li>Estimated daily cost: <strong>${fmtRM((elec.cost || 0) + (water.cost || 0))}</strong></li>
      </ul>
      <p style="margin-top:20px;color:var(--muted);font-size:13px">Want to optimise usage? Try: <em>"How can we reduce energy consumption by 20%?"</em></p>
    </div>`;
    toast('Live data loaded', 'info');
  } catch (e) {
    if (grid) grid.innerHTML = `<div class="scenario-card" style="grid-column:1/-1;text-align:center;padding:40px"><h3>Could not fetch data</h3></div>`;
    toast('Could not fetch live data', 'err');
  } finally {
    if (btn) { btn.textContent = 'Simulate'; btn.disabled = false; }
    if (grid) grid.classList.remove('simulating');
  }
}

async function runSimulation() {
  const input = document.getElementById('simulationInput');
  const query = input?.value?.trim();
  if (!query) {
    toast('Please enter a question first.', 'info');
    return;
  }

  const wordCount = query.split(/\s+/).length;
  if (wordCount < 3 && !SIM_KEYWORDS.test(query)) {
    const grid = document.getElementById('scenarioGrid');
    if (grid) grid.innerHTML = `<div class="scenario-card" style="grid-column:1/-1;text-align:center;padding:40px">
      <h3 style="color:var(--primary)">Ask a sustainability question</h3>
      <p style="color:var(--muted);margin-top:8px">Try something like:<br><em>"How can we reduce energy costs by 15%?"</em><br><em>"Optimise HVAC to lower carbon emissions"</em><br><em>"What is the bill for next month?"</em></p>
    </div>`;
    toast('Please ask a sustainability question', 'info');
    return;
  }

  const queryType = detectQueryType(query);
  const grid = document.getElementById('scenarioGrid');
  const btn = document.querySelector('.input-row button');
  if (grid) grid.classList.add('simulating');

  if (queryType === 'forecast') { await handleForecastQuestion(query, grid, btn); return; }
  if (queryType === 'summary')  { await handleSummaryQuestion(query, grid, btn); return; }

  const riskBox = document.querySelector('.risk-box');
  if (riskBox) riskBox.style.display = '';

  const btn = document.querySelector('.input-row button');
  const grid = document.getElementById('scenarioGrid');

  if (btn) { btn.textContent = 'Simulating…'; btn.disabled = true; }

  // Show skeleton cards immediately so user sees something is happening
  if (grid) {
    grid.classList.add('simulating');
    grid.innerHTML = ['A', 'B', 'C'].map(l => `
      <div class="scenario-card" style="opacity:0.5">
        <span>Scenario ${l}</span>
        <h3 style="background:#e2e8f0;color:transparent;border-radius:6px">Generating…</h3>
        <p style="background:#f1f5f9;color:transparent;border-radius:4px">TowerMind is analysing your building data…</p>
        <ul>
          <li>Savings: <strong>—</strong></li>
          <li>Carbon Reduction: <strong>—</strong></li>
          <li>Effort: <strong>—</strong></li>
          <li>Comfort Score: <strong>—</strong></li>
        </ul>
      </div>
    `).join('');
  }

  try {
    // Try Gemini endpoint with 9s timeout; on any failure use the instant fallback
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    let data;
    try {
      data = await apiFetch('/api/simulation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch {
      clearTimeout(timeoutId);
      data = await apiFetch('/api/simulation/fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (data) data.used_gemini = false;
    }

    if (data && (data.scenario_a || data.scenario_b || data.scenario_c)) {
      lastSimQuery = query;
      renderSimulation(data);
      toast(data.used_gemini ? 'Powered by Gemini AI' : 'Powered by Digital Twin Engine', 'info');
    } else {
      throw new Error('Empty response');
    }
  } catch (e) {
    console.warn('Simulation failed:', e);
    if (grid) grid.innerHTML = `
      <div class="scenario-card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
        <h3 style="color:var(--primary);margin-bottom:10px">Simulation unavailable</h3>
        <p>Could not reach the backend. Make sure <code>python app.py</code> is running.</p>
      </div>`;
    toast('Simulation failed — check backend is running', 'err');
  } finally {
    if (btn) { btn.textContent = 'Simulate'; btn.disabled = false; }
    if (grid) grid.classList.remove('simulating');
  }
}

function renderSimulation(data) {
  const grid = document.getElementById('scenarioGrid');
  if (!grid) return;

  const keys = ['scenario_a', 'scenario_b', 'scenario_c'];
  const labels = ['Scenario A', 'Scenario B', 'Scenario C'];
  const recommended = data.recommended || 'scenario_c';
  const sourceLabel = data.used_gemini
    ? '<span class="sim-source gemini">Gemini AI</span>'
    : '<span class="sim-source fallback">Digital Twin Engine</span>';

  // Inject source badge above scenarios
  const existingBadge = document.getElementById('sim-source-badge');
  if (existingBadge) existingBadge.remove();
  const badge = document.createElement('div');
  badge.id = 'sim-source-badge';
  badge.innerHTML = sourceLabel;
  badge.style.marginBottom = '12px';
  grid.before(badge);

  grid.innerHTML = keys.map((key, i) => {
    const s = data[key];
    if (!s) return '';
    const isRec = key === recommended;
    return `
      <div class="scenario-card${isRec ? ' recommended' : ''}">
        <span>${labels[i]}${isRec ? ' ★ Recommended' : ''}</span>
        <h3>${s.name || labels[i]}</h3>
        <p>${s.description || ''}</p>
        <ul>
          <li>Savings: <strong>${s.savings != null ? 'RM' + Number(s.savings).toLocaleString() + '/month' : '—'}</strong></li>
          <li>Carbon Reduction: <strong>${s.carbon_reduction != null ? s.carbon_reduction + '%' : '—'}</strong></li>
          <li>Effort: <strong>${s.effort || '—'}</strong></li>
          <li>Comfort Score: <strong>${s.comfort_score != null ? s.comfort_score + '%' : '—'}</strong></li>
          ${s.timeline ? `<li>Timeline: <strong>${s.timeline}</strong></li>` : ''}
          ${s.risk ? `<li>Risk: <strong>${s.risk}</strong></li>` : ''}
        </ul>
      </div>
    `;
  }).join('');

  // Update risk box with topic-aware labels from the recommended scenario
  const riskBox = document.querySelector('.risk-box');
  if (riskBox) {
    const rec = data[recommended];
    if (rec) {
      const topic = detectSimTopic(lastSimQuery);
      const meta  = RISK_META[topic] || RISK_META.energy;
      const [l0, l1, l2, l3] = meta.labels;

      const cs = rec.comfort_score || 75;
      const ct = cs >= 86 ? 'good' : cs >= 75 ? 'warn' : 'bad';

      const bt = rec.effort === 'Low' ? 'good' : rec.effort === 'Medium' ? 'warn' : 'bad';

      const cr = rec.carbon_reduction || 0;
      const rt = cr >= 20 ? 'good' : cr >= 10 ? 'warn' : 'bad';

      const riskGrid = riskBox.querySelector('.risk-grid');
      if (riskGrid) {
        riskGrid.innerHTML = [
          [l0, meta.comfort[ct], ct],
          [l1, meta.biz[bt],     bt],
          [l2, meta.roi[rt],     rt],
          [l3, rec.timeline || '—', 'neutral'],
        ].map(([label, val, cls]) =>
          `<div><strong>${label}</strong><span class="risk-val ${cls}">${val}</span></div>`
        ).join('');
      }
    }

    // AI analysis text
    const old = riskBox.querySelector('.ai-analysis');
    if (old) old.remove();
    if (data.analysis) {
      const p = Object.assign(document.createElement('p'), {
        className: 'ai-analysis',
        textContent: data.analysis
      });
      riskBox.appendChild(p);
    }
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function timeSince(isoStr) {
  const diff = (Date.now() - new Date(isoStr)) / 1000;
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
  return Math.floor(diff / 86400) + ' days ago';
}

// ── Boot ──────────────────────────────────────────────────────────────────────

initCharts();

checkBackendStatus();

Promise.all([
  loadDashboard(),
  loadEnergyChart(),
  loadRoomChart(),
  loadForecast(),
  loadForecastChart(),
  loadHeroStats(),
  loadAnomalies().then(() => loadScheduler())
]);
