# Campus Shuttle Carbon Optimization – Visualization Demo

## PURPOSE

This demo shows the **impact of our MILP optimization model** for the campus shuttle service in a **Before vs After** format.

The aim is to make it **visually obvious** that the optimized shuttle schedule:
- Reduces total CO₂e emissions
- Reduces fuel use
- Reduces idle time at hotspots
- Maintains route coverage and meets demand

We want the panel to **see** the operational difference, not just hear numbers.

---

## DATA FILES REQUIRED

Two CSV files with identical structure:

1. `baseline_schedule.csv` — *Before optimization*: current shuttle operational data (our LCIA baseline)
2. `optimized_schedule.csv` — *After optimization*: shuttle operational data from MILP model

### CSV COLUMN SCHEMA

| Column Name         | Type    | Description |
|---------------------|---------|-------------|
| **bus_id**          | string  | Unique bus name or ID (e.g., "Neoplan_1", "Nissan_3") |
| **time_period**     | integer | Index of time slot (0–23 for half-hour slots, covering 12 hours) |
| **route**           | string  | Route name (e.g., "Commercial Area route") |
| **segment_start**   | string  | Starting stop of the segment |
| **segment_end**     | string  | Ending stop of the segment |
| **fuel_liters**     | float   | Liters of fuel used during that time period on that segment |
| **idle_minutes**    | float   | Minutes idling during that period (usually at `segment_end`) |
| **travel_minutes**  | float   | Minutes moving during that period on that segment |
| **emissions_kgCO2e**| float   | Total emissions for that bus/period (fuel × α + idle × β) |

*All columns are mandatory in both CSVs for visual synchronization.*

---

## DEMO OBJECTIVES

The animated visualization must:

1. **Display Campus Map**
   - Base map: stylized campus layout with stops as nodes
   - Lines between stops represent segments for each route
   - Each route has a distinct color

2. **Animate Bus Movements**
   - For each `time_period`, move each bus from `segment_start` → `segment_end`
   - Speed/duration proportional to `travel_minutes`

3. **Highlight Idle Hotspots**
   - If `idle_minutes` > 0, show a pulsing red/orange glow at the `segment_end` location for that bus
   - Hotspot intensity can scale with idle time or emissions for visual impact

4. **Live Metrics Overlay**
   - Cumulative counters that update every `time_period`:
     - **Total emissions (kg CO₂e)** – sum of `emissions_kgCO2e`
     - **Total fuel used (L)** – sum of `fuel_liters`
     - **Total idle time (minutes)** – sum of `idle_minutes`
   - Show for current scenario (baseline or optimized)

5. **Scenario Toggle**
   - UI element to instantly switch between `baseline_schedule.csv` and `optimized_schedule.csv`
   - Map structure and animation logic remain the same for easy side-by-side comparison

6. **Final Frame Impact**
   - At the last period, pause and display:
     - Total daily savings in emissions: (baseline total – optimized total) kg CO₂e
     - Annualized savings (daily savings × 365)
     - Optional equivalence: “This is like planting X trees”

---

## INTERACTION REQUIREMENTS

- Start/Pause controls for animation
- Slider to scrub through specific `time_period`s
- Offline-capable — all data is preloaded from local CSVs
- Smooth loop playback for presentation mode

---

## VISUAL STYLE

- **Buses:** Small icons or circles, color-coded by route
- **Routes:** Solid colored lines on map (distinct per route)
- **Hotspots:** Pulsing glows where idle is high
- **Counters:** Large, bold numbers in a fixed overlay position
- **End Frame:** Dramatic change in numbers with animation (fireworks, burst, fade-in, etc.)

---

## EXAMPLE CSV ROW

```csv
bus_id,time_period,route,segment_start,segment_end,fuel_liters,idle_minutes,travel_minutes,emissions_kgCO2e
Neoplan_1,0,Commercial Area route,Commercial Area,Unity Hall,1.00,12.0,1.5,21.63