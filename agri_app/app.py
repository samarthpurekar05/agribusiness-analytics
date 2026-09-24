"""
Agribusiness BI Dashboard — Flask Backend
==========================================
Endpoints
---------
GET  /                      → serve dashboard HTML
GET  /api/filters           → all unique filter values
GET  /api/kpis              → 7 KPI cards (accepts filter query params)
GET  /api/trend             → production + yield + rainfall by year
GET  /api/crop_performance  → avg yield per crop
GET  /api/state_performance → avg yield per state
GET  /api/scatter           → rainfall vs yield points (sampled)
GET  /api/heatmap           → state × crop avg yield matrix
GET  /api/risk              → top-N yield volatility (CV) per state×crop
GET  /api/districts         → districts filtered by state (for cascading select)
"""

from flask import Flask, jsonify, render_template, request
import pandas as pd
import numpy as np
from scipy import stats
import os

app = Flask(__name__)

# ── Load & prepare data once at startup ──────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data.csv")

df = pd.read_csv(DATA_PATH)
df[["Area", "Production", "Annual_Rainfall_mm", "Yield"]] = (
    df[["Area", "Production", "Annual_Rainfall_mm", "Yield"]].astype(float)
)
df["Crop_Year"] = df["Crop_Year"].astype(int)

GRAIN_CROPS = [c for c in df["Crop"].unique() if c != "Sugarcane"]


# ── Shared filter helper ──────────────────────────────────────────────────────
def apply_filters(dataframe: pd.DataFrame) -> pd.DataFrame:
    year     = request.args.get("year")
    state    = request.args.get("state")
    district = request.args.get("district")
    crop     = request.args.get("crop")
    season   = request.args.get("season")

    if year:
        dataframe = dataframe[dataframe["Crop_Year"] == int(year)]
    if state:
        dataframe = dataframe[dataframe["State_Name"] == state]
    if district:
        dataframe = dataframe[dataframe["District_Name"] == district]
    if crop:
        dataframe = dataframe[dataframe["Crop"] == crop]
    if season:
        dataframe = dataframe[dataframe["Season"] == season]
    return dataframe


def fmt_num(n: float) -> str:
    """Compact human-readable number."""
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}K"
    return f"{n:.1f}"


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/filters")
def api_filters():
    """Return all unique values for every filter dropdown."""
    return jsonify({
        "years":    sorted(df["Crop_Year"].unique().tolist()),
        "states":   sorted(df["State_Name"].unique().tolist()),
        "districts": sorted(df["District_Name"].unique().tolist()),
        "crops":    sorted(df["Crop"].unique().tolist()),
        "seasons":  sorted(df["Season"].unique().tolist()),
    })


@app.route("/api/districts")
def api_districts():
    """Cascading: districts for a given state (or all if no state given)."""
    state = request.args.get("state")
    sub = df[df["State_Name"] == state] if state else df
    return jsonify(sorted(sub["District_Name"].unique().tolist()))


@app.route("/api/kpis")
def api_kpis():
    fdf = apply_filters(df)

    if fdf.empty:
        return jsonify({k: "—" for k in [
            "total_production", "cultivated_area", "avg_yield",
            "yoy_yield", "avg_rainfall", "climate_risk", "efficiency_gaps",
            "record_count", "risk_label"
        ]})

    grain = fdf[fdf["Crop"] != "Sugarcane"]
    total_prod = fdf["Production"].sum()
    total_area = fdf["Area"].sum()
    avg_yield  = grain["Yield"].mean() if not grain.empty else fdf["Yield"].mean()
    avg_rain   = fdf["Annual_Rainfall_mm"].mean()

    # YoY yield (last two years present in filtered data)
    years_in = sorted(fdf["Crop_Year"].unique())
    yoy_str = "—"
    yoy_pos = "null"   # "true" / "false" / "null" — safe for JSON
    if len(years_in) >= 2:
        last, prev = years_in[-1], years_in[-2]
        ly = fdf[fdf["Crop_Year"] == last]["Yield"].mean()
        py = fdf[fdf["Crop_Year"] == prev]["Yield"].mean()
        pct = (ly - py) / py * 100 if py else 0
        yoy_str = f"{pct:+.1f}%"
        yoy_pos = "true" if pct >= 0 else "false"

    # Climate risk — max CV across state×crop pairs in filtered data
    risk_val, risk_label = None, "—"
    grain_fdf = fdf[fdf["Crop"] != "Sugarcane"]
    cv_list = []
    for (st, cr), grp in grain_fdf.groupby(["State_Name", "Crop"]):
        yr_m = grp.groupby("Crop_Year")["Yield"].mean()
        if len(yr_m) >= 3 and yr_m.mean() > 0:
            cv = yr_m.std() / yr_m.mean()
            cv_list.append((f"{st[:8]}·{cr[:6]}", cv))
    if cv_list:
        cv_list.sort(key=lambda x: -x[1])
        risk_label, risk_val = cv_list[0]

    # Efficiency gaps count
    crop_mean_y = df.groupby("Crop")["Yield"].mean()
    crop_mean_a = df.groupby("Crop")["Area"].mean()
    gap_count = 0
    for (st, cr), grp in fdf.groupby(["State_Name", "Crop"]):
        if (grp["Area"].mean() > crop_mean_a.get(cr, 0) and
                grp["Yield"].mean() < crop_mean_y.get(cr, 0)):
            gap_count += 1

    return jsonify({
        "total_production": fmt_num(total_prod),
        "cultivated_area":  fmt_num(total_area),
        "avg_yield":        f"{avg_yield:.2f}",
        "yoy_yield":        yoy_str,
        "yoy_positive":     yoy_pos,          # string "true"/"false"/"null"
        "avg_rainfall":     f"{avg_rain:.0f} mm",
        "climate_risk":     f"{risk_val:.3f}" if risk_val else "\u2014",
        "risk_label":       risk_label,
        "risk_level":       "high" if (risk_val or 0) > 0.22 else "mid" if (risk_val or 0) > 0.15 else "low",
        "efficiency_gaps":  str(gap_count),
        "record_count":     int(len(fdf)),
    })


