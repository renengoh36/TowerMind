let anomalyFilters = { severity: "all", status: "all" };

async function renderAnomaliesPage(container) {
  const [summary, anomalies] = await Promise.all([
    api.anomalies.summary(),
    api.anomalies.list({ severity: anomalyFilters.severity, status: anomalyFilters.status }),
  ]);

  container.innerHTML = `
    <div class="counter-row">
      <div class="counter-pill"><div class="counter-value" style="color:var(--danger-red);">🔴 ${summary.critical}</div><div class="counter-label">Critical</div></div>
      <div class="counter-pill"><div class="counter-value" style="color:var(--warning-yellow);">🟡 ${summary.medium}</div><div class="counter-label">Medium</div></div>
      <div class="counter-pill"><div class="counter-value" style="color:var(--success-green);">🟢 ${summary.resolved}</div><div class="counter-label">Resolved</div></div>
      <div class="counter-pill" style="display:flex;align-items:center;justify-content:center;">
        <button class="btn" id="run-detection-btn">🔍 Run Detection</button>
      </div>
    </div>

    <div class="filter-bar">
      ${["all", "critical", "high", "medium", "low"]
        .map((s) => `<span class="filter-chip sev-chip ${anomalyFilters.severity === s ? "active" : ""}" data-severity="${s}">${s}</span>`)
        .join("")}
      <span style="width:1px;background:var(--border-gray);"></span>
      ${["all", "pending", "acknowledged", "resolved"]
        .map((s) => `<span class="filter-chip status-chip ${anomalyFilters.status === s ? "active" : ""}" data-status="${s}">${s}</span>`)
        .join("")}
    </div>

    <div id="anomaly-list">
      ${anomalies.length ? anomalies.map(anomalyCardHtml).join("") : '<div class="empty-state">No anomalies match these filters.</div>'}
    </div>
  `;

  container.querySelectorAll(".sev-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      anomalyFilters.severity = chip.dataset.severity;
      renderAnomaliesPage(container);
    });
  });
  container.querySelectorAll(".status-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      anomalyFilters.status = chip.dataset.status;
      renderAnomaliesPage(container);
    });
  });

  container.querySelectorAll('[data-action="acknowledge"], [data-action="resolve"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const status = btn.dataset.action === "acknowledge" ? "acknowledged" : "resolved";
      await api.anomalies.updateStatus(btn.dataset.id, status);
      renderAnomaliesPage(container);
    });
  });

  document.getElementById("run-detection-btn").addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Scanning...";
    try {
      await api.anomalies.detect();
    } finally {
      renderAnomaliesPage(container);
    }
  });
}
