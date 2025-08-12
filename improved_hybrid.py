# improved_hybrid_greedy_ga_20stops.py

import random
import numpy as np
import copy

# 1. Define 20 stops
stops = ['S' + str(i) for i in range(1, 21)]
start_stop = 'S1'

# 2. Create a random symmetric distance matrix
distances = {}
for i in range(len(stops)):
    for j in range(i, len(stops)):
        stop1 = stops[i]
        stop2 = stops[j]
        if stop1 == stop2:
            distances[(stop1, stop2)] = 0
        else:
            distance = random.uniform(1, 20)
            distances[(stop1, stop2)] = distance
            distances[(stop2, stop1)] = distance

# Fuel efficiency and emission factor
fuel_efficiency = 3.0  # km/L
emission_factor = 2.68  # kg CO2/L

# GA parameters
population_size = 100
generations = 1000
early_rate = 0.2
late_rate = 0.05
early_generations = 500
elitism_size = int(0.1 * population_size)
distance_threshold = 20 * 20 # A rough upper bound

# --- Helper Functions ---

def calculate_distance(route):
    total_distance = 0
    for i in range(len(route) - 1):
        stop1 = route[i]
        stop2 = route[i + 1]
        total_distance += distances.get((stop1, stop2), distances.get((stop2, stop1), float('inf')))
    return total_distance

def calculate_emissions(distance):
    fuel_used = distance / fuel_efficiency
    emissions = fuel_used * emission_factor
    return emissions

def generate_random_route():
    other_stops = copy.copy(stops)
    other_stops.remove(start_stop)
    random.shuffle(other_stops)
    return [start_stop] + other_stops + [start_stop]

# --- Greedy Heuristic ---

def greedy_heuristic():
    current_stop = start_stop
    unvisited_stops = copy.copy(stops)
    unvisited_stops.remove(start_stop)
    greedy_route = [start_stop]

    while unvisited_stops:
        nearest_stop = None
        min_distance = float('inf')
        for next_stop in unvisited_stops:
            dist = distances.get((current_stop, next_stop), distances.get((next_stop, current_stop), float('inf')))
            if dist < min_distance:
                min_distance = dist
                nearest_stop = next_stop

        if nearest_stop:
            greedy_route.append(nearest_stop)
            unvisited_stops.remove(nearest_stop)
            current_stop = nearest_stop
        else:
            break

    greedy_route.append(start_stop)
    return greedy_route

# --- Genetic Algorithm Functions ---

def evaluate_fitness(population):
    fitness_scores = []
    for route in population:
        distance = calculate_distance(route)
        fitness_scores.append((distance, route))
    return sorted(fitness_scores, key=lambda item: item[0])

def tournament_selection(population_fitness, tournament_size=5):
    participants = random.sample(population_fitness, tournament_size)
    winner = min(participants, key=lambda item: item[0])
    return winner[1]

def ordered_crossover(parent1, parent2):
    stops1 = parent1[1:-1]
    stops2 = parent2[1:-1]
    n = len(stops1)
    if n < 2:
        return [start_stop] + stops1 + [start_stop]
    start = random.randint(0, n - 2)
    end = random.randint(start + 1, n - 1)
    offspring_middle = stops1[start:end + 1]
    offspring = [start_stop] + offspring_middle
    p2_remaining = [stop for stop in stops2 if stop not in offspring_middle]
    current_index = len(offspring) - 1
    p2_index = 0
    while len(offspring) < n + 1:
        offspring.insert(current_index + 1, p2_remaining[p2_index])
        current_index += 1
        p2_index += 1
    offspring.append(start_stop)
    return offspring

def mutate(route, mutation_rate):
    mutated_route = copy.deepcopy(route)
    if random.random() < mutation_rate:
        indices = list(range(1, len(mutated_route) - 1))
        if len(indices) >= 2:
            i, j = random.sample(indices, 2)
            mutated_route[i], mutated_route[j] = mutated_route[j], mutated_route[i]
    return mutated_route

# --- 2-opt Local Search ---

def two_opt(route, iterations=5):
    best_route = copy.deepcopy(route)
    for _ in range(iterations):
        improved = True
        while improved:
            improved = False
            for i in range(1, len(best_route) - 2):
                for k in range(i + 1, len(best_route) - 1):
                    new_route = copy.deepcopy(best_route)
                    new_route[i:k+1] = reversed(new_route[i:k+1])
                    if calculate_distance(new_route) < calculate_distance(best_route):
                        best_route = new_route
                        improved = True
            if not improved:
                break
    return best_route

# --- Main GA Loop ---

initial_population = [greedy_heuristic()] + [generate_random_route() for _ in range(population_size - 1)]
population = initial_population
best_fitness_ga = float('inf')
best_route_ga = None

for generation in range(generations):
    fitness_scores = evaluate_fitness(population)
    current_best_distance = fitness_scores[0][0]
    if current_best_distance < best_fitness_ga:
        best_fitness_ga = current_best_distance
        best_route_ga = fitness_scores[0][1]
        best_emissions_ga = calculate_emissions(best_fitness_ga)
        print(f"Generation {generation + 1}: Best distance (GA) = {best_fitness_ga:.2f} km, Emissions = {best_emissions_ga:.2f} kg CO2e")

    next_generation = []
    for _ in range(population_size - elitism_size):
        parent1 = tournament_selection(fitness_scores)
        parent2 = tournament_selection(fitness_scores)

        if generation < early_generations:
            crossover_rate = early_rate
        else:
            crossover_rate = late_rate

        if random.random() < crossover_rate:
            offspring = ordered_crossover(parent1, parent2)
        else:
            offspring = copy.deepcopy(random.choice([parent1, parent2]))

        if generation < early_generations:
            mutation_rate = early_rate
        else:
            mutation_rate = late_rate
        mutated_offspring = mutate(offspring, mutation_rate)
        next_generation.append(mutated_offspring)

    elites = [route for _, route in fitness_scores[:elitism_size]]
    next_generation.extend(elites)
    next_generation = [route for route in next_generation if calculate_distance(route) <= distance_threshold]
    while len(next_generation) < population_size:
        next_generation.append(generate_random_route())
    population = next_generation

# --- Apply 2-opt Local Search to the best GA route ---
optimized_route = two_opt(best_route_ga, iterations=5)
final_distance = calculate_distance(optimized_route)
final_emissions = calculate_emissions(final_distance)

# --- Output the Results ---
print("\n--- Final Results (Improved Hybrid Greedy + GA + 2-opt - 20 Stops) ---")
print("Optimized Route (after 2-opt):", optimized_route)
print("Distance:", f"{final_distance:.2f} km")
print("Emissions:", f"{final_emissions:.2f} kg CO2e/loop")