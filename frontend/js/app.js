const PAGES = {
  dashboard: { title: "Dashboard", render: renderDashboardPage },
  kpi: { title: "KPI Executive Dashboard", render: renderKpiPage },
  forecast: { title: "AI Predictive Forecasting", render: renderForecastPage },
  anomalies: { title: "Anomaly Detection", render: renderAnomaliesPage },
  recommendations: { title: "Recommendations", render: renderRecommendationsPage },
  scheduler: { title: "Cross-Resource Scheduler", render: renderSchedulerPage },
  simulator: { title: "AI Sustainability Advisor", render: renderSimulatorPage },
};

async function navigate() {
  const hash = window.location.hash.replace("#", "") || "dashboard";
  const page = PAGES[hash] ? hash : "dashboard";
  const config = PAGES[page];

  setActiveNav(page);
  closeMobileSidebar();
  document.getElementById("page-title").textContent = config.title;

  const container = document.getElementById("page-content");
  container.innerHTML = '<div class="loading-state">Loading...</div>';

  try {
    await config.render(container);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error-state">Failed to load this page: ${escapeHtml(err.message)}</div>`;
  }
}

async function checkApiStatus() {
  const el = document.getElementById("api-status");
  try {
    await api.health();
    el.textContent = "● Connected";
    el.classList.remove("offline");
  } catch (err) {
    el.textContent = "● Backend offline";
    el.classList.add("offline");
  }
}

window.addEventListener("hashchange", navigate);
window.addEventListener("DOMContentLoaded", () => {
  checkApiStatus();
  setInterval(checkApiStatus, 30000);
  navigate();

  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
});
