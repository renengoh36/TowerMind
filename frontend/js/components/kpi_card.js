function formatNumber(value, decimals = 0) {
  return Number(value || 0).toLocaleString("en-MY", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function kpiCardHtml({ icon, label, value, trendPct }) {
  const up = trendPct >= 0;
  return `
    <div class="card kpi-card">
      <span class="kpi-icon">${icon}</span>
      <span class="kpi-label">${label}</span>
      <span class="kpi-value">${value}</span>
      <span class="kpi-trend ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(trendPct).toFixed(1)}%</span>
    </div>
  `;
}
