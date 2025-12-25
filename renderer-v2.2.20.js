import { state } from './js/state-v2.2.20.js';
import refs from './js/uiRefs-v2.2.20.js';
import * as dataManager from './js/dataManager-v2.2.20.js';
import * as charts from './js/charts-v2.2.20.js';
import * as timers from './js/timers-v2.2.20.js';
import * as modals from './js/modals-v2.2.20.js';
import * as views from './js/views-v2.2.20.js';
import * as listeners from './js/listeners-v2.2.20.js';
import * as tools from './js/tools-v2.2.20.js';
import * as manual from './js/manual-v2.2.20.js';
import * as quotes from './js/quotes-v2.2.20.js';
import * as syncModal from './js/syncModal-v2.2.20.js';
import * as authModal from './js/authModal-v2.2.20.js';
import { supabase } from './js/supabaseClient-v2.2.20.js';
import { initGoogleClients } from './js/googleSync-v2.2.20.js'; // FIX: Import Google Init
import './js/fa-v2.2.20.js'; 

window.state = state;

function initializeApp() {
    if (window.isAppInitialized) return;

    try {
        console.log("Initializing MedChronos PWA...");

        setTimeout(() => {
            initGoogleClients();
            if (localStorage.getItem('google_auth_active') === 'true') {
                import('./js/googleSync-v2.2.20.js').then(module => {
                    module.handleAuthClick().catch(e => console.log("Auto-restore silent auth failed"));
                });
            }
        }, 1000);

        manual.init();
        quotes.init('quote-container');
        syncModal.inject(); 
        authModal.injectAuthModal();

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

        document.getElementById('cloud-auth-btn').addEventListener('click', async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                const confirmLogout = confirm("You are logged in to Cloud Storage. Log out?");
                if (confirmLogout) {
                    await supabase.auth.signOut();
                    authModal.updateAuthButtonState(false);
                    alert("Logged out of Cloud Storage.");
                }
            } else {
                modals.hideSettingsModal();
                authModal.showAuthModal();
            }
        });

        // Initialize Modules
        dataManager.init(state, refs);
        charts.init(state, refs); 
        charts.initializeCharts(); 
        charts.setPieMode(state.pieChartMode);
        
        // Pass dependencies to Timers
        timers.init(state, refs, dataManager.logSession, modals.playAlarm, updateAllDisplays, dataManager.saveData, dataManager.saveTimerProgress);
        
        views.init(state, refs, modals.showEventModal, dataManager.logSession);
        modals.init(state, refs, dataManager, updateAllDisplays, charts.getTimeChartOptions, charts.getScoreChartOptions, charts.getCharts, charts.getTrendChartOptions);
        listeners.init(state, refs, timers, modals, charts, views, dataManager, updateAllDisplays);       
        tools.initToolsListeners(); 
        
        // CRITICAL ORDER:
        // 1. Load Data
        dataManager.loadData();
        // 2. Recover Session State (Logic)
        dataManager.checkForRecoveredSession();
        // 3. Restore UI based on recovered state (Visuals)
        timers.restoreTimerState();
        
        // Initial Auth Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                authModal.updateAuthButtonState(true);
                dataManager.syncWithSupabase();
            }
        });

        window.addEventListener('data-updated', () => { updateAllDisplays(); });
        
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