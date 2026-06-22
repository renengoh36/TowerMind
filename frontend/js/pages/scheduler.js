async function renderSchedulerPage(container) {
  const consolidation = await api.scheduler.consolidation();
  const domino = await api.scheduler.dominoEffect(consolidation.primary_savings);
  const logistics = await api.scheduler.logistics();

  container.innerHTML = `
    <div class="card" style="margin-bottom:20px;">
      <div class="section-title" style="margin-top:0;">🏢 Space Consolidation Recommendation</div>
      <div class="muted">Low Occupancy Detected: ${escapeHtml(consolidation.trigger)}</div>
      <div class="muted">${consolidation.underused_floors.map(escapeHtml).join(", ")}: Under ${consolidation.utilization_threshold_pct}% utilization</div>
      <br/>
      <div class="kpi-trend up">✅ Recommendation: Consolidate to ${consolidation.recommended_consolidation.map(escapeHtml).join(" & ")}</div>
      <br/>
      <div class="rec-stats">
        <div><div class="rec-stat-label">Primary Savings</div><div class="rec-stat-value">RM ${formatNumber(consolidation.primary_savings)}</div></div>
        <div><div class="rec-stat-label">Janitorial</div><div class="rec-stat-value">-${consolidation.secondary.janitorial_hours_per_week}h/wk (RM ${consolidation.secondary.janitorial_savings})</div></div>
        <div><div class="rec-stat-label">Cleaning Supplies</div><div class="rec-stat-value">-${consolidation.secondary.cleaning_supplies_pct}% (RM ${consolidation.secondary.cleaning_supplies_savings})</div></div>
        <div><div class="rec-stat-label">Security Patrols</div><div class="rec-stat-value">-${consolidation.secondary.security_rounds_reduced} rounds (RM ${consolidation.secondary.security_savings})</div></div>
      </div>
      <div class="alert-banner info" style="margin-bottom:0;">Total Impact: RM ${formatNumber(consolidation.total_savings)}/month</div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="section-title" style="margin-top:0;">🔁 Resource Domino Effect Calculator</div>
        <div class="rec-stats" style="flex-direction:column;gap:10px;">
          <div class="leaderboard-row"><span>⚡ Primary (Energy)</span><span style="margin-left:auto;font-weight:700;">RM ${formatNumber(domino.primary_energy_savings)}</span></div>
          <div class="leaderboard-row"><span>👷 Manpower</span><span style="margin-left:auto;font-weight:700;">RM ${formatNumber(domino.secondary_manpower_savings)}</span></div>
          <div class="leaderboard-row"><span>🧹 Materials</span><span style="margin-left:auto;font-weight:700;">RM ${formatNumber(domino.secondary_materials_savings)}</span></div>
          <div class="leaderboard-row"><span>🛡️ Security</span><span style="margin-left:auto;font-weight:700;">RM ${formatNumber(domino.secondary_security_savings)}</span></div>
          <div class="leaderboard-row" style="border-bottom:none;"><span><strong>Total Savings</strong></span><span style="margin-left:auto;font-weight:800;color:var(--success-green);">RM ${formatNumber(domino.total_savings)}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">🚚 Logistics Optimization</div>
        <div class="kpi-label">Transportation</div>
        <div class="muted">${escapeHtml(logistics.transportation)}</div><br/>
        <div class="kpi-label">Materials</div>
        <div class="muted">${escapeHtml(logistics.materials)}</div><br/>
        <div class="kpi-label">Manpower</div>
        <div class="muted">${escapeHtml(logistics.manpower)}</div>
      </div>
    </div>
  `;
}
