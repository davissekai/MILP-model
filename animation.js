// Animation Controller - Manages bus movements, metrics, and timeline
class AnimationController {
    constructor(campusMap) {
        this.campusMap = campusMap;
        this.currentScenario = 'baseline';
        this.currentTimePeriod = 0;
        this.maxTimePeriod = 11;
        this.isPlaying = false;
        this.isLooping = false;
        this.animationSpeed = 1;
        
        // Data storage
        this.baselineData = [];
        this.optimizedData = [];
        this.currentData = [];
        
        // Cumulative metrics
        this.cumulativeMetrics = {
            emissions: 0,
            fuel: 0,
            idle: 0
        };
        
        // Animation timing
        this.animationInterval = null;
        this.periodDuration = 2000; // milliseconds per time period
        
        this.loadData();
    }

    async loadData() {
        try {
            // Load baseline data
            const baselineResponse = await fetch('baseline_schedule.csv');
            const baselineText = await baselineResponse.text();
            this.baselineData = this.parseCSV(baselineText);
            
            // Load optimized data
            const optimizedResponse = await fetch('optimized_schedule.csv');
            const optimizedText = await optimizedResponse.text();
            this.optimizedData = this.parseCSV(optimizedText);
            
            // Set initial data to baseline
            this.currentData = this.baselineData;
            
            console.log('Data loaded successfully');
            console.log('Baseline entries:', this.baselineData.length);
            console.log('Optimized entries:', this.optimizedData.length);
            
        } catch (error) {
            console.error('Error loading data:', error);
            // Create sample data if CSV loading fails
            this.createSampleData();
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const entry = {};
            
            headers.forEach((header, index) => {
                const value = values[index];
                const cleanHeader = header.trim();
                
                if (cleanHeader === 'time_period') {
                    entry[cleanHeader] = parseInt(value);
                } else if (['fuel_liters', 'idle_minutes', 'travel_minutes', 'emissions_kgCO2e'].includes(cleanHeader)) {
                    entry[cleanHeader] = parseFloat(value);
                } else {
                    entry[cleanHeader] = value.trim();
                }
            });
            
            return entry;
        });
    }

    createSampleData() {
        // Fallback sample data if CSV loading fails
        console.log('Creating sample data...');
        this.baselineData = this.generateSampleData('baseline');
        this.optimizedData = this.generateSampleData('optimized');
        this.currentData = this.baselineData;
    }

    generateSampleData(type) {
        const data = [];
        const buses = ['Neoplan_1', 'Nissan_2', 'Mercedes_3'];
        const routes = {
            'Neoplan_1': 'Commercial Area route',
            'Nissan_2': 'Residential route',
            'Mercedes_3': 'Academic route'
        };
        const segments = {
            'Commercial Area route': [
                ['Commercial Area', 'Unity Hall'],
                ['Unity Hall', 'Library Plaza'],
                ['Library Plaza', 'Student Center'],
                ['Student Center', 'Commercial Area']
            ],
            'Residential route': [
                ['North Dorms', 'South Dorms'],
                ['South Dorms', 'East Parking'],
                ['East Parking', 'West Campus'],
                ['West Campus', 'North Dorms']
            ],
            'Academic route': [
                ['Engineering Building', 'Science Complex'],
                ['Science Complex', 'Arts Building'],
                ['Arts Building', 'Business School'],
                ['Business School', 'Engineering Building']
            ]
        };

        for (let period = 0; period <= 23; period++) {
            buses.forEach(busId => {
                const route = routes[busId];
                const routeSegments = segments[route];
                const segmentIndex = period % routeSegments.length;
                const [start, end] = routeSegments[segmentIndex];
                
                const multiplier = type === 'baseline' ? 1.3 : 1.0;
                
                data.push({
                    bus_id: busId,
                    time_period: period,
                    route: route,
                    segment_start: start,
                    segment_end: end,
                    fuel_liters: (0.8 + Math.random() * 0.4) * multiplier,
                    idle_minutes: (2 + Math.random() * 18) * multiplier,
                    travel_minutes: 2 + Math.random() * 2,
                    emissions_kgCO2e: (15 + Math.random() * 10) * multiplier
                });
            });
        }
        
        return data;
    }

    switchScenario(scenario) {
        this.currentScenario = scenario;
        this.currentData = scenario === 'baseline' ? this.baselineData : this.optimizedData;
        this.resetAnimation();
        this.updateMetrics();
        this.updateUI();
        
        console.log(`Switched to ${scenario} scenario`);
    }

    getCurrentPeriodData() {
        return this.currentData.filter(entry => entry.time_period === this.currentTimePeriod);
    }

    // Helper: compute segment for a bus at a given period using route_data fallback
    getRouteSegmentFor(busId, period) {
        const bus = this.campusMap.buses[busId];
        if (!bus) return null;
        const routeName = bus.route;
        const segments = this.campusMap.routeSegments[routeName];
        if (!segments || segments.length === 0) return null;
        
        // Each period advances to the next segment
        // If we have more periods than segments, continue at the last segment
        const idx = Math.min(period, segments.length - 1);
        return segments[idx]; // [from, to]
    }

    // Helper: check if both stops exist in the map
    stopsExist(from, to) {
        return !!(this.campusMap.stopPositions[from] && this.campusMap.stopPositions[to]);
    }

    async animateTimePeriod(period) {
        const periodData = this.currentData.filter(entry => entry.time_period === period);
        
        // Clear previous hotspots
        this.campusMap.clearHotspots();
        
        // Ensure we animate every known bus, not just those present in CSV
        const busIds = this.campusMap.getAllBuses();
        const animations = busIds.map(async (busId) => {
            // Try to find CSV entry for this bus at this period
            const csvEntry = periodData.find(e => e.bus_id === busId);

            // Always use route sequence to ensure proper progression
            const seg = this.getRouteSegmentFor(busId, period);
            if (!seg) return; // nothing to animate
            let [fromStop, toStop] = seg;
            
            // Get travel and idle times from CSV if available
            let travelMinutes = 2.5, idleMinutes = 0;
            if (csvEntry) {
                travelMinutes = Number.isFinite(csvEntry.travel_minutes) ? csvEntry.travel_minutes : travelMinutes;
                idleMinutes = Number.isFinite(csvEntry.idle_minutes) ? csvEntry.idle_minutes : 0;
            }
            
            // For period 0, ensure bus starts at first stop
            if (period === 0) {
                const bus = this.campusMap.buses[busId];
                if (bus) {
                    const firstStop = this.campusMap.getRouteFirstStop(bus.route);
                    if (firstStop && bus.currentStop !== firstStop) {
                        fromStop = firstStop;
                    }
                }
            }

            const travelDuration = (travelMinutes * 100) / this.animationSpeed;
            if (fromStop && toStop && fromStop !== toStop) {
                await this.campusMap.moveBus(busId, fromStop, toStop, travelDuration);
            }

            // Hotspots (use CSV idle if available, else apply light effect based on priorities)
            let intensity = 0;
            if (idleMinutes > 0) {
                intensity = Math.min(idleMinutes / 20, 2.5);
            } else {
                const name = (toStop || '').trim();
                if (/Commercial Area/i.test(name)) intensity = 1.2;
                else if (/Brunei/i.test(name)) intensity = 0.7;
                else intensity = 0.3;
            }
            if (intensity > 0.4) {
                this.campusMap.showIdleHotspot(toStop, intensity, this.periodDuration);
            }
        });

        await Promise.all(animations);
    }

    updateMetrics() {
        // Calculate cumulative metrics up to current period
        this.cumulativeMetrics = { emissions: 0, fuel: 0, idle: 0 };
        
        for (let period = 0; period <= this.currentTimePeriod; period++) {
            const periodData = this.currentData.filter(entry => entry.time_period === period);
            
            periodData.forEach(entry => {
                this.cumulativeMetrics.emissions += entry.emissions_kgCO2e;
                this.cumulativeMetrics.fuel += entry.fuel_liters;
                this.cumulativeMetrics.idle += entry.idle_minutes;
            });
        }
        
        // Update UI
        this.animateCounter('emissions-counter', this.cumulativeMetrics.emissions.toFixed(1) + ' kg CO₂e');
        this.animateCounter('fuel-counter', this.cumulativeMetrics.fuel.toFixed(1) + ' L');
        this.animateCounter('idle-counter', Math.round(this.cumulativeMetrics.idle) + ' min');
    }

    animateCounter(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('updating');
            element.textContent = newValue;
            
            setTimeout(() => {
                element.classList.remove('updating');
            }, 300);
        }
    }

    calculateTotalMetrics(data) {
        const totals = { emissions: 0, fuel: 0, idle: 0 };
        
        data.forEach(entry => {
            totals.emissions += entry.emissions_kgCO2e;
            totals.fuel += entry.fuel_liters;
            totals.idle += entry.idle_minutes;
        });
        
        return totals;
    }

    showImpactSummary() {
        const baselineTotals = this.calculateTotalMetrics(this.baselineData);
        const optimizedTotals = this.calculateTotalMetrics(this.optimizedData);
        
        const savings = {
            emissions: baselineTotals.emissions - optimizedTotals.emissions,
            fuel: baselineTotals.fuel - optimizedTotals.fuel,
            idle: baselineTotals.idle - optimizedTotals.idle
        };
        
        // Annual savings (assuming 365 days)
        const annualSavings = savings.emissions * 365;
        
        // Tree equivalent (approximately 22 kg CO2e per tree per year)
        const treeEquivalent = Math.round(annualSavings / 22);
        
        // Update impact summary
        document.getElementById('emissions-saved').textContent = savings.emissions.toFixed(1) + ' kg CO₂e';
        document.getElementById('annual-savings').textContent = annualSavings.toFixed(0) + ' kg CO₂e/year';
        document.getElementById('tree-equivalent').textContent = treeEquivalent + ' trees planted';
        
        // Show the summary with animation
        const summaryElement = document.getElementById('impact-summary');
        summaryElement.classList.remove('hidden');
    }

    hideImpactSummary() {
        document.getElementById('impact-summary').classList.add('hidden');
    }

    async play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        // Show route lines only while playing
        this.campusMap.drawRouteSegments();
        
        while (this.isPlaying && this.currentTimePeriod <= this.maxTimePeriod) {
            await this.animateTimePeriod(this.currentTimePeriod);
            this.updateMetrics();
            this.updateUI();
            
            // Wait for period duration
            await new Promise(resolve => {
                setTimeout(resolve, this.periodDuration / this.animationSpeed);
            });
            
            this.currentTimePeriod++;
            
            // Check if we've reached the end
            if (this.currentTimePeriod > this.maxTimePeriod) {
                if (this.isLooping) {
                    this.resetAnimation();
                } else {
                    this.pause();
                    this.showImpactSummary();
                }
            }
        }
    }

    pause() {
        this.isPlaying = false;
        // Hide route lines when paused
        this.campusMap.clearRouteSegments();
        this.updateUI();
    }

    resetAnimation() {
        this.pause();
        // Ensure routes are hidden on reset
        this.campusMap.clearRouteSegments();
        this.currentTimePeriod = 0;
        this.cumulativeMetrics = { emissions: 0, fuel: 0, idle: 0 };
        this.campusMap.clearHotspots();
        this.hideImpactSummary();
        
        // Reset bus positions
        this.repositionBuses();
        this.updateMetrics();
        this.updateUI();
    }

    repositionBuses() {
        // Move all buses to the first stop in their assigned route
        const busIds = this.campusMap.getAllBuses();
        busIds.forEach(busId => {
            const bus = this.campusMap.buses[busId];
            if (!bus) return;
            const firstStop = this.campusMap.getRouteFirstStop(bus.route);
            if (firstStop && this.campusMap.stopPositions[firstStop]) {
                const pos = this.campusMap.stopPositions[firstStop];
                bus.element.setAttribute('transform', `translate(${pos.x - 10}, ${pos.y - 6})`);
                bus.currentStop = firstStop;
                bus.direction = 1; // 1 for forward, -1 for backward
            }
        });
    }

    jumpToTimePeriod(period) {
        if (period < 0 || period > this.maxTimePeriod) return;
        
        this.pause();
        this.currentTimePeriod = period;
        this.updateMetrics();
        this.updateUI();
        
        // Position buses at the correct locations for this period
        this.positionBusesForPeriod(period);
    }

    positionBusesForPeriod(period) {
        const periodData = this.currentData.filter(entry => entry.time_period === period);

        const busIds = this.campusMap.getAllBuses();
        busIds.forEach(busId => {
            const csvEntry = periodData.find(e => e.bus_id === busId);
            let targetStop = null;
            if (csvEntry && this.campusMap.stopPositions[csvEntry.segment_end]) {
                targetStop = csvEntry.segment_end;
            } else {
                const seg = this.getRouteSegmentFor(busId, period);
                if (seg && this.campusMap.stopPositions[seg[1]]) targetStop = seg[1];
            }
            if (targetStop) {
                const pos = this.campusMap.stopPositions[targetStop];
                const bus = this.campusMap.buses[busId];
                bus.element.setAttribute('transform', `translate(${pos.x - 10}, ${pos.y - 6})`);
                bus.currentStop = targetStop;
            }
        });

        // Show hotspots for current period
        this.showCurrentPeriodHotspots();
    }

    showCurrentPeriodHotspots() {
        this.campusMap.clearHotspots();
        
        const periodData = this.getCurrentPeriodData();
        periodData.forEach(entry => {
            if (entry.idle_minutes > 1) {
                // Priority scaling: Commercial Area biggest, Brunei next, others smaller
                let base = Math.min(entry.idle_minutes / 20, 2.5);
                const name = entry.segment_end.trim();
                if (/Commercial Area/i.test(name)) base += 1.5;
                else if (/Brunei/i.test(name)) base += 0.8;
                else base += Math.random() * 0.3;
                this.campusMap.showIdleHotspot(entry.segment_end, base, 5000);
            }
        });
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = speed;
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        return this.isLooping;
    }

    updateUI() {
        // Update time period display
        document.getElementById('current-time').textContent = this.currentTimePeriod;
        document.getElementById('time-slider').value = this.currentTimePeriod;
        
        // Update scenario buttons
        document.getElementById('baseline-btn').classList.toggle('active', this.currentScenario === 'baseline');
        document.getElementById('optimized-btn').classList.toggle('active', this.currentScenario === 'optimized');
        
        // Update loop button
        document.getElementById('loop-btn').classList.toggle('active', this.isLooping);
    }

    getTimeLabel(period) {
        const startHour = 6; // 6 AM start
        const currentHour = startHour + Math.floor(period / 2);
        const minute = (period % 2) * 30;
        
        const hour12 = currentHour > 12 ? currentHour - 12 : currentHour;
        const ampm = currentHour >= 12 ? 'PM' : 'AM';
        
        return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
    }

    destroy() {
        this.pause();
        this.campusMap.clearHotspots();
    }
}
