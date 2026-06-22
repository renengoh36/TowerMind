const SCENARIO_ICON = { scenario_a: "🌡️", scenario_b: "🏢", scenario_c: "⭐" };

function scenarioCardHtml(key, scenario, recommended) {
  const isRecommended = key === recommended;
  return `
    <div class="card scenario-card ${isRecommended ? "recommended" : ""}">
      ${isRecommended ? '<span class="scenario-tag">⭐ Recommended</span>' : ""}
      <div class="scenario-name">${SCENARIO_ICON[key] || "📊"} ${escapeHtml(scenario.name)}</div>
      <div class="scenario-desc">${escapeHtml(scenario.description)}</div>
      <div class="scenario-metric"><span>💰 Savings</span><span>RM ${formatNumber(scenario.savings)}</span></div>
      <div class="scenario-metric"><span>📉 Carbon Reduction</span><span>${scenario.carbon_reduction}%</span></div>
      <div class="scenario-metric"><span>⚙️ Effort</span><span>${escapeHtml(scenario.effort)}</span></div>
      <div class="scenario-metric"><span>😊 Comfort Score</span><span>${scenario.comfort_score}/100</span></div>
      <div class="scenario-metric"><span>📅 Timeline</span><span>${escapeHtml(scenario.timeline)}</span></div>
      <div class="muted">⚠️ ${escapeHtml(scenario.risk)}</div>
    </div>
  `;
}
