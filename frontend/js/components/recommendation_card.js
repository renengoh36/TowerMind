const CATEGORY_ICON = {
  electricity: "⚡",
  water: "💧",
  space: "🏢",
  manpower: "👷",
  materials: "🧹",
};

function recommendationCardHtml(r) {
  const icon = CATEGORY_ICON[r.category] || "💰";
  return `
    <div class="card rec-card">
      <div class="rec-header">
        <span class="rec-title">${icon} ${escapeHtml(r.title)}</span>
        ${r.implemented ? '<span class="badge badge-resolved">Implemented</span>' : ""}
      </div>
      <div class="rec-desc">${escapeHtml(r.description)}</div>
      <div class="rec-stats">
        <div>
          <div class="rec-stat-label">Est. Savings</div>
          <div class="rec-stat-value">RM ${formatNumber(r.estimated_savings)}/mo</div>
        </div>
        <div>
          <div class="rec-stat-label">Confidence</div>
          <div class="rec-stat-value">${r.confidence_score}%</div>
        </div>
        <div>
          <div class="rec-stat-label">Carbon Impact</div>
          <div class="rec-stat-value">${formatNumber(r.carbon_impact)}kg CO₂</div>
        </div>
      </div>
      ${r.carbon_equivalent && r.carbon_equivalent !== "N/A" ? `<div class="muted">🌳 Equivalent to ${escapeHtml(r.carbon_equivalent)}</div><br/>` : ""}
      <div class="rec-actions">
        ${
          r.implemented
            ? ""
            : `<button class="btn btn-sm" data-action="implement" data-id="${r.id}">✓ Implement</button>`
        }
      </div>
    </div>
  `;
}
