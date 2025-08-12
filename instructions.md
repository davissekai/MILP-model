# Campus Shuttle Emissions Visualization - Before/After MILP Optimization

## PURPOSE
Visualize the daily operation of our campus shuttle service **before optimization** (baseline) and **after optimization** (MILP results), showing reductions in carbon footprint.

Two CSV files are provided:

1. `baseline_schedule.csv` — current shuttle schedule and emissions data
2. `optimized_schedule.csv` — optimized shuttle schedule and emissions data from MILP model

The visualization should:
- Animate bus movements along their routes for each time period.
- Show idle hotspots visually (color or glow at the `segment_end` location).
- Display a cumulative emissions counter.
- Include a toggle to switch between "Before Optimization" and "After Optimization".
- Always use the same map layout and scaling for both scenarios so comparisons are clear.

---

## CSV STRUCTURE

Both CSV files have identical columns:

| Column Name         | Type    | Description |
|---------------------|---------|-------------|
| **bus_id**          | string  | Unique bus name or ID, e.g., "Neoplan_1", "Nissan_3" |
| **time_period**     | integer | Index of time slot (0–23 if 30-min slots, covering 12 hours) |
| **route**           | string  | Name of the route, e.g., "Commercial Area route" |
| **segment_start**   | string  | Starting stop name of this segment |
| **segment_end**     | string  | Ending stop name of this segment |
| **fuel_liters**     | float   | Liters of fuel used by that bus in this time period |
| **idle_minutes**    | float   | Minutes spent idling in that time period (usually at `segment_end`) |
| **travel_minutes**  | float   | Minutes spent moving in that time period |
| **emissions_kgCO2e**| float   | Kg CO₂e emitted (fuel × α + idle × β) for that period and bus |

---

## VISUALIZATION REQUIREMENTS

1. **Map Layout**
   - Use a fixed map of the campus with all stops plotted as nodes.
   - Connect stops with route lines according to the segments.
   - Each route should have a distinct color.

2. **Bus Animation**
   - In each time period, place each bus at its `segment_start` and animate it moving to `segment_end`.
   - Use `time_period` as the animation frame index.
   - Movement should be proportional to `travel_minutes` for that period.

3. **Idle Hotspots**
   - If `idle_minutes` > 0, display a pulsing red glow at the `segment_end` location during that time period.

4. **Counters**
   - Show cumulative totals from the beginning of the day up to the current `time_period`:
     - **Emissions (kg CO₂e)** from `emissions_kgCO2e`
     - **Fuel Used (L)** from `fuel_liters`
     - **Idle Minutes** from `idle_minutes`

5. **Before/After Toggle**
   - A UI control to switch between `baseline_schedule.csv` and `optimized_schedule.csv`.
   - Switching should immediately change the animation data but keep map structure identical.

6. **Performance**
   - The animation should be smooth and run offline without internet dependency.
   - Preload both CSVs at start to avoid loading lag.

---

## FINAL FRAME
When the last `time_period` finishes:
- Pause and display **TOTAL daily savings** in emissions as:  
  "Savings: [Baseline total - Optimized total] kg CO₂e/day"
- Also show the annualized savings (multiply daily savings by 365).

---

## OPTIONAL FINISHING TOUCHES
- A short burst animation when showing total savings.
- Convert the annual savings into a relatable metaphor (e.g., “Equivalent to planting X trees”).
- Allow user to scrub through time periods manually with a slider.

---

## DATA EXAMPLE

```csv
bus_id,time_period,route,segment_start,segment_end,fuel_liters,idle_minutes,travel_minutes,emissions_kgCO2e
Neoplan_1,0,Commercial Area route,Commercial Area,Unity Hall,1.00,12.0,1.5,21.63
Nissan_3,0,Brunei route,Brunei Complex,Prempeh Library,0.50,2.0,1.5,5.73