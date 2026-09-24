/**
 * Agribusiness BI Dashboard — Frontend JS
 * Fetches data from Flask API endpoints and renders Chart.js charts.
 */

"use strict";

// ── Colour palette ────────────────────────────────────────────────────────────
const CROP_COLORS = {
  "Arhar/Tur":    "#f97316",
  "Bajra":        "#a3e635",
  "Cotton(Lint)": "#f43f5e",
  "Groundnut":    "#fb923c",
  "Jowar":        "#86efac",
  "Maize":        "#fbbf24",
  "Rice":         "#38bdf8",
  "Soyabean":     "#c084fc",
  "Sugarcane":    "#4ade80",
  "Wheat":        "#facc15",
};

const C = {
  accent:  "#58a6ff",
  green:   "#3fb950",
  amber:   "#d29922",
  red:     "#f85149",
  purple:  "#bc8cff",
  muted:   "#8b949e",
  text:    "#e6edf3",
  grid:    "rgba(48,54,61,0.55)",
  surface: "#161b22",
  card:    "#1c2230",
};

// ── Shared Chart.js base options ──────────────────────────────────────────────
const BASE = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 350 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(22,27,34,0.96)",
      borderColor: "#30363d",
      borderWidth: 1,
      titleColor: C.text,
      bodyColor: C.muted,
      cornerRadius: 6,
      padding: 8,
    },
  },
};

const TICK_STYLE = { color: C.muted, font: { size: 9 } };
const GRID_STYLE = { color: C.grid };

// ── Chart registry ────────────────────────────────────────────────────────────
const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function makeChart(id, config) {
  destroyChart(id);
  charts[id] = new Chart(document.getElementById(id).getContext("2d"), config);
}

// ── Filters state ─────────────────────────────────────────────────────────────
function getParams() {
  const p = new URLSearchParams();
  const add = (id, key) => { const v = document.getElementById(id).value; if (v) p.set(key, v); };
  add("fYear",     "year");
  add("fState",    "state");
  add("fDistrict", "district");
  add("fCrop",     "crop");
  add("fSeason",   "season");
  return p.toString() ? "?" + p.toString() : "";
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json();
}

// ── Populate filter dropdowns ─────────────────────────────────────────────────
async function populateFilters() {
  const data = await fetchJSON("/api/filters");

  const fill = (id, items) => {
    const sel = document.getElementById(id);
    items.forEach(v => {
      const o = document.createElement("option");
      o.value = o.textContent = v;
      sel.appendChild(o);
    });
  };

  fill("fYear",    data.years);
  fill("fState",   data.states);
  fill("fDistrict", data.districts);
  fill("fCrop",    data.crops);
  fill("fSeason",  data.seasons);
}

// State → district cascade
async function refreshDistricts() {
  const state = document.getElementById("fState").value;
  const sel = document.getElementById("fDistrict");
  const cur = sel.value;
  sel.innerHTML = "<option value=''>All Districts</option>";
  const url = state ? `/api/districts?state=${encodeURIComponent(state)}` : "/api/districts";
  const districts = await fetchJSON(url);
  districts.forEach(v => {
    const o = document.createElement("option");
    o.value = o.textContent = v;
    sel.appendChild(o);
  });
  if (districts.includes(cur)) sel.value = cur;
}

// ── KPI update ────────────────────────────────────────────────────────────────
async function updateKPIs(qs) {
  const d = await fetchJSON("/api/kpis" + qs);
  document.getElementById("kpiProd").textContent  = d.total_production;
  document.getElementById("kpiArea").textContent  = d.cultivated_area;
  document.getElementById("kpiYield").textContent = d.avg_yield + " t/ha";
  document.getElementById("kpiRain").textContent  = d.avg_rainfall;
  document.getElementById("kpiEff").textContent   = d.efficiency_gaps;
  document.getElementById("recCount").textContent = d.record_count.toLocaleString();
  document.getElementById("hdrProd").textContent  = d.total_production + "t";

  const yoyEl = document.getElementById("kpiYoY");
  yoyEl.textContent = d.yoy_yield;
  yoyEl.style.color = d.yoy_positive === "true" ? C.green : d.yoy_positive === "false" ? C.red : C.muted;

  const riskEl = document.getElementById("kpiRisk");
  riskEl.textContent = d.climate_risk;
  riskEl.style.color = d.risk_level === "high" ? C.red : d.risk_level === "mid" ? C.amber : C.green;
  document.getElementById("kpiRiskSub").textContent =
    d.risk_label !== "—" ? "Highest: " + d.risk_label : "Yield volatility";
}

