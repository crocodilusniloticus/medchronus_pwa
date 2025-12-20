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
import * as authModal from './js/authModal.js'; // NEW
import { supabase } from './js/supabaseClient.js'; // NEW
import './js/fa.js'; 

window.state = state;

function initializeApp() {
    if (window.isAppInitialized) return;

    try {
        console.log("Initializing MedChronos PWA...");

        manual.init();
        quotes.init('quote-container');
        syncModal.inject(); 
        authModal.injectAuthModal(); // Inject Auth Modal

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

        // UI Event listener for the new Cloud Button
        document.getElementById('cloud-auth-btn').addEventListener('click', async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                // If already logged in, maybe ask to logout? 
                const confirmLogout = confirm("You are logged in. Log out?");
                if (confirmLogout) {
                    await supabase.auth.signOut();
                    authModal.updateAuthButtonState(false);
                    alert("Logged out of Cloud Sync.");
                }
            } else {
                modals.hideSettingsModal(); // Close settings to show auth
                authModal.showAuthModal();
            }
        });

        // Initialize Modules
        dataManager.init(state, refs);
        charts.init(state, refs); 
        charts.initializeCharts(); 
        charts.setPieMode(state.pieChartMode);
        timers.init(state, refs, dataManager.logSession, modals.playAlarm, updateAllDisplays, dataManager.saveData, dataManager.saveTimerProgress);
        views.init(state, refs, modals.showEventModal, dataManager.logSession);
        modals.init(state, refs, dataManager, updateAllDisplays, charts.getTimeChartOptions, charts.getScoreChartOptions, charts.getCharts, charts.getTrendChartOptions);
        listeners.init(state, refs, timers, modals, charts, views, dataManager, updateAllDisplays);       
        tools.initToolsListeners(); 
        
        // Load Data
        dataManager.loadData();
        dataManager.checkForRecoveredSession();
        
        // Initial Auth Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                authModal.updateAuthButtonState(true);
                dataManager.syncWithSupabase(); // Auto-sync on startup if logged in
            }
        });

        // Listen for data updates from sync
        window.addEventListener('data-updated', () => {
            updateAllDisplays();
        });
        
        views.populateCourses();
        views.initializeCalendar();
        views.initializeEventModalPicker();
        views.initializeGlobalTooltips();
        
        updateAllDisplays(); 
        
        window.isAppInitialized = true;

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