let lastSimulationQuery = "";
let lastSimulationResult = null;

async function renderSimulatorPage(container) {
  container.innerHTML = `
    <div class="card" style="margin-bottom:20px;">
      <div class="section-title" style="margin-top:0;">✨ AI Sustainability Advisor & Digital Twin Simulator</div>
      <div class="form-group">
        <textarea class="form-textarea" id="sim-query" placeholder="How can we safely cut our utility expenses by 15% next month?">${escapeHtml(lastSimulationQuery)}</textarea>
      </div>
      <button class="btn" id="sim-run-btn">🚀 Simulate</button>
    </div>
    <div id="sim-results"></div>
  `;

  document.getElementById("sim-run-btn").addEventListener("click", () => runSimulation(container));

  if (lastSimulationResult) {
    renderSimulationResults(lastSimulationResult);
  }
}

async function runSimulation(container) {
  const queryEl = document.getElementById("sim-query");
  const query = queryEl.value.trim();
  const resultsEl = document.getElementById("sim-results");
  const btn = document.getElementById("sim-run-btn");

  if (!query) {
    resultsEl.innerHTML = '<div class="error-state">Please describe what you would like to simulate.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Simulating...";
  resultsEl.innerHTML = '<div class="loading-state">Generating scenarios...</div>';

  try {
    const result = await api.simulation.generate(query);
    lastSimulationQuery = query;
    lastSimulationResult = result;
    renderSimulationResults(result);
  } catch (err) {
    resultsEl.innerHTML = `<div class="error-state">Simulation failed: ${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "🚀 Simulate";
  }
}

function renderSimulationResults(result) {
  const resultsEl = document.getElementById("sim-results");
  if (!resultsEl) return;

  const scenarios = ["scenario_a", "scenario_b", "scenario_c"];

  resultsEl.innerHTML = `
    ${
      result.source === "fallback"
        ? '<div class="alert-banner info">ℹ️ Showing rule-based scenarios (Gemini API not configured). Add GEMINI_API_KEY in backend/.env to enable live AI generation.</div>'
        : ""
    }
    <div class="section-title">📊 Scenario Comparison</div>
    <div class="grid grid-3">
      ${scenarios.map((key) => scenarioCardHtml(key, result[key], result.recommended)).join("")}
    </div>

    <div class="section-title">🔍 Risk Assessment</div>
    <div class="card">
      <div class="muted">${escapeHtml(result.analysis)}</div>
    </div>

    <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
      <button class="btn btn-secondary" id="sim-export-btn">📄 Export Report</button>
      <button class="btn btn-secondary" id="sim-resimulate-btn">🔄 Re-simulate</button>
      <button class="btn btn-success" id="sim-implement-btn">✅ Implement ${escapeHtml(result[result.recommended]?.name || "Scenario")}</button>
    </div>
  `;

  document.getElementById("sim-resimulate-btn").addEventListener("click", () => {
    runSimulation(document.getElementById("page-content"));
  });

  document.getElementById("sim-export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "towermind-simulation-report.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("sim-implement-btn").addEventListener("click", (e) => {
    e.target.textContent = "✅ Scenario marked for implementation";
    e.target.disabled = true;
  });
}
