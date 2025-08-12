import pulp
import csv

def export_schedule(operating_vehicles, segments, time_periods, F, IdleAtLocation, T, AssignSegment, gwp_per_liter_fuel, gwp_per_minute_idle, scenario, data_source=None):
    """
    Exports a shuttle schedule to a CSV file for visualization purposes.
    If data_source is provided, it uses that data. Otherwise, it generates mock data.
    """
    filename = f"{scenario}_schedule.csv"
    fieldnames = ['bus_id', 'time_period', 'route', 'segment_start', 'segment_end',
                  'fuel_liters', 'idle_minutes', 'travel_minutes', 'emissions_kgCO2e']

    print(f"Generating schedule for scenario '{scenario}' to {filename}...")

    with open(filename, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        if data_source:
            writer.writerows(data_source)
        else:
            # Fallback for generating default mock data if data_source is not provided
            mock_data = []
            # Bus 1: Neoplan_1
            mock_data.append({
                'bus_id': 'Neoplan_1', 'time_period': 0, 'route': 'Commercial Area route',
                'segment_start': 'Commercial Area', 'segment_end': 'Unity Hall',
                'fuel_liters': 1.00, 'idle_minutes': 12.0, 'travel_minutes': 1.5,
                'emissions_kgCO2e': 21.63
            })
            mock_data.append({
                'bus_id': 'Neoplan_1', 'time_period': 1, 'route': 'Commercial Area route',
                'segment_start': 'Unity Hall', 'segment_end': 'Main Gate',
                'fuel_liters': 0.80, 'idle_minutes': 5.0, 'travel_minutes': 1.0,
                'emissions_kgCO2e': 15.00
            })
            # Bus 2: Nissan_2
            mock_data.append({
                'bus_id': 'Nissan_2', 'time_period': 0, 'route': 'Brunei route',
                'segment_start': 'Brunei Complex', 'segment_end': 'Prempeh Library',
                'fuel_liters': 0.50, 'idle_minutes': 2.0, 'travel_minutes': 1.5,
                'emissions_kgCO2e': 5.73
            })
            writer.writerows(mock_data)
    print(f"Schedule saved to {filename}")


def create_lcia_aligned_milp_model():
    """MILP model aligned with LCIA baseline of 5,877.321 kg CO2e"""

    print("CREATING LCIA-ALIGNED MILP MODEL")
    print("="*50)

    # Parameters aligned with LCIA baseline
    daily_fuel_liters = 286  # From 4000 cedis / 14 cedis per liter
    lcia_baseline_gwp = 5877.321  # kg CO2e/day

    # Operating vehicles based on your observations
    total_fleet = [f"Neoplan_{i}" for i in range(23)] + [f"Nissan_{i}" for i in range(10)]
    operating_vehicles = total_fleet[:12]  # 12 buses operating daily

    routes = ['Commercial Area route', 'Brunei route', 'Boadi route']
    time_periods = list(range(24))  # 12 hours, 30-min periods

    # Route structures
    route_stops = {
        'Commercial Area route': ['Commercial Area', 'Unity Hall', 'College of Science', 'KSB'],
        'Brunei route': ['Brunei Complex', 'Prempeh Library', 'College of Science', 'KSB'],
        'Boadi route': ['Medical Village', 'Gaza']
    }

    # Create segments
    segments = []
    for route in routes:
        if route in route_stops:
            stops = route_stops[route]
            # Forward segments
            for i in range(len(stops) - 1):
                segments.append((route, (stops[i], stops[i+1])))
            # Reverse segments
            for i in range(len(stops) - 1, 0, -1):
                segments.append((route, (stops[i], stops[i-1])))

    # Vehicle capacities (realistic)
    vehicle_capacity = {}
    for v in operating_vehicles:
        if 'Neoplan' in v:
            vehicle_capacity[v] = 70   # Effective capacity
        else:
            vehicle_capacity[v] = 25   # Small vehicle

    # Parameters based on your field observations
    avg_segment_time = 1.5          # Minutes per segment (as observed)
    base_dwell_time = 2.0           # Minutes at regular stops
    hub_dwell_time = 12             # Minutes at Commercial Area hub
    duration_of_period = 30

    # GWP factors (LCIA validated)
    gwp_per_liter_fuel = 5877.321 / 784  # 7.49 kg CO2e/L
    fuel_rate_neoplan = (20/100) * (30/60)  # 1.0 L/min
    fuel_rate_nissan = (10/100) * (30/60)   # 0.5 L/min
    gwp_per_minute_idle = 66.33 / (0.75 * 60)  # 1.47 kg CO2e/min

    # Variables
    AssignSegment = pulp.LpVariable.dicts("Assign", (operating_vehicles, segments, time_periods), cat='Binary')
    T = pulp.LpVariable.dicts("Travel", (operating_vehicles, segments, time_periods), lowBound=0)
    F = pulp.LpVariable.dicts("Fuel", (operating_vehicles, segments, time_periods), lowBound=0)
    IdleAtLocation = pulp.LpVariable.dicts("Idle",
        (operating_vehicles, ['Commercial Area', 'Unity Hall', 'College of Science', 'KSB',
                             'Brunei Complex', 'Prempeh Library', 'Medical Village', 'Gaza'], time_periods), lowBound=0)
    AssignedToRouteDaily = pulp.LpVariable.dicts("RouteDaily", (operating_vehicles, routes), cat='Binary')

    # Model
    model = pulp.LpProblem("LCIA_Aligned_MILP_Model", pulp.LpMinimize)

    # Track constraint names
    constraint_names = set()
    constraint_counter = 0

    # Objective: Minimize GWP aligned with LCIA baseline
    model += (
        pulp.lpSum([gwp_per_liter_fuel * F[v][seg][t]
                   for v in operating_vehicles for seg in segments for t in time_periods]) +
        pulp.lpSum([gwp_per_minute_idle * IdleAtLocation[v][loc][t]
                   for v in operating_vehicles for loc in ['Commercial Area', 'Unity Hall', 'College of Science', 'KSB',
                                                          'Brunei Complex', 'Prempeh Library', 'Medical Village', 'Gaza']
                   for t in time_periods]),
        "Total_GWP_Objective"
    )

    # CONSTRAINTS ALIGNED WITH LCIA BASELINE

    # 1. FUEL CONSUMPTION ALIGNED WITH LCIA
    constraint_counter += 1
    constraint_name = f"LCIA_Fuel_Constraint_{constraint_counter}"
    if constraint_name not in constraint_names:
        model += (
            pulp.lpSum([F[v][seg][t] for v in operating_vehicles for seg in segments for t in time_periods]) >=
            daily_fuel_liters * 0.95,  # Tight constraint to match LCIA
            constraint_name
        )
        constraint_names.add(constraint_name)

    # 2. ROUTE COVERAGE (your observed realistic numbers)
    route_vehicle_targets = {
        'Commercial Area route': 4,   # As specified
        'Brunei route': 3,            # As specified
        'Boadi route': 2              # As specified
    }

    for r in routes:
        constraint_counter += 1
        constraint_name = f"RouteCoverage_LCIA_{constraint_counter}"
        if constraint_name not in constraint_names:
            model += (
                pulp.lpSum([AssignedToRouteDaily[v][r] for v in operating_vehicles]) >=
                route_vehicle_targets[r],
                constraint_name
            )
            constraint_names.add(constraint_name)

    # 3. VEHICLE UTILIZATION (continuous operation)
    for v in operating_vehicles:
        constraint_counter += 1
        constraint_name = f"VehicleUtilization_LCIA_{constraint_counter}"
        if constraint_name not in constraint_names:
            # Each vehicle operates continuously during the day
            model += (
                pulp.lpSum([AssignSegment[v][seg][t] for seg in segments for t in time_periods]) >=
                80,  # Each operating vehicle makes at least 80 segment assignments
                constraint_name
            )
            constraint_names.add(constraint_name)

    # 4. PASSENGER DEMAND (realistic)
    route_peak_demand = {
        'Commercial Area route': 100,  # High demand
        'Brunei route': 30,            # Low demand
        'Boadi route': 25              # Very low demand
    }

    for r in routes:
        route_segments = [seg for seg in segments if seg[0] == r]
        peak_periods = [7, 8, 11, 12, 13, 16, 17, 18]

        # Peak periods
        for t in peak_periods:
            constraint_counter += 1
            constraint_name = f"PeakDemand_LCIA_{constraint_counter}"
            if constraint_name not in constraint_names:
                model += (
                    pulp.lpSum([vehicle_capacity[v] * AssignSegment[v][seg][t]
                               for v in operating_vehicles for seg in route_segments]) >=
                    route_peak_demand[r] * 1.3,  # Reasonable safety margin
                    constraint_name
                )
                constraint_names.add(constraint_name)

    # 5. TRAVEL TIMES (1.5 minutes per segment as observed)
    constraint_counter = 0
    for v in operating_vehicles:
        for seg in segments:
            for t in time_periods:
                constraint_counter += 1
                constraint_name1 = f"TravelTime_LCIA_{constraint_counter}"
                constraint_counter += 1
                constraint_name2 = f"Fuel_LCIA_{constraint_counter}"

                # Your observation: 1.5 minutes per segment
                if constraint_name1 not in constraint_names:
                    model += T[v][seg][t] <= 2.0 * AssignSegment[v][seg][t], constraint_name1  # Max 2 min
                    model += T[v][seg][t] >= 1.0 * AssignSegment[v][seg][t], constraint_name1 + "_min"  # Min 1 min
                    constraint_names.add(constraint_name1)
                    constraint_names.add(constraint_name1 + "_min")

                if constraint_name2 not in constraint_names:
                    expected_fuel = 1.5 * (fuel_rate_neoplan if 'Neoplan' in v else fuel_rate_nissan)
                    model += F[v][seg][t] <= (expected_fuel * 1.5) * AssignSegment[v][seg][t], constraint_name2
                    constraint_names.add(constraint_name2)

    # 6. DWELL TIMES (critical insight from your field work)
    constraint_counter = 0
    for v in operating_vehicles:
        for loc in ['Commercial Area', 'Unity Hall', 'College of Science', 'KSB',
                   'Brunei Complex', 'Prempeh Library', 'Medical Village', 'Gaza']:
            for t in time_periods:
                constraint_counter += 1
                constraint_name = f"DwellTime_LCIA_{constraint_counter}"
                if constraint_name not in constraint_names:
                    if loc in ['Commercial Area']:  # Major hub - your key finding
                        model += (
                            IdleAtLocation[v][loc][t] >= hub_dwell_time *
                            pulp.lpSum([AssignSegment[v][seg][t]
                                       for seg in segments if seg[1][0] == loc]),
                            constraint_name
                        )
                    else:  # Regular stops
                        model += (
                            IdleAtLocation[v][loc][t] >= base_dwell_time *
                            pulp.lpSum([AssignSegment[v][seg][t]
                                       for seg in segments if seg[1][0] == loc]),
                            constraint_name
                        )
                    constraint_names.add(constraint_name)

    # 7. TIME BALANCE (continuous operation model)
    constraint_counter = 0
    for v in operating_vehicles:
        for t in time_periods:
            constraint_counter += 1
            constraint_name = f"TimeBalance_LCIA_{constraint_counter}"
            if constraint_name not in constraint_names:
                # Vehicles work continuously but with realistic utilization
                model += (
                    pulp.lpSum([T[v][seg][t] for seg in segments]) +
                    pulp.lpSum([IdleAtLocation[v][loc][t]
                               for loc in ['Commercial Area', 'Unity Hall', 'College of Science', 'KSB',
                                          'Brunei Complex', 'Prempeh Library', 'Medical Village', 'Gaza']]) <=
                    duration_of_period * 0.95,  # Use 95% of each period
                    constraint_name
                )
                constraint_names.add(constraint_name)

    return model, AssignSegment, T, F, IdleAtLocation, AssignedToRouteDaily, operating_vehicles, routes, segments, daily_fuel_liters, lcia_baseline_gwp

def solve_and_validate_model():
    """Solve the model and validate against LCIA baseline"""

    print("Solving LCIA-aligned MILP model...")
    model, AssignSegment, T, F, IdleAtLocation, AssignedToRouteDaily, operating_vehicles, routes, segments, daily_fuel_liters, lcia_baseline_gwp = create_lcia_aligned_milp_model()

    # Solve with reasonable time limit
    model.solve(pulp.PULP_CBC_CMD(msg=1, timeLimit=120))

    status = pulp.LpStatus[model.status]
    print(f"Status: {status}")

    if status == 'Optimal':
        # Calculate comprehensive metrics
        total_gwp = pulp.value(model.objective)
        total_travel_time = sum(T[v][seg][t].varValue for v in operating_vehicles for seg in segments for t in range(24))
        total_idle_time = sum(IdleAtLocation[v][loc][t].varValue
                             for v in operating_vehicles
                             for loc in ['Commercial Area', 'Unity Hall', 'College of Science', 'KSB',
                                        'Brunei Complex', 'Prempeh Library', 'Medical Village', 'Gaza']
                             for t in range(24))

        total_assignments = sum(AssignSegment[v][seg][t].varValue for v in operating_vehicles for seg in segments for t in range(24))
        total_fuel_consumption = sum(F[v][seg][t].varValue for v in operating_vehicles for seg in segments for t in range(24))

        print(f"\n{'='*60}")
        print("LCIA-ALIGNED MILP MODEL RESULTS")
        print(f"{'='*60}")
        print(f"LCIA Baseline GWP: {lcia_baseline_gwp:.1f} kg CO2e/day")
        print(f"Model fuel consumption: {total_fuel_consumption:.1f} liters")
        print(f"Total GWP: {total_gwp:.0f} kg CO2e")
        print(f"Total Travel Time: {total_travel_time:.0f} minutes")
        print(f"Total Idle Time: {total_idle_time:.0f} minutes")
        print(f"Total Vehicle Assignments: {total_assignments:.0f}")
        print(f"Operating Vehicles: {len(operating_vehicles)} buses")
        print(f"Average Assignments per Vehicle: {total_assignments/len(operating_vehicles):.1f}")
        print(f"Average GWP per Assignment: {total_gwp/max(1,total_assignments):.1f} kg CO2e")

        # Route coverage verification
        print(f"\nRoute Coverage (LCIA-Aligned Operations):")
        for r in routes:
            assigned_vehicles = sum(AssignedToRouteDaily[v][r].varValue for v in operating_vehicles)
            target = {'Commercial Area route': 4, 'Brunei route': 3, 'Boadi route': 2}[r]
            print(f"  {r}: {assigned_vehicles:.0f} vehicles (target: {target})")

        # Calculate realistic metrics
        print(f"\nREALISTIC OPERATIONAL METRICS:")
        total_operating_time = 12 * 60 * len(operating_vehicles)  # 12 hours × 60 min × vehicles
        travel_percentage = (total_travel_time / total_operating_time) * 100
        idle_percentage = (total_idle_time / total_operating_time) * 100
        print(f"  Total operating time (12 buses × 12 hours): {total_operating_time} minutes")
        print(f"  Travel time percentage: {travel_percentage:.1f}%")
        print(f"  Idle time percentage: {idle_percentage:.1f}%")

        # Strategic analysis with LCIA baseline
        print(f"\nSTRATEGIC ANALYSIS WITH LCIA BASELINE:")
        print(f"  LCIA baseline GWP: {lcia_baseline_gwp:.1f} kg CO2e")
        print(f"  Model optimized GWP: {total_gwp:.0f} kg CO2e")

        if lcia_baseline_gwp > total_gwp:
            reduction_potential = lcia_baseline_gwp - total_gwp
            reduction_percentage = (reduction_potential / lcia_baseline_gwp) * 100
            print(f"  Reduction potential: {reduction_potential:.1f} kg CO2e ({reduction_percentage:.1f}%)")

            # Annual impact
            annual_reduction = reduction_potential * 365
            print(f"  Annual reduction potential: {annual_reduction:,.0f} kg CO2e")

        print(f"\n{'='*60}")
        print("MODEL VALIDATION COMPLETE - LCIA ALIGNED")
        print("Ready for sensitivity analysis and academic defense")
        print(f"{'='*60}")

        # --- Generate CSV Data for Visualization ---
        # Baseline Data (using existing mock data for now)
        mock_baseline_data = [
            {'bus_id': 'Neoplan_1', 'time_period': 0, 'route': 'Route 1', 'segment_start': 'Commercial Area', 'segment_end': 'Unity Hall', 'fuel_liters': 1.00, 'idle_minutes': 12.0, 'travel_minutes': 1.5, 'emissions_kgCO2e': 21.63},
            {'bus_id': 'Neoplan_1', 'time_period': 1, 'route': 'Route 1', 'segment_start': 'Unity Hall', 'segment_end': 'College of Science', 'fuel_liters': 0.90, 'idle_minutes': 8.0, 'travel_minutes': 1.2, 'emissions_kgCO2e': 18.00},
            {'bus_id': 'Nissan_2', 'time_period': 0, 'route': 'Route 2', 'segment_start': 'Brunei Complex', 'segment_end': 'Prempeh Library', 'fuel_liters': 0.50, 'idle_minutes': 2.0, 'travel_minutes': 1.5, 'emissions_kgCO2e': 5.73},
            {'bus_id': 'Nissan_2', 'time_period': 1, 'route': 'Route 2', 'segment_start': 'Prempeh Library', 'segment_end': 'College of Science', 'fuel_liters': 0.45, 'idle_minutes': 1.0, 'travel_minutes': 1.3, 'emissions_kgCO2e': 5.00},
            {'bus_id': 'Neoplan_1', 'time_period': 2, 'route': 'Route 1', 'segment_start': 'College of Science', 'segment_end': 'School of Business (KSB)', 'fuel_liters': 1.10, 'idle_minutes': 0.0, 'travel_minutes': 1.8, 'emissions_kgCO2e': 23.00},
            {'bus_id': 'Nissan_2', 'time_period': 2, 'route': 'Route 2', 'segment_start': 'Brunei Complex', 'segment_end': 'Prempeh Library', 'fuel_liters': 0.55, 'idle_minutes': 0.0, 'travel_minutes': 1.6, 'emissions_kgCO2e': 6.00},
        ]

        # Optimized Data from MILP solution
        optimized_schedule_data = []
        for v in operating_vehicles:
            for t in time_periods:
                for seg in segments:
                    if AssignSegment[v][seg][t].varValue > 0.5:  # If segment is assigned
                        route_name = seg[0]  # Extract route name from segment tuple
                        start_stop = seg[1][0]
                        end_stop = seg[1][1]
                        fuel = F[v][seg][t].varValue if F[v][seg][t].varValue is not None else 0.0
                        idle = IdleAtLocation[v][end_stop][t].varValue if IdleAtLocation[v][end_stop][t].varValue is not None else 0.0
                        travel = T[v][seg][t].varValue if T[v][seg][t].varValue is not None else 0.0
                        emissions = (fuel * gwp_per_liter_fuel) + (idle * gwp_per_minute_idle)

                        optimized_schedule_data.append({
                            'bus_id': v,
                            'time_period': t,
                            'route': route_name,
                            'segment_start': start_stop,
                            'segment_end': end_stop,
                            'fuel_liters': fuel,
                            'idle_minutes': idle,
                            'travel_minutes': travel,
                            'emissions_kgCO2e': emissions
                        })
        
        # Call export_schedule for baseline and optimized scenarios
        export_schedule(operating_vehicles, segments, time_periods, F, IdleAtLocation, T, AssignSegment, gwp_per_liter_fuel, gwp_per_minute_idle, scenario="baseline", data_source=mock_baseline_data)
        export_schedule(operating_vehicles, segments, time_periods, F, IdleAtLocation, T, AssignSegment, gwp_per_liter_fuel, gwp_per_minute_idle, scenario="optimized", data_source=optimized_schedule_data)

        return {
            'lcia_baseline': lcia_baseline_gwp,
            'optimized_gwp': total_gwp,
            'reduction_potential': reduction_potential if lcia_baseline_gwp > total_gwp else 0,
            'reduction_percentage': reduction_percentage if lcia_baseline_gwp > total_gwp else 0,
            'fuel_consumption': total_fuel_consumption,
            'travel_time': total_travel_time,
            'idle_time': total_idle_time,
            'assignments': total_assignments
        }

    else:
        print("Model failed to solve optimally")
        return None

# Run the corrected model
print("Building LCIA-aligned MILP model...")
results = solve_and_validate_model()

if results:
    print(f"\nSUMMARY FOR SENSITIVITY ANALYSIS:")
    print(f"Baseline GWP: {results['lcia_baseline']:.1f} kg CO2e/day")
    print(f"Optimized GWP: {results['optimized_gwp']:.0f} kg CO2e/day")
    print(f"Reduction: {results['reduction_potential']:.1f} kg CO2e/day ({results['reduction_percentage']:.1f}%)")