const API_BASE_URL = "http://127.0.0.1:5000/api";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch (e) {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

const api = {
  health: () => apiRequest("/health"),

  resources: {
    list: (params = {}) => apiRequest(`/resources?${new URLSearchParams(params)}`),
    summary: () => apiRequest("/resources/summary"),
    trend: (days = 7, resourceType = "electricity") =>
      apiRequest(`/resources/trend?days=${days}&resource_type=${resourceType}`),
    byFloor: (resourceType = "electricity") => apiRequest(`/resources/by-floor?resource_type=${resourceType}`),
  },

  bookings: {
    list: (params = {}) => apiRequest(`/bookings?${new URLSearchParams(params)}`),
    create: (data) => apiRequest("/bookings", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id, status) =>
      apiRequest(`/bookings/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  },

  anomalies: {
    list: (params = {}) => apiRequest(`/anomalies?${new URLSearchParams(params)}`),
    summary: () => apiRequest("/anomalies/summary"),
    updateStatus: (id, status) =>
      apiRequest(`/anomalies/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
    detect: () => apiRequest("/anomalies/detect"),
  },

  recommendations: {
    list: (params = {}) => apiRequest(`/recommendations?${new URLSearchParams(params)}`),
    summary: () => apiRequest("/recommendations/summary"),
    implement: (id) => apiRequest(`/recommendations/${id}/implement`, { method: "PUT" }),
    generate: () => apiRequest("/recommendations/generate", { method: "POST" }),
  },

  kpi: {
    current: () => apiRequest("/kpi/current"),
    history: (months = 6) => apiRequest(`/kpi/history?months=${months}`),
    leaderboard: () => apiRequest("/kpi/leaderboard"),
  },

  forecast: {
    nextMonth: () => apiRequest("/forecast/next-month"),
    trend: (days = 30) => apiRequest(`/forecast/trend?days=${days}`),
  },

  scheduler: {
    consolidation: () => apiRequest("/scheduler/consolidation"),
    dominoEffect: (primarySavings) => apiRequest(`/scheduler/domino-effect?primary_savings=${primarySavings}`),
    logistics: () => apiRequest("/scheduler/logistics"),
  },

  simulation: {
    generate: (query) => apiRequest("/simulation/generate", { method: "POST", body: JSON.stringify({ query }) }),
  },
};
