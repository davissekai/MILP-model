// Campus Map Module - Creates and manages the SVG campus layout
class CampusMap {
    constructor(svgId) {
        this.svg = document.getElementById(svgId);
        this.stops = {};
        this.routes = {};
        this.buses = {};
        this.hotspots = {};
        
        this.initialize();
    }

    async initialize() {
        // Initial fallback stop positions; will be replaced if route_data.md is present
        this.stopPositions = {
            'Commercial Area': { x: 150, y: 300 },
            'Unity Hall': { x: 300, y: 250 },
            'Library Plaza': { x: 450, y: 200 },
            'Student Center': { x: 600, y: 250 },
            'North Dorms': { x: 200, y: 100 },
            'South Dorms': { x: 300, y: 450 },
            'East Parking': { x: 550, y: 400 },
            'West Campus': { x: 100, y: 200 },
            'Engineering Building': { x: 650, y: 150 },
            'Science Complex': { x: 700, y: 300 },
            'Arts Building': { x: 600, y: 450 },
            'Business School': { x: 500, y: 350 }
        };

        // Fallback route segments; will be replaced if route_data.md is present
        this.routeSegments = {
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

        // Route colors (neutral, readable)
        this.routeColors = {
            'Route 1': '#007A33', // KNUST Green
            'Route 2': '#FFC72C', // KNUST Yellow
            'Route 3': '#006400' // Darker green variant
        };

        // Try to load real route/stop data and background map
        await this.loadRouteDataAndMap();
        this.createMap();
    }

    createMap() {
        // Clear existing content
        this.svg.innerHTML = '';

        // Create background grid
        this.createGrid();

        // Draw background map image if available
        if (this.mapImageHref) {
            const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.mapImageHref);
            image.setAttribute('href', this.mapImageHref);
            image.setAttribute('x', '0');
            image.setAttribute('y', '0');
            image.setAttribute('width', '100%');
            image.setAttribute('height', '100%');
            image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
            this.svg.appendChild(image);
        }

        // Create a dedicated layer for routes (initially empty; we draw when playing)
        this.routesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.routesLayer.setAttribute('id', 'routes-layer');
        this.svg.appendChild(this.routesLayer);

        // Draw stops
        this.drawStops();

        // Initialize bus positions
        this.initializeBuses();
    }

