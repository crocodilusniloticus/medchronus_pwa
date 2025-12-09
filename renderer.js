const { ipcRenderer } = require('electron');

window.ipcRenderer = ipcRenderer;

// --- CRITICAL FIX: Load Standard Flatpickr Only ---
try {
    // 1. Load the standard, stable calendar engine
    window.flatpickr = require('flatpickr'); 
    
    // 2. Load your custom Persian labels (the ones we fixed in js/fa.js)
    require('./js/fa.js'); 
    
    // 3. Load JDate for the math (needed for the visual conversion)
    window.JDate = require('jdate');

} catch (e) {
    console.error("CRITICAL: Failed to load dependencies.", e);
}
// --------------------------------------------------

window.echarts = require('echarts');
const { createPopper } = require('@popperjs/core');
const tippy = require('tippy.js').default; 
window.tippy = tippy;

function initializeApp() {
    if (window.isAppInitialized) {
        return;
    }

    const preFlightCheck = () => {
        const errors = [];
        if (!window.flatpickr) errors.push('Calendar library failed to load. Did you run "npm install"?');
        if (!window.echarts) errors.push('ECharts failed to load.');
        
        if (errors.length > 0) {
            throw new Error('Startup Failed:\n' + errors.join('\n'));
        }
    };

    try {
        preFlightCheck(); 

        const state = require('./js/state');
        const refs = require('./js/uiRefs');
        const dataManager = require('./js/dataManager');
        const charts = require('./js/charts');
        const timers = require('./js/timers');
        const modals = require('./js/modals');
        const views = require('./js/views');
        const listeners = require('./js/listeners');
        const tools = require('./js/tools'); 

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

        dataManager.init(state, refs);
        charts.init(state, refs); 
        charts.initializeCharts(); 
        charts.setPieMode(state.pieChartMode);

        timers.init(state, refs, dataManager.logSession, modals.playAlarm, updateAllDisplays, dataManager.saveData, dataManager.saveTimerProgress);
        views.init(state, refs, modals.showEventModal, dataManager.logSession);
        modals.init(state, refs, dataManager, updateAllDisplays, charts.getTimeChartOptions, charts.getScoreChartOptions, charts.getCharts, charts.getTrendChartOptions);
        
        listeners.init(state, refs, timers, modals, charts, views, dataManager, updateAllDisplays);       
        tools.initToolsListeners(); 

        dataManager.loadData();
        dataManager.checkForRecoveredSession();
        views.populateCourses();
        views.initializeCalendar();
        views.initializeEventModalPicker();
        views.initializeGlobalTooltips();
        
        updateAllDisplays(); 
        
        window.isAppInitialized = true;

        setTimeout(() => {
            if (charts.getCharts().timeChart) charts.getCharts().timeChart.resize();
            if (charts.getCharts().scoreChart) charts.getCharts().scoreChart.resize();
        }, 50);

    } catch (error) {
        document.body.innerHTML = `
            <div style="padding: 20px; font-family: sans-serif; background: #fff1f2; color: #9f1239; height: 100vh; text-align: center;">
                <h2>Startup Error</h2>
                <p>Could not initialize the app.</p>
                <pre style="background: #333; color: #fff; padding: 15px; text-align: left;">${error.stack}</pre>
            </div>
        `;
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);