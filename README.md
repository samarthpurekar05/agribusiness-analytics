# 🌾 AI & Data Analytics for Agribusiness

**Student:** Samarth Purekar  
**Course:** AI & Data Analytics  
**Platform:** IBM Project Submission  

---

## 📋 Project Description

A complete **decision-support Business Intelligence analysis** of Indian agricultural productivity data covering **14 states, 10 crops, 4 seasons, and 11 years (2005–2015)**.

The project delivers four analysis stages:

| Stage | Focus | Output |
|-------|-------|--------|
| **EDA** | Data quality, distributions, yield rankings, trend analysis, rainfall–yield correlations | Descriptive statistics, ranked tables, trend charts |
| **Executive KPIs** | 7 headline KPIs with business rationale | KPI definitions + Cognos chart specifications |
| **Climate Risk** | Yield volatility (CV) + rainfall–yield change correlation | 19 high-risk state×crop pairs identified |
| **Efficiency Gaps** | High-area, below-average-yield opportunities | 30 state×crop efficiency gap cells, top 3 priority actions |

**Key findings:**
- 📊 Total production: **21.1 M tonnes** (2005–2015)
- 🏆 Best state (grain): **Bihar 2.03 t/ha** | Worst: **Haryana 1.55 t/ha** — 24% gap
- ⚡ Highest climate risk: **UP Sugarcane** — rainfall–yield change correlation r = **0.937**
- 🔴 Most volatile: **Assam Soyabean** — CV = **0.269** (26.9% annual swing)
- 🟢 Biggest efficiency gap: **Bihar Jowar** — 10.4% below crop-mean yield despite above-average area

---

## 📁 Dataset

**File:** `cleaned_crop_rainfall_data.csv`  
**Records:** 2,953 rows · 0 null values  
**Columns:** `State_Name`, `District_Name`, `Crop_Year`, `Season`, `Crop`, `Area`, `Production`, `Annual_Rainfall_mm`, `Yield`  
**Coverage:** 14 Indian states · 10 crops · 4 seasons · 2005–2015  

> Place the dataset in the same directory as `app.py`, or update the data path inside `app.py` if you move it.

---

## 🗂️ Project File Manifest
agri_app/
├── cleaned_crop_rainfall_data.csv ← Source dataset
├── app.py ← Flask backend: serves dashboard + REST API endpoints
├── agri_dashboard.html ← Frontend template, rendered/served by app.py
├── Samarth_Purekar_AgriAnalytics.ipynb ← Jupyter Notebook (main analysis)
├── requirements.txt ← Python dependencies
├── Samarth_Purekar_ProjectReport.docx ← Full project report (11 sections, 7 tables)
└── README.md ← This file


---

## 🛠️ Technologies Used

| Category | Technology |
|----------|-----------|
| Language | Python 3.10+ |
| Backend / Web Server | Flask 3.0 |
| Data Manipulation | pandas 2.0, numpy 1.24 |
| Visualisation (notebook) | matplotlib 3.7, seaborn 0.12 |
| Statistical Analysis | scipy 1.10 (Pearson r, linregress) |
| Notebook Runtime | Jupyter Notebook 7.0 |
| Dashboard Frontend | HTML5, CSS3 Grid, JavaScript ES2020, Chart.js 4.4 |
| Report | Microsoft Word (.docx) |

---

## ⚙️ Setup & Run Instructions

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

Minimum Python version: **3.9**

### 2. Run the Jupyter Notebook (EDA & offline analysis)

```bash
jupyter notebook Samarth_Purekar_AgriAnalytics.ipynb
```

Then run all cells: **Kernel → Restart & Run All**

The notebook will:
- Load the CSV dataset
- Run all 6 analysis stages
- Generate 9 chart PNG files in the current directory
- Print all findings to cell outputs

### 3. Run the Interactive Dashboard

The dashboard is served by a Flask backend — it requires a running server, it does **not** open as a standalone file.

```bash
cd agri_app
python app.py
```

Then open your browser to: http://127.0.0.1:5000/


`app.py` loads the dataset, computes KPIs/statistics server-side, and exposes them through REST API endpoints that `agri_dashboard.html` calls to render charts and filters live.

To stop the server, close the terminal or interrupt the running process (e.g. `Ctrl+C`, or on Windows `Stop-Process -Id <process_id>`).

### 4. Dashboard Interactions

| Filter | Effect |
|--------|--------|
| Year | Filters all 6 charts + 7 KPI cards to selected year |
| State | Narrows District dropdown via `GET /api/districts?state=X`; updates all charts |
| District | Drill-down within a state |
| Crop | Crop bar switches to single crop; scatter isolates crop; heatmap/risk recompute |
| Season | Filters to Kharif / Rabi / Autumn / Whole Year |
| ↺ Reset | Clears all filters back to full dataset |

---

## 📊 Dashboard Features

**One-screen 16:9 layout:**
HEADER: Title · Record Count · Total Production │
├──────────────────────────────────────────────────────┤
│ FILTERS: Year | State | District | Crop | Season │
├──────────────────────────────────────────────────────┤
│ KPIs: Prod | Area | Yield | YoY | Rainfall | Risk | Gaps │
├────────────────────────┬─────────────┬───────────────┤
│ Production & Yield │ Crop Perf. │ State Perf. │
│ Trend (dual-axis) │ Horiz. Bar │ Horiz. Bar │
├──────────┬─────────────┴──────┬──────┴───────────────┤
│ Rainfall │ State × Crop │ Climate Risk │
│ vs Yield │ Heatmap │ Volatility (CV) │
│ Scatter │ (per-col norm.) │ Bar Chart │
├──────────┴────────────────────┴──────────────────────┤
│ 🔴 Major Risks │ 🟢 Opportunities │ 🎯 Actions │


**API Endpoints (served by `app.py`):**

| Endpoint | Returns |
|---|---|
| `GET /api/scatter` | Rainfall vs Yield points by crop |
| `GET /api/heatmap` | State × Crop yield matrix (normalised) |
| `GET /api/risk` | Top-12 CV values for volatility chart |
| `GET /api/districts?state=X` | Cascading district filter |

All endpoints accept `?year=&state=&district=&crop=&season=` query parameters.

---

## ⚠️ Key Analytical Notes

1. **Never average Yield across crops** — Sugarcane averages 69.71 t/ha vs grain crops at 0.97–2.92 t/ha. All yield comparisons are performed within a single crop.
2. **Aggregate rainfall–yield r is weak** (0.04–0.12) — this is expected at state/annual level. Year-over-year change correlations reveal much stronger climate signals.
3. **Correlation ≠ causation** — all climate risk associations require validation with field-level data (irrigation, inputs, pest pressure) before policy action.
4. **Dataset limitations** — state-level rainfall, no irrigation data, 10 crops and 5 districts per state. Results are directional, not exhaustive.

---

## 📌 Top 3 Actionable Recommendations

| Priority | State + Crop | Finding | Action |
|----------|-------------|---------|--------|
| 1 | **Bihar · Jowar** | 10.4% yield gap, 1,114 ha avg area | HYV seeds (CSH-16) + FPO demos |
| 2 | **UP · Sugarcane** | r=0.937 climate coupling | Parametric weather insurance |
| 3 | **Karnataka · Cotton** | 9.4% gap; TN achieves +20% same RF | Tech transfer from Tamil Nadu |

---

*Samarth Purekar · AI & Data Analytics for Agribusiness · IBM Project*