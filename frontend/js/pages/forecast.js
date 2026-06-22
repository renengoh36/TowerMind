async function renderForecastPage(container) {
  const [forecast, trend] = await Promise.all([api.forecast.nextMonth(), api.forecast.trend(30)]);

  const growthUp = forecast.growth_percentage >= 0;

  container.innerHTML = `
    ${
      forecast.budget_risk
        ? `<div class="alert-banner danger">⚠️ Budget Risk: ${escapeHtml(forecast.budget_risk_message || "Forecast exceeds budget threshold")} &nbsp;
            <a href="#scheduler" class="btn btn-sm btn-secondary" style="margin-left:auto;">Adjust Parameters</a>
          </div>`
        : ""
    }

    <div class="grid grid-2">
      <div class="card">
        <div class="section-title" style="margin-top:0;">Financial Forecast</div>
        <div class="kpi-label">💰 Next Month Projected</div>
        <div class="hero-sub-value" style="font-size:28px;">RM ${formatNumber(forecast.projected_cost)}</div>
        <br/>
        <div class="kpi-trend ${growthUp ? "up" : "down"}">📈 Month-over-Month: ${growthUp ? "▲" : "▼"} ${Math.abs(forecast.growth_percentage)}%</div>
        <br/><br/>
        <div class="muted">📊 Quarter-to-Date: RM ${formatNumber(forecast.quarter_to_date)}
          ${forecast.budget_delta > 0 ? `(RM ${formatNumber(forecast.budget_delta)} over budget)` : "(within budget)"}
        </div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">🤖 AI Driver Analysis</div>
        <div class="kpi-label">Primary Drivers</div>
        <ul class="muted" style="padding-left:18px;">
          ${forecast.drivers.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}
        </ul>
        <br/>
        <div class="kpi-trend up">Confidence Score: ${forecast.confidence}%</div>
      </div>
    </div>

    <div class="section-title">30-Day Forecast Trend</div>
    <div class="card chart-card">
      <div class="chart-container lg" id="chart-forecast-trend"></div>
    </div>
  `;

  renderForecastAreaChart("chart-forecast-trend", trend);
}
