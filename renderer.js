// renderer.js - PWA Entry Point

import { state } from './js/state.js';
import refs from './js/uiRefs.js';
import * as dataManager from './js/dataManager.js';
import * as charts from './js/charts.js';
import * as timers from './js/timers.js';
import * as modals from './js/modals.js';
import * as views from './js/views.js';
import * as listeners from './js/listeners.js';
import * as tools from './js/tools.js';
import * as manual from './js/manual.js';
import * as quotes from './js/quotes.js';
import * as syncModal from './js/syncModal.js';
import './js/fa.js'; // <--- CRITICAL FIX: Registers the Persian Locale

// Expose state globally for debugging
window.state = state;

function initializeApp() {
    if (window.isAppInitialized) return;

    try {
        console.log("Initializing MedChronos PWA...");

        // 1. INJECT HTML COMPONENTS
        manual.init();
        quotes.init('quote-container');
        syncModal.inject(); 

        // 2. DEFINE UPDATE LOGIC
        const updateAllDisplays = () => {
            views.populateCourses(); 
            views.updateLogDisplay(); 
            views.updateCalendar(); 
            charts.updateTimeChart(); 
            charts.updateScoreChart(); 
            views.updateTaskDashboard(); 
            views.updateCourseEditorList();
            views.updateStreakDisplay();
            if(timers && timers.updatePomodoroDisplay) timers.updatePomodoroDisplay();
        };

        // 3. INITIALIZE MODULES
        dataManager.init(state, refs);
        
        // Charts Init
        charts.init(state, refs); 
        charts.initializeCharts(); // <--- FIX: Run immediately so objects exist
        charts.setPieMode(state.pieChartMode);

        timers.init(state, refs, dataManager.logSession, modals.playAlarm, updateAllDisplays, dataManager.saveData, dataManager.saveTimerProgress);
        views.init(state, refs, modals.showEventModal, dataManager.logSession);
        
        modals.init(state, refs, dataManager, updateAllDisplays, charts.getTimeChartOptions, charts.getScoreChartOptions, charts.getCharts, charts.getTrendChartOptions);
        
        listeners.init(state, refs, timers, modals, charts, views, dataManager, updateAllDisplays);       
        tools.initToolsListeners(); 
        
        // 4. LOAD DATA & RENDER
        dataManager.loadData();
        dataManager.checkForRecoveredSession();
        
        // Final Render
        views.populateCourses();
        views.initializeCalendar();
        views.initializeEventModalPicker();
        views.initializeGlobalTooltips();
        
        updateAllDisplays(); 
        
        window.isAppInitialized = true;
        console.log("App Initialized Successfully.");

        // Handle Window Resize for Charts
        window.addEventListener('resize', () => {
            const chartData = charts.getCharts();
            if (chartData.timeChart) chartData.timeChart.resize();
            if (chartData.scoreChart) chartData.scoreChart.resize();
        });

    } catch (error) {
        console.error("Startup Error:", error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}