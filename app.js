// Main Application - Coordinates all components and handles user interactions
class ShuttleVisualizationApp {
    constructor() {
        this.campusMap = null;
        this.animationController = null;
        
        this.initialize();
    }

    async initialize() {
        console.log('Initializing Campus Shuttle Visualization...');
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupApplication());
        } else {
            this.setupApplication();
        }
    }

    setupApplication() {
        // Initialize campus map
        this.campusMap = new CampusMap('campus-map');
        
        // Initialize animation controller
        this.animationController = new AnimationController(this.campusMap);
        
        // Wait a bit for data to load, then setup event listeners
        setTimeout(() => {
            this.setupEventListeners();
            this.animationController.updateUI();
            console.log('Application initialized successfully');
        }, 500);
    }

    setupEventListeners() {
        // Scenario toggle buttons
        document.getElementById('baseline-btn').addEventListener('click', () => {
            this.animationController.switchScenario('baseline');
            this.updateScenarioButtons('baseline');
        });

        document.getElementById('optimized-btn').addEventListener('click', () => {
            this.animationController.switchScenario('optimized');
            this.updateScenarioButtons('optimized');
        });

        // Animation control buttons
        document.getElementById('play-btn').addEventListener('click', () => {
            this.animationController.play();
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            this.animationController.pause();
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.animationController.resetAnimation();
        });

        document.getElementById('loop-btn').addEventListener('click', () => {
            const isLooping = this.animationController.toggleLoop();
            document.getElementById('loop-btn').classList.toggle('active', isLooping);
        });

        // Time scrubber
        document.getElementById('time-slider').addEventListener('input', (e) => {
            const period = parseInt(e.target.value);
            this.animationController.jumpToTimePeriod(period);
        });

        // Speed control
        document.getElementById('speed-slider').addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.animationController.setAnimationSpeed(speed);
            document.getElementById('speed-value').textContent = speed + 'x';
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Bus hover interactions
        this.setupBusHoverEffects();

        // Route highlighting on legend hover
        this.setupLegendInteractions();

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
    }

    setupBusHoverEffects() {
        // Add hover effects to buses
        const buses = this.campusMap.getAllBuses();
        buses.forEach(busId => {
            const busElement = document.getElementById(`bus-${busId}`);
            if (busElement) {
                busElement.addEventListener('mouseenter', () => {
                    this.showBusInfo(busId);
                });
                
                busElement.addEventListener('mouseleave', () => {
                    this.hideBusInfo();
                });
            }
        });
    }

    setupLegendInteractions() {
        const legendItems = document.querySelectorAll('.legend-item');
        legendItems.forEach((item, index) => {
            const routes = ['Route 1', 'Route 2', 'Route 3'];
            if (index < routes.length) {
                const routeName = routes[index];
                
                item.addEventListener('mouseenter', () => {
                    this.campusMap.highlightRoute(routeName);
                });
                
                item.addEventListener('mouseleave', () => {
                    this.campusMap.resetRouteHighlight();
                });
            }
        });
    }

    showBusInfo(busId) {
        // Get current period data for this bus
        const currentData = this.animationController.getCurrentPeriodData();
        const busData = currentData.find(entry => entry.bus_id === busId);
        
        if (busData) {
            // Create or update info tooltip
            let tooltip = document.getElementById('bus-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'bus-tooltip';
                tooltip.className = 'bus-tooltip';
                document.body.appendChild(tooltip);
            }

            tooltip.innerHTML = `
                <strong>${busId.replace('_', ' ')}</strong><br>
                Route: ${busData.route}<br>
                Current: ${busData.segment_start} → ${busData.segment_end}<br>
                Fuel: ${busData.fuel_liters.toFixed(1)}L<br>
                Idle: ${busData.idle_minutes.toFixed(1)} min<br>
                Emissions: ${busData.emissions_kgCO2e.toFixed(1)} kg CO₂e
            `;

            tooltip.style.display = 'block';
            
            // Position tooltip near mouse
            document.addEventListener('mousemove', this.updateTooltipPosition);
        }
    }

    hideBusInfo() {
        const tooltip = document.getElementById('bus-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
            document.removeEventListener('mousemove', this.updateTooltipPosition);
        }
    }

    updateTooltipPosition(e) {
        const tooltip = document.getElementById('bus-tooltip');
        if (tooltip) {
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY - 10) + 'px';
        }
    }

    handleKeyboardShortcuts(e) {
        // Prevent shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT') return;

        switch (e.key) {
            case ' ': // Spacebar - play/pause
                e.preventDefault();
                if (this.animationController.isPlaying) {
                    this.animationController.pause();
                } else {
                    this.animationController.play();
                }
                break;
                
            case 'r': // R - reset
                this.animationController.resetAnimation();
                break;
                
            case 'l': // L - toggle loop
                const isLooping = this.animationController.toggleLoop();
                document.getElementById('loop-btn').classList.toggle('active', isLooping);
                break;
                
            case '1': // 1 - baseline scenario
                this.animationController.switchScenario('baseline');
                this.updateScenarioButtons('baseline');
                break;
                
            case '2': // 2 - optimized scenario
                this.animationController.switchScenario('optimized');
                this.updateScenarioButtons('optimized');
                break;
                
            case 'ArrowLeft': // Left arrow - previous time period
                e.preventDefault();
                const prevPeriod = Math.max(0, this.animationController.currentTimePeriod - 1);
                this.animationController.jumpToTimePeriod(prevPeriod);
                break;
                
            case 'ArrowRight': // Right arrow - next time period
                e.preventDefault();
                const nextPeriod = Math.min(this.animationController.maxTimePeriod, this.animationController.currentTimePeriod + 1);
                this.animationController.jumpToTimePeriod(nextPeriod);
                break;
        }
    }

    updateScenarioButtons(activeScenario) {
        document.getElementById('baseline-btn').classList.toggle('active', activeScenario === 'baseline');
        document.getElementById('optimized-btn').classList.toggle('active', activeScenario === 'optimized');
    }

    handleWindowResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            // Handle responsive adjustments if needed
            console.log('Window resized, adjusting layout...');
        }, 250);
    }

    // Utility methods
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Position and show
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    exportCurrentState() {
        // Export current animation state for sharing/saving
        return {
            scenario: this.animationController.currentScenario,
            timePeriod: this.animationController.currentTimePeriod,
            isPlaying: this.animationController.isPlaying,
            isLooping: this.animationController.isLooping,
            animationSpeed: this.animationController.animationSpeed,
            metrics: this.animationController.cumulativeMetrics
        };
    }

    loadState(state) {
        // Load a previously exported state
        try {
            this.animationController.switchScenario(state.scenario);
            this.animationController.jumpToTimePeriod(state.timePeriod);
            this.animationController.setAnimationSpeed(state.animationSpeed);
            
            if (state.isLooping !== this.animationController.isLooping) {
                this.animationController.toggleLoop();
            }
            
            this.updateScenarioButtons(state.scenario);
            document.getElementById('speed-slider').value = state.animationSpeed;
            document.getElementById('speed-value').textContent = state.animationSpeed + 'x';
            
            console.log('State loaded successfully');
        } catch (error) {
            console.error('Error loading state:', error);
            this.showNotification('Error loading state', 'error');
        }
    }

    // Performance monitoring
    trackPerformance() {
        const metrics = {
            memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 'N/A',
            timestamp: Date.now(),
            busCount: this.campusMap.getAllBuses().length,
            activeHotspots: Object.keys(this.campusMap.hotspots).length
        };
        
        console.log('Performance metrics:', metrics);
        return metrics;
    }

    // Cleanup method
    destroy() {
        if (this.animationController) {
            this.animationController.destroy();
        }
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        window.removeEventListener('resize', this.handleWindowResize);
        
        console.log('Application destroyed');
    }
}

// CSS for tooltips (injected dynamically)
const tooltipStyles = `
    .bus-tooltip {
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-family: 'Segoe UI', sans-serif;
        z-index: 1000;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: none;
    }
    
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        animation: slideInNotification 0.3s ease-out;
    }
    
    .notification-info { background: #2196F3; }
    .notification-success { background: #4CAF50; }
    .notification-warning { background: #FF9800; }
    .notification-error { background: #F44336; }
    
    @keyframes slideInNotification {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;

// Inject tooltip styles
const styleSheet = document.createElement('style');
styleSheet.textContent = tooltipStyles;
document.head.appendChild(styleSheet);

// Initialize the application
let shuttleApp;

// Start the application when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        shuttleApp = new ShuttleVisualizationApp();
    });
} else {
    shuttleApp = new ShuttleVisualizationApp();
}

// Global error handling
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    if (shuttleApp) {
        shuttleApp.showNotification('An error occurred. Check console for details.', 'error');
    }
});

// Expose app globally for debugging
window.shuttleApp = shuttleApp;
