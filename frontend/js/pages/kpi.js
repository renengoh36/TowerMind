async function renderKpiPage(container) {
  const [current, history, leaderboard] = await Promise.all([
    api.kpi.current(),
    api.kpi.history(6),
    api.kpi.leaderboard(),
  ]);

  const waterScore = Math.max(40, Math.min(99, current.resource_score - 4));
  const wasteScore = Math.max(40, Math.min(99, current.carbon_score - 8));

  container.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <div class="hero-metric">
        <div class="chart-container sm" id="chart-efficiency-gauge" style="width:220px;flex-shrink:0;"></div>
        <div>
          <div class="kpi-label">TowerMind Efficiency Score</div>
          <div class="hero-sub">
            <div class="hero-sub-item"><div class="hero-sub-value">${current.energy_score}</div><div class="hero-sub-label">Energy Efficiency</div></div>
            <div class="hero-sub-item"><div class="hero-sub-value">${current.carbon_score}</div><div class="hero-sub-label">Carbon Impact</div></div>
            <div class="hero-sub-item"><div class="hero-sub-value">${current.resource_score}</div><div class="hero-sub-label">Resource Optimization</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div>
        <div class="section-title">Department Leaderboard</div>
        <div class="card" id="leaderboard-list"></div>
      </div>
      <div>
        <div class="section-title">Sustainability Radar</div>
        <div class="card chart-card">
          <div class="chart-container" id="chart-radar"></div>
        </div>
      </div>
    </div>

    <div class="section-title">Monthly KPI Trends (Last 6 Months)</div>
    <div class="card chart-card">
      <div class="chart-container" id="chart-kpi-trend"></div>
    </div>
  `;

  renderGaugeChart("chart-efficiency-gauge", current.efficiency_score);

  const medals = ["🥇", "🥈", "🥉"];
  const maxScore = Math.max(...leaderboard.map((l) => l.score), 1);
  document.getElementById("leaderboard-list").innerHTML = leaderboard.length
    ? leaderboard
        .map(
          (l) => `
        <div class="leaderboard-row">
          <span class="leaderboard-rank">${medals[l.rank - 1] || l.rank}</span>
          <span class="leaderboard-floor">${escapeHtml(l.floor)}</span>
          <span class="leaderboard-bar-track"><span class="leaderboard-bar-fill" style="width:${(l.score / maxScore) * 100}%"></span></span>
          <span class="leaderboard-score">${l.score}/100</span>
          <span class="leaderboard-trend">${l.co2_trend_pct >= 0 ? "▲" : "▼"} ${Math.abs(l.co2_trend_pct)}% CO₂</span>
        </div>`
        )
        .join("")
    : '<div class="empty-state">No floor data available.</div>';

  renderRadarChart(
    "chart-radar",
    [
      { name: "Energy Efficiency", max: 100 },
      { name: "Water Conservation", max: 100 },
      { name: "Waste Management", max: 100 },
      { name: "Carbon Reduction", max: 100 },
      { name: "Resource Optimization", max: 100 },
    ],
    [current.energy_score, waterScore, wasteScore, current.carbon_score, current.resource_score]
  );

  renderLineChart(
    "chart-kpi-trend",
    history.map((h) => h.month.slice(0, 7)),
    [
      { name: "Efficiency Score", data: history.map((h) => h.efficiency_score), color: CHART_COLORS.secondary },
      { name: "Carbon Footprint (t)", data: history.map((h) => h.carbon_footprint), color: CHART_COLORS.warning, yAxisIndex: 1 },
      { name: "Monthly Savings (RM)", data: history.map((h) => h.total_savings), color: CHART_COLORS.success, yAxisIndex: 1 },
    ],
    {
      yAxis: [
        { type: "value", name: "Score", splitLine: { lineStyle: { color: "#EDF2F7" } } },
        { type: "value", name: "Tonnes / RM", splitLine: { show: false } },
      ],
    }
  );
}