    createGrid() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'grid');
        pattern.setAttribute('width', '40');
        pattern.setAttribute('height', '40');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 40 0 L 0 0 0 40');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#f0f0f0');
        path.setAttribute('stroke-width', '1');

        pattern.appendChild(path);
        defs.appendChild(pattern);
        this.svg.appendChild(defs);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', 'url(#grid)');
        this.svg.appendChild(rect);
    }

    drawRouteSegments() {
        if (!this.routesLayer) return;
        // Ensure layer is empty before drawing
        this.clearRouteSegments();
        Object.entries(this.routeSegments).forEach(([routeName, segments]) => {
            const color = this.routeColors[routeName] || '#FFC72C';
            const routeClass = `route-${routeName.toLowerCase().replace(/\s+/g, '-')}`;

            segments.forEach(([start, end]) => {
                const startPos = this.stopPositions[start];
                const endPos = this.stopPositions[end];
                if (!startPos || !endPos) {
                    console.warn('Skipping segment with missing stop position:', start, '->', end);
                    return;
                }

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', startPos.x);
                line.setAttribute('y1', startPos.y);
                line.setAttribute('x2', endPos.x);
                line.setAttribute('y2', endPos.y);
                line.setAttribute('class', `route-segment ${routeClass}`);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '8');
                line.setAttribute('stroke-linecap', 'round');

                this.routesLayer.appendChild(line);
            });
        });
    }

    clearRouteSegments() {
        if (!this.routesLayer) return;
        while (this.routesLayer.firstChild) {
            this.routesLayer.removeChild(this.routesLayer.firstChild);
        }
    }

    drawStops() {
        Object.entries(this.stopPositions).forEach(([stopName, pos]) => {
            // Create stop circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pos.x);
            circle.setAttribute('cy', pos.y);
            circle.setAttribute('r', 8);
            circle.setAttribute('class', 'stop-node');
            circle.setAttribute('id', `stop-${stopName.replace(/\s+/g, '-')}`);

            // Create stop label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y - 20);
            text.setAttribute('class', 'stop-label');
            text.textContent = stopName;

            this.svg.appendChild(circle);
            this.svg.appendChild(text);
            
            this.stops[stopName] = { element: circle, position: pos };
        });
    }

    initializeBuses() {
        const busTypes = {
            'Neoplan_1': { color: '#007A33', route: 'Route 1' },
            'Nissan_2': { color: '#FFC72C', route: 'Route 2' },
            'Mercedes_3': { color: '#006400', route: 'Route 3' }
        };

        Object.entries(busTypes).forEach(([busId, config]) => {
            const bus = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            bus.setAttribute('class', 'bus-icon');
            bus.setAttribute('id', `bus-${busId}`);

            // Bus body (rectangle)
            const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            body.setAttribute('width', '20');
            body.setAttribute('height', '12');
            body.setAttribute('rx', '3');
            body.setAttribute('fill', config.color);
            body.setAttribute('stroke', 'white');
            body.setAttribute('stroke-width', '1');

            // Bus windows
            const window1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            window1.setAttribute('x', '2');
            window1.setAttribute('y', '2');
            window1.setAttribute('width', '6');
            window1.setAttribute('height', '8');
            window1.setAttribute('fill', '#87CEEB');
            window1.setAttribute('rx', '1');

            const window2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            window2.setAttribute('x', '12');
            window2.setAttribute('y', '2');
            window2.setAttribute('width', '6');
            window2.setAttribute('height', '8');
            window2.setAttribute('fill', '#87CEEB');
            window2.setAttribute('rx', '1');

            // Bus label
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', '10');
            label.setAttribute('y', '-5');
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '10');
            label.setAttribute('font-weight', 'bold');
            label.setAttribute('fill', config.color);
            label.textContent = busId.replace('_', ' ');

            bus.appendChild(body);
            bus.appendChild(window1);
            bus.appendChild(window2);
            bus.appendChild(label);

            // Initially position at first stop of their route
            const firstStop = this.getRouteFirstStop(config.route);
            if (firstStop) {
                const pos = this.stopPositions[firstStop];
                bus.setAttribute('transform', `translate(${pos.x - 10}, ${pos.y - 6})`);
            }

            this.svg.appendChild(bus);
            this.buses[busId] = {
                element: bus,
                currentStop: firstStop,
                route: config.route,
                color: config.color
            };
        });
    }

    getRouteFirstStop(routeName) {
        const segments = this.routeSegments[routeName];
        return segments && segments[0] ? segments[0][0] : null;
    }

    moveBus(busId, fromStop, toStop, travelTime = 1000) {
        const bus = this.buses[busId];
        if (!bus || !this.stopPositions[fromStop] || !this.stopPositions[toStop]) {
            return Promise.resolve();
        }

        const fromPos = this.stopPositions[fromStop];
        const toPos = this.stopPositions[toStop];

        return new Promise((resolve) => {
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / travelTime, 1);
                // Smooth ease-out
                const eased = 1 - Math.pow(1 - progress, 3);

                const currentX = fromPos.x + (toPos.x - fromPos.x) * eased;
                const currentY = fromPos.y + (toPos.y - fromPos.y) * eased;

                bus.element.setAttribute('transform', `translate(${currentX - 10}, ${currentY - 6})`);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    bus.currentStop = toStop;
                    resolve();
                }
            };

            animate();
        });
    }

    showIdleHotspot(stopName, intensity = 1, duration = 2000) {
        const pos = this.stopPositions[stopName];
        if (!pos) return;

        const hotspotId = `hotspot-${stopName.replace(/\s+/g, '-')}-${Date.now()}`;
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', 15 + intensity * 5);
        circle.setAttribute('class', 'idle-hotspot');
        circle.setAttribute('id', hotspotId);
        circle.style.opacity = Math.min(intensity * 0.8, 1);

        this.svg.appendChild(circle);
        this.hotspots[hotspotId] = circle;

        // Remove hotspot after duration
        setTimeout(() => {
            if (this.hotspots[hotspotId]) {
                this.svg.removeChild(this.hotspots[hotspotId]);
                delete this.hotspots[hotspotId];
            }
        }, duration);
    }

    clearHotspots() {
        Object.values(this.hotspots).forEach(hotspot => {
            if (hotspot.parentNode) {
                this.svg.removeChild(hotspot);
            }
        });
        this.hotspots = {};
    }

    highlightRoute(routeName) {
        // Reset all route segments
        const allSegments = this.svg.querySelectorAll('.route-segment');
        allSegments.forEach(segment => {
            segment.style.opacity = '0.3';
            segment.style.strokeWidth = '4';
        });

        // Highlight selected route
        const routeClass = `route-${routeName.toLowerCase().replace(/\s+/g, '-')}`;
        const routeSegments = this.svg.querySelectorAll(`.${routeClass}`);
        routeSegments.forEach(segment => {
            segment.style.opacity = '1';
            segment.style.strokeWidth = '6';
        });
    }

    resetRouteHighlight() {
        const allSegments = this.svg.querySelectorAll('.route-segment');
        allSegments.forEach(segment => {
            segment.style.opacity = '0.8';
            segment.style.strokeWidth = '4';
        });
    }

    getBusPosition(busId) {
        const bus = this.buses[busId];
        return bus ? bus.currentStop : null;
    }

    getAllBuses() {
        return Object.keys(this.buses);
    }

    getStopPosition(stopName) {
        return this.stopPositions[stopName];
    }

    calculateDistance(stop1, stop2) {
        const pos1 = this.stopPositions[stop1];
        const pos2 = this.stopPositions[stop2];
        if (!pos1 || !pos2) return 0;
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    async loadRouteDataAndMap() {
        try {
            // Prefer map.jpg if present
            this.mapImageHref = 'map.jpg';
            // Fetch route_data.md
            const resp = await fetch('route_data.md');
            if (!resp.ok) return;
            const text = await resp.text();
            // Parse coordinates
            const lines = text.split(/\r?\n/);
            const coordRegex = /^(.*?):\s*([0-9.]+)°\s*N,\s*(-?[0-9.]+)°\s*W/i;
            const stops = {};
            let inRoutes = false;
            const routes = {};
            for (const line of lines) {
                if (line.trim().startsWith('# Routes')) { inRoutes = true; continue; }
                if (!inRoutes) {
                    const m = line.match(coordRegex);
                    if (m) {
                        const name = m[1].trim().replace(/\s+/g, ' ');
                        const lat = parseFloat(m[2]);
                        const lonW = parseFloat(m[3]);
                        const lon = -Math.abs(lonW); // W is negative
                        stops[name] = { lat, lon };
                    }
                } else {
                    const routeMatch = line.match(/^Route\s*(\d+)\s*:(.*)$/i);
                    if (routeMatch) {
                        const routeNum = routeMatch[1];
                        const seqRaw = routeMatch[2]
                            .replace(/\u003c-\u003e/g, '\u003c-\u003e') // just in case
                            .trim();
                        // Alias map for shortened campus names -> canonical names from coordinates
                        const alias = {
                            'Comm. Area': 'Commercial Area',
                            'CoS': 'College of Science',
                            'KSB': 'School of Business (KSB)',
                            'Katanga Hall': 'Casely Hayford'
                        };
                        const parts = seqRaw.split('\u003c-\u003e').map(p => (alias[p.trim()] || p.trim()));
                        // Build segments pairwise and keep only those with known coordinates
                        const segments = [];
                        for (let i = 0; i < parts.length - 1; i++) {
                            const a = parts[i];
                            const b = parts[i+1];
                            if (stops[a] && stops[b]) {
                                segments.push([a, b]);
                            } else {
                                console.warn('Skipping route step without coords:', a, '->', b);
                            }
                        }
                        routes[`Route ${routeNum}`] = segments;
                    }
                }
            }
            // Project lat/lon to screen coords
            const stopNames = Object.keys(stops);
            if (stopNames.length) {
                const lats = stopNames.map(n => stops[n].lat);
                const lons = stopNames.map(n => stops[n].lon);
                const minLat = Math.min(...lats), maxLat = Math.max(...lats);
                const minLon = Math.max(...lons); // less negative is max west? we handle below
                const maxLon = Math.min(...lons);
                const width = this.svg.viewBox.baseVal && this.svg.viewBox.baseVal.width ? this.svg.viewBox.baseVal.width : this.svg.clientWidth;
                const height = this.svg.viewBox.baseVal && this.svg.viewBox.baseVal.height ? this.svg.viewBox.baseVal.height : this.svg.clientHeight;
                const pad = 40;
                const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
                const latMin = Math.min(...lats), latMax = Math.max(...lats);
                
                const xScale = (lon) => pad + ( (lon - lonMin) / (lonMax - lonMin) ) * (width - 2*pad);
                const yScale = (lat) => pad + ( (latMax - lat) / (latMax - latMin) ) * (height - 2*pad);
                
                const projected = {};
                for (const name of stopNames) {
                    const { lat, lon } = stops[name];
                    projected[name] = { x: xScale(lon), y: yScale(lat) };
                }
                // Use ONLY stops from route_data.md as requested
                this.stopPositions = projected;
            }
            if (Object.keys(routes).length) {
                this.routeSegments = routes;
            }
        } catch (e) {
            console.warn('Could not load route_data.md or map image:', e);
        }
    }
}