// ── Trend Chart ───────────────────────────────────────────────────────────────
async function buildTrend(qs) {
  const d = await fetchJSON("/api/trend" + qs);
  makeChart("cTrend", {
    type: "line",
    data: {
      labels: d.years,
      datasets: [
        {
          label: "Production (×1K t)",
          data: d.production,
          borderColor: C.accent,
          backgroundColor: "rgba(88,166,255,0.07)",
          tension: 0.35, yAxisID: "y",
          pointRadius: 3, borderWidth: 2,
        },
        {
          label: "Avg Yield (t/ha)",
          data: d.yield,
          borderColor: C.green,
          backgroundColor: "rgba(63,185,80,0.05)",
          tension: 0.35, yAxisID: "y2",
          pointRadius: 3, borderWidth: 2, borderDash: [4, 2],
        },
        {
          label: "Rainfall ÷10",
          data: d.rainfall,
          borderColor: C.amber,
          backgroundColor: "rgba(210,153,34,0.04)",
          tension: 0.35, yAxisID: "y2",
          pointRadius: 2, borderWidth: 1.5, borderDash: [2, 3],
        },
      ],
    },
    options: {
      ...BASE,
      plugins: {
        ...BASE.plugins,
        legend: {
          display: true,
          labels: { color: C.muted, font: { size: 9 }, boxWidth: 8, padding: 10 },
        },
      },
      scales: {
        x:  { ticks: TICK_STYLE, grid: GRID_STYLE },
        y:  { position: "left",  ticks: { ...TICK_STYLE, callback: v => v + "K" }, grid: GRID_STYLE,
              title: { display: true, text: "Production (×1K t)", color: C.muted, font: { size: 8 } } },
        y2: { position: "right", ticks: TICK_STYLE, grid: { display: false },
              title: { display: true, text: "Yield / Rainfall÷10", color: C.muted, font: { size: 8 } } },
      },
    },
  });
}

