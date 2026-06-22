const CHART_COLORS = {
  primary: "#1A365D",
  secondary: "#2B6CB0",
  accent: "#4299E1",
  light: "#EBF8FF",
  success: "#38A169",
  warning: "#D69E2E",
  danger: "#E53E3E",
};

const chartInstances = {};

function disposeChart(elId) {
  if (chartInstances[elId]) {
    chartInstances[elId].dispose();
    delete chartInstances[elId];
  }
}

function getChart(elId) {
  disposeChart(elId);
  const el = document.getElementById(elId);
  if (!el) return null;
  const chart = echarts.init(el);
  chartInstances[elId] = chart;
  window.addEventListener("resize", () => chart.resize());
  return chart;
}

function renderLineChart(elId, xData, series, opts = {}) {
  const chart = getChart(elId);
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "category", data: xData, axisLine: { lineStyle: { color: "#CBD5E0" } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#EDF2F7" } } },
    series: series.map((s, i) => ({
      name: s.name,
      type: "line",
      data: s.data,
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { width: 2, color: s.color || CHART_COLORS.secondary },
      itemStyle: { color: s.color || CHART_COLORS.secondary },
      areaStyle: s.area
        ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: (s.color || CHART_COLORS.accent) + "55" },
              { offset: 1, color: (s.color || CHART_COLORS.accent) + "05" },
            ]),
          }
        : undefined,
      yAxisIndex: s.yAxisIndex || 0,
    })),
    legend: series.length > 1 ? { bottom: 0, textStyle: { fontSize: 11 } } : undefined,
    ...opts,
  });
  return chart;
}

function _hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function _interpolateColor(hexA, hexB, ratio) {
  const a = _hexToRgb(hexA);
  const b = _hexToRgb(hexB);
  const rgb = a.map((channel, i) => Math.round(channel + (b[i] - channel) * ratio));
  return `rgb(${rgb.join(",")})`;
}

function renderBarChart(elId, xData, data, opts = {}) {
  const chart = getChart(elId);
  if (!chart) return;
  const minVal = Math.min(...data, 0);
  const maxVal = Math.max(...data, 1);
  const range = maxVal - minVal || 1;
  chart.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "category", data: xData, axisLine: { lineStyle: { color: "#CBD5E0" } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#EDF2F7" } } },
    series: [
      {
        type: "bar",
        data: data,
        barWidth: "55%",
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: (params) => {
            const ratio = (data[params.dataIndex] - minVal) / range;
            return _interpolateColor(CHART_COLORS.light, CHART_COLORS.primary, ratio);
          },
        },
      },
    ],
    ...opts,
  });
  return chart;
}

function renderPieChart(elId, data, opts = {}) {
  const chart = getChart(elId);
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    color: [CHART_COLORS.secondary, CHART_COLORS.light, CHART_COLORS.accent, CHART_COLORS.warning],
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { formatter: "{b}\n{d}%", fontSize: 11 },
        data,
      },
    ],
    ...opts,
  });
  return chart;
}

function renderRadarChart(elId, indicators, data, opts = {}) {
  const chart = getChart(elId);
  if (!chart) return;
  chart.setOption({
    tooltip: {},
    radar: {
      indicator: indicators,
      shape: "polygon",
      splitArea: { areaStyle: { color: ["#fff", "#F7FAFC"] } },
      axisLine: { lineStyle: { color: "#CBD5E0" } },
      splitLine: { lineStyle: { color: "#E2E8F0" } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: data,
            name: "Sustainability Score",
            areaStyle: { color: CHART_COLORS.accent + "44" },
            lineStyle: { color: CHART_COLORS.secondary, width: 2 },
            itemStyle: { color: CHART_COLORS.secondary },
          },
        ],
      },
    ],
    ...opts,
  });
  return chart;
}

function renderForecastAreaChart(elId, points) {
  const chart = getChart(elId);
  if (!chart) return;
  const dates = points.map((p) => p.date.slice(5));
  chart.setOption({
    tooltip: { trigger: "axis" },
    grid: { left: 55, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "category", data: dates, axisLine: { lineStyle: { color: "#CBD5E0" } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#EDF2F7" } } },
    series: [
      {
        name: "Confidence band",
        type: "line",
        data: points.map((p) => p.high),
        lineStyle: { opacity: 0 },
        stack: "confidence-band",
        symbol: "none",
        areaStyle: { color: CHART_COLORS.accent + "33" },
      },
      {
        name: "Confidence low",
        type: "line",
        data: points.map((p) => -(p.high - p.low)),
        lineStyle: { opacity: 0 },
        stack: "confidence-band",
        symbol: "none",
        areaStyle: { color: "#fff" },
      },
      {
        name: "Estimated usage",
        type: "line",
        data: points.map((p) => p.estimated),
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, color: CHART_COLORS.primary },
      },
    ],
    legend: { show: false },
  });
  return chart;
}

function renderGaugeChart(elId, score) {
  const chart = getChart(elId);
  if (!chart) return;
  chart.setOption({
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        progress: { show: true, width: 14, itemStyle: { color: CHART_COLORS.secondary } },
        axisLine: { lineStyle: { width: 14, color: [[1, "#EDF2F7"]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 36,
          fontWeight: 800,
          color: CHART_COLORS.primary,
          offsetCenter: [0, "0%"],
        },
        data: [{ value: score }],
      },
    ],
  });
  return chart;
}
