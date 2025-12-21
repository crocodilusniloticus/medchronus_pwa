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
import * as authModal from './js/authModal.js';
import { supabase } from './js/supabaseClient.js';
import { initGoogleClients } from './js/googleSync.js'; // FIX: Import Google Init
import './js/fa.js'; 

window.state = state;

function initializeApp() {
    if (window.isAppInitialized) return;

    try {
        console.log("Initializing MedChronos PWA...");

        // FIX: Initialize Google API Clients immediately
        // We use a slight delay to ensure the async scripts in index.html have loaded
       setTimeout(() => {
    initGoogleClients();
    
        // Auto-Restore: If user was logged in, just nudge the connection
        if (localStorage.getItem('google_auth_active') === 'true') {
        import('./js/googleSync.js').then(module => {
            // This attempts a silent handshake in the background
            module.handleAuthClick().catch(e => console.log("Auto-restore silent auth failed (normal if offline)"));
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

        // UI Event listener for the new Cloud Button (Supabase)
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
        timers.init(state, refs, dataManager.logSession, modals.playAlarm, updateAllDisplays, dataManager.saveData, dataManager.saveTimerProgress);
        views.init(state, refs, modals.showEventModal, dataManager.logSession);
        modals.init(state, refs, dataManager, updateAllDisplays, charts.getTimeChartOptions, charts.getScoreChartOptions, charts.getCharts, charts.getTrendChartOptions);
        
        // FIX: Pass dataManager to listeners so we can save after sync
        listeners.init(state, refs, timers, modals, charts, views, dataManager, updateAllDisplays);       
        
        tools.initToolsListeners(); 
        
        // Load Data
        dataManager.loadData();
        dataManager.checkForRecoveredSession();
        
        // Initial Auth Check (Supabase)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                authModal.updateAuthButtonState(true);
                dataManager.syncWithSupabase();
            }
        });

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