@app.route("/api/trend")
def api_trend():
    fdf = apply_filters(df)
    grain = fdf[fdf["Crop"] != "Sugarcane"]

    by_year = fdf.groupby("Crop_Year").agg(
        total_prod=("Production", "sum"),
        avg_rain=("Annual_Rainfall_mm", "mean"),
    ).reset_index()
    grain_yr = grain.groupby("Crop_Year")["Yield"].mean().reset_index()
    grain_yr.columns = ["Crop_Year", "avg_yield"]

    merged = by_year.merge(grain_yr, on="Crop_Year", how="left")
    merged = merged.sort_values("Crop_Year")

    return jsonify({
        "years":      merged["Crop_Year"].tolist(),
        "production": (merged["total_prod"] / 1000).round(1).tolist(),
        "yield":      merged["avg_yield"].round(3).tolist(),
        "rainfall":   (merged["avg_rain"] / 10).round(1).tolist(),
    })


@app.route("/api/crop_performance")
def api_crop_performance():
    fdf = apply_filters(df)
    # If no crop filter: exclude sugarcane from mixed view (scale issue)
    crop_filter = request.args.get("crop")
    if not crop_filter:
        fdf = fdf[fdf["Crop"] != "Sugarcane"]

    grp = (fdf.groupby("Crop")["Yield"].mean()
             .sort_values(ascending=True)
             .reset_index())
    return jsonify({
        "crops":  grp["Crop"].tolist(),
        "yields": grp["Yield"].round(3).tolist(),
    })


@app.route("/api/state_performance")
def api_state_performance():
    fdf = apply_filters(df)
    crop_filter = request.args.get("crop")
    if not crop_filter:
        fdf = fdf[fdf["Crop"] != "Sugarcane"]

    grp = (fdf.groupby("State_Name")["Yield"].mean()
             .sort_values(ascending=True)
             .reset_index())
    global_mean = grp["Yield"].mean()

    return jsonify({
        "states": grp["State_Name"].tolist(),
        "yields": grp["Yield"].round(3).tolist(),
        "mean":   round(float(global_mean), 3),
    })


@app.route("/api/scatter")
def api_scatter():
    fdf = apply_filters(df)
    crop_filter = request.args.get("crop")

    # Limit points per crop for performance
    MAX_PER_CROP = 80
    results = []
    crops_to_use = [crop_filter] if crop_filter else [c for c in df["Crop"].unique() if c != "Sugarcane"]

    for crop in crops_to_use:
        sub = fdf[fdf["Crop"] == crop]
        if sub.empty:
            continue
        sample = sub.sample(n=min(MAX_PER_CROP, len(sub)), random_state=42)
        for _, row in sample.iterrows():
            results.append({
                "crop": crop,
                "rf":   round(row["Annual_Rainfall_mm"], 1),
                "y":    round(row["Yield"], 3),
                "area": round(row["Area"], 0),
            })

    return jsonify(results)


@app.route("/api/heatmap")
def api_heatmap():
    fdf = apply_filters(df)
    pivot = (fdf.groupby(["State_Name", "Crop"])["Yield"]
               .mean()
               .unstack(fill_value=0)
               .round(2))

    # Per-column normalise (0–1) for colour mapping
    norm = (pivot - pivot.min()) / (pivot.max() - pivot.min()).replace(0, 1)

    states = pivot.index.tolist()
    crops  = pivot.columns.tolist()
    values = pivot.values.tolist()
    normed = norm.values.tolist()

    return jsonify({
        "states": states,
        "crops":  crops,
        "values": values,
        "normed": normed,
    })


@app.route("/api/risk")
def api_risk():
    fdf = apply_filters(df)
    grain = fdf[fdf["Crop"] != "Sugarcane"]

    cv_rows = []
    for (st, cr), grp in grain.groupby(["State_Name", "Crop"]):
        yr_m = grp.groupby("Crop_Year")["Yield"].mean()
        if len(yr_m) >= 3 and yr_m.mean() > 0:
            cv = float(yr_m.std() / yr_m.mean())
            cv_rows.append({"label": f"{st[:10]}·{cr[:8]}", "cv": round(cv, 3)})

    cv_rows.sort(key=lambda x: -x["cv"])
    top = cv_rows[:12]

    return jsonify({
        "labels": [r["label"] for r in top],
        "values": [r["cv"] for r in top],
    })


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
