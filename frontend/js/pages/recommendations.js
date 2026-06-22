let recommendationCategory = "all";

async function renderRecommendationsPage(container) {
  const [summary, recommendations] = await Promise.all([
    api.recommendations.summary(),
    api.recommendations.list({ category: recommendationCategory }),
  ]);

  const categories = ["all", "electricity", "water", "space", "manpower", "materials"];

  container.innerHTML = `
    <div class="card" style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <div class="kpi-label">Total Potential Savings</div>
        <div class="hero-sub-value" style="font-size:30px;">RM ${formatNumber(summary.total_potential_savings)}/month</div>
      </div>
      <button class="btn" id="generate-rec-btn">⚙️ Generate New Recommendations</button>
    </div>

    <div class="filter-bar">
      ${categories
        .map((c) => `<span class="filter-chip cat-chip ${recommendationCategory === c ? "active" : ""}" data-category="${c}">${c}</span>`)
        .join("")}
    </div>

    <div id="rec-list">
      ${recommendations.length ? recommendations.map(recommendationCardHtml).join("") : '<div class="empty-state">No recommendations in this category yet.</div>'}
    </div>
  `;

  container.querySelectorAll(".cat-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      recommendationCategory = chip.dataset.category;
      renderRecommendationsPage(container);
    });
  });

  container.querySelectorAll('[data-action="implement"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.recommendations.implement(btn.dataset.id);
      renderRecommendationsPage(container);
    });
  });

  document.getElementById("generate-rec-btn").addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Generating...";
    try {
      await api.recommendations.generate();
    } finally {
      renderRecommendationsPage(container);
    }
  });
}