// ── Crop Bar ──────────────────────────────────────────────────────────────────
async function buildCropBar(qs) {
  const d = await fetchJSON("/api/crop_performance" + qs);
  makeChart("cCrop", {
    type: "bar",
    data: {
      labels: d.crops,
      datasets: [{
        label: "Avg Yield",
        data: d.yields,
        backgroundColor: d.crops.map(c => CROP_COLORS[c] || C.accent),
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      ...BASE,
      indexAxis: "y",
      scales: {
        x: { ticks: { ...TICK_STYLE, font: { size: 8 } }, grid: GRID_STYLE },
        y: { ticks: { ...TICK_STYLE, font: { size: 8 } }, grid: { display: false } },
      },
    },
  });
}

// ── State Bar ─────────────────────────────────────────────────────────────────
async function buildStateBar(qs) {
  const d = await fetchJSON("/api/state_performance" + qs);
  const barColors = d.yields.map(v => v >= d.mean ? C.green : C.red);
  makeChart("cState", {
    type: "bar",
    data: {
      labels: d.states.map(s => s.replace(" Pradesh", "").replace("Maharashtra", "Mahar.")),
      datasets: [{
        label: "Avg Yield",
        data: d.yields,
        backgroundColor: barColors,
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      ...BASE,
      indexAxis: "y",
      scales: {
        x: {
          ticks: { ...TICK_STYLE, font: { size: 8 } }, grid: GRID_STYLE,
        },
        y: { ticks: { ...TICK_STYLE, font: { size: 8 } }, grid: { display: false } },
      },
      plugins: {
        ...BASE.plugins,
        annotation: {
          annotations: {
            avgLine: {
              type: "line",
              xMin: d.mean, xMax: d.mean,
              borderColor: C.amber,
              borderWidth: 1.5,
              borderDash: [3, 3],
              label: { content: "Mean", display: true, color: C.amber, font: { size: 8 } },
            },
          },
        },
      },
    },
  });
}

// ── Scatter ───────────────────────────────────────────────────────────────────
async function buildScatter(qs) {
  const rows = await fetchJSON("/api/scatter" + qs);

  // Group by crop
  const groups = {};
  rows.forEach(r => {
    if (!groups[r.crop]) groups[r.crop] = [];
    groups[r.crop].push({ x: r.rf, y: r.y });
  });

  const datasets = Object.entries(groups).map(([crop, pts]) => ({
    label: crop,
    data: pts,
    backgroundColor: (CROP_COLORS[crop] || C.accent) + "99",
    pointRadius: 2.5,
    pointHoverRadius: 4,
  }));

  makeChart("cScatter", {
    type: "scatter",
    data: { datasets },
    options: {
      ...BASE,
      plugins: {
        ...BASE.plugins,
        legend: {
          display: true,
          labels: { color: C.muted, font: { size: 8 }, boxWidth: 6, padding: 6 },
        },
      },
      scales: {
        x: {
          ticks: { ...TICK_STYLE, font: { size: 8 } }, grid: GRID_STYLE,
          title: { display: true, text: "Annual Rainfall (mm)", color: C.muted, font: { size: 8 } },
        },
        y: {
          ticks: { ...TICK_STYLE, font: { size: 8 } }, grid: GRID_STYLE,
          title: { display: true, text: "Yield (t/ha)", color: C.muted, font: { size: 8 } },
        },
      },
    },
  });
}

// ── Heatmap (HTML table) ──────────────────────────────────────────────────────
async function buildHeatmap(qs) {
  const d = await fetchJSON("/api/heatmap" + qs);

  function heatBg(norm) {
    if (norm > 0.66) return `hsl(${120 + norm * 20},55%,${22 + norm * 14}%)`;
    if (norm > 0.33) return `hsl(45,60%,25%)`;
    return `hsl(${norm * 20},55%,${18 + norm * 7}%)`;
  }
  function heatFg(norm) {
    return norm > 0.5 ? "#d1fae5" : norm > 0.25 ? "#fef3c7" : "#fecaca";
  }

  const shortCrop = c => c.replace("Cotton(Lint)", "Cotton")
    .replace("Arhar/Tur", "Arhar").replace("Groundnut", "Gnut")
    .replace("Sugarcane", "Scane").replace("Soyabean", "Soya");
  const shortState = s => s.replace(" Pradesh", "").replace("Maharashtra", "Mahar.").replace("West Bengal", "W.Bengal");

  let html = `<table class="hm-table"><thead><tr><th class="row-h">State</th>`;
  d.crops.forEach(c => { html += `<th title="${c}">${shortCrop(c)}</th>`; });
  html += `</tr></thead><tbody>`;

  d.states.forEach((st, si) => {
    html += `<tr><td class="st-cell">${shortState(st)}</td>`;
    d.crops.forEach((cr, ci) => {
      const v    = d.values[si][ci];
      const norm = d.normed[si][ci];
      const bg   = v > 0 ? heatBg(norm) : C.card;
      const fg   = v > 0 ? heatFg(norm) : C.muted;
      html += `<td style="background:${bg};color:${fg}" title="${st} · ${cr}: ${v > 0 ? v.toFixed(2) : "N/A"} t/ha">${v > 0 ? v.toFixed(2) : "—"}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  document.getElementById("hmContainer").innerHTML = html;
}

// ── Risk Chart ────────────────────────────────────────────────────────────────
async function buildRisk(qs) {
  const d = await fetchJSON("/api/risk" + qs);
  const barColors = d.values.map(v => v > 0.22 ? C.red : v > 0.18 ? C.amber : C.green);

  makeChart("cRisk", {
    type: "bar",
    data: {
      labels: d.labels,
      datasets: [{
        label: "CV",
        data: d.values,
        backgroundColor: barColors,
        borderRadius: 3,
      }],
    },
    options: {
      ...BASE,
      indexAxis: "y",
      scales: {
        x: { ticks: { ...TICK_STYLE, font: { size: 8 } }, grid: GRID_STYLE, max: 0.32 },
        y: { ticks: { ...TICK_STYLE, font: { size: 7.5 } }, grid: { display: false } },
      },
    },
  });
}

// ── Master update: call all endpoints in parallel ─────────────────────────────
async function update() {
  const qs = getParams();
  await Promise.all([
    updateKPIs(qs),
    buildTrend(qs),
    buildCropBar(qs),
    buildStateBar(qs),
    buildScatter(qs),
    buildHeatmap(qs),
    buildRisk(qs),
  ]);
}

// ── Event listeners ───────────────────────────────────────────────────────────
function attachListeners() {
  ["fYear", "fCrop", "fSeason", "fDistrict"].forEach(id => {
    document.getElementById(id).addEventListener("change", update);
  });

  document.getElementById("fState").addEventListener("change", async () => {
    await refreshDistricts();
    update();
  });

  document.getElementById("btnReset").addEventListener("click", async () => {
    ["fYear", "fState", "fDistrict", "fCrop", "fSeason"].forEach(id => {
      document.getElementById(id).value = "";
    });
    await refreshDistricts();
    update();
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const prog = document.getElementById("ldProg");
  prog.style.width = "30%";

  await populateFilters();
  prog.style.width = "60%";

  attachListeners();
  await update();
  prog.style.width = "100%";

  setTimeout(() => {
    document.getElementById("loading").style.display   = "none";
    document.getElementById("mainDash").style.display  = "grid";
  }, 300);
});
