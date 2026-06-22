const TOTAL_ROOMS = 20;

async function renderDashboardPage(container) {
  const [summary, trend, byFloor, bookingsToday, anomalies] = await Promise.all([
    api.resources.summary(),
    api.resources.trend(7, "electricity"),
    api.resources.byFloor("electricity"),
    api.bookings.list(),
    api.anomalies.list({ limit: 3 }),
  ]);

  const elec = summary.electricity || { value: 0, trend_pct: 0, cost: 0 };
  const water = summary.water || { value: 0, trend_pct: 0, cost: 0 };
  const totalCost = elec.cost + water.cost;
  const costTrend = (elec.trend_pct + water.trend_pct) / 2;
  const carbonTons = (elec.value * 0.0007).toFixed(2);

  const activeRooms = new Set(
    bookingsToday
      .filter((b) => b.status === "booked")
      .map((b) => b.room_name)
  ).size;
  const occupancyPct = Math.min(100, Math.round((activeRooms / TOTAL_ROOMS) * 100));

  container.innerHTML = `
    <div class="grid grid-5">
      ${kpiCardHtml({ icon: "⚡", label: "Energy", value: `${formatNumber(elec.value)} kWh`, trendPct: elec.trend_pct })}
      ${kpiCardHtml({ icon: "💧", label: "Water", value: `${formatNumber(water.value)} L`, trendPct: water.trend_pct })}
      ${kpiCardHtml({ icon: "👥", label: "Occupancy", value: `${occupancyPct}%`, trendPct: 5 })}
      ${kpiCardHtml({ icon: "🌍", label: "Carbon", value: `${carbonTons} tCO₂`, trendPct: elec.trend_pct })}
      ${kpiCardHtml({ icon: "💰", label: "Cost", value: `RM ${formatNumber(totalCost)}`, trendPct: costTrend })}
    </div>

    <div class="section-title">Energy Consumption Trend (Last 7 Days)</div>
    <div class="card chart-card">
      <div class="chart-container" id="chart-energy-trend"></div>
    </div>

    <div class="grid grid-2" style="margin-top:18px;">
      <div>
        <div class="section-title">Usage by Floor</div>
        <div class="card chart-card">
          <div class="chart-container" id="chart-usage-floor"></div>
        </div>
      </div>
      <div>
        <div class="section-title">Room Utilization</div>
        <div class="card chart-card">
          <div class="chart-container" id="chart-room-utilization"></div>
        </div>
      </div>
    </div>

    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>Recent Anomalies</span>
      <a href="#anomalies" class="btn btn-secondary btn-sm">View All</a>
    </div>
    <div id="recent-anomalies">
      ${
        anomalies.length
          ? anomalies.map(anomalyCardHtml).join("")
          : '<div class="empty-state">No anomalies detected.</div>'
      }
    </div>
  `;

  renderLineChart(
    "chart-energy-trend",
    trend.map((d) => d.date.slice(5)),
    [{ name: "Electricity (kWh)", data: trend.map((d) => d.value), color: CHART_COLORS.secondary, area: true }]
  );

  renderBarChart(
    "chart-usage-floor",
    byFloor.map((d) => d.floor.replace("Floor ", "F")),
    byFloor.map((d) => d.value)
  );

  renderPieChart("chart-room-utilization", [
    { name: "Occupied", value: activeRooms },
    { name: "Available", value: Math.max(0, TOTAL_ROOMS - activeRooms) },
  ]);

  container.querySelectorAll('[data-action="acknowledge"], [data-action="resolve"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const status = btn.dataset.action === "acknowledge" ? "acknowledged" : "resolved";
      await api.anomalies.updateStatus(btn.dataset.id, status);
      renderDashboardPage(container);
    });
  });
}
