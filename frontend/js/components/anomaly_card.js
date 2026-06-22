const SEVERITY_ICON = { critical: "⚠️", high: "⚠️", medium: "⚠️", low: "ℹ️" };

function anomalyCardHtml(a) {
  const diagnostics = (a.diagnostics || [])
    .map((d) => `<li>${escapeHtml(d)}</li>`)
    .join("");

  const actions = [];
  if (a.status === "pending") {
    actions.push(`<button class="btn btn-sm btn-danger" data-action="acknowledge" data-id="${a.id}">Acknowledge</button>`);
  }
  if (a.status !== "resolved") {
    actions.push(`<button class="btn btn-sm btn-success" data-action="resolve" data-id="${a.id}">Mark Resolved</button>`);
  }

  return `
    <div class="card anomaly-card severity-${a.severity}">
      <div class="anomaly-header">
        <span class="badge badge-${a.severity}">${SEVERITY_ICON[a.severity] || ""} ${a.severity}</span>
        <span class="badge badge-${a.status}">${a.status}</span>
        <span class="anomaly-title">${escapeHtml(a.floor)}${a.room ? " - Room " + escapeHtml(a.room) : ""}</span>
      </div>
      <div class="anomaly-message">${escapeHtml(a.message)}</div>
      ${
        a.normal_value != null
          ? `<div class="anomaly-values">Normal: ${a.normal_value} &nbsp;→&nbsp; Actual: ${a.actual_value}</div>`
          : ""
      }
      ${
        diagnostics
          ? `<div class="anomaly-diagnostics"><strong>🔍 Automated Diagnostics:</strong><ul>${diagnostics}</ul></div>`
          : ""
      }
      <div class="anomaly-actions">${actions.join("")}</div>
    </div>
  `;
}
