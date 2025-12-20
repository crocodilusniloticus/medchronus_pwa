import * as googleSync from './googleSync.js';

let refs, timers, modals, charts, views, dataManager, state, updateAllDisplays;
let statusTimeout = null;

export function init(appState, uiRefs, timerFuncs, modalFuncs, chartFuncs, viewFuncs, dataMgr, updateAllDisplaysFn) {
    state = appState;
    refs = uiRefs;
    timers = timerFuncs;
    modals = modalFuncs;
    charts = chartFuncs;
    views = viewFuncs;
    dataManager = dataMgr; 
    updateAllDisplays = updateAllDisplaysFn;

    // Initialize Google Clients
    setTimeout(() => {
        try {
            googleSync.initGoogleClients();
        } catch (e) {
            console.warn("Google Sync Init deferred:", e);
        }
    }, 1000);

    const restoreFocus = () => {
        if (document.activeElement) { document.activeElement.blur(); }
        window.focus(); document.body.focus(); 
    };

    const setStatus = (text, isError = false) => {
        if(refs.syncStatus) {
            if (statusTimeout) clearTimeout(statusTimeout);
            refs.syncStatus.textContent = text;
            refs.syncStatus.style.color = isError ? 'var(--danger)' : 'var(--primary)';
            refs.syncStatus.style.opacity = '1';
            statusTimeout = setTimeout(() => { 
                if(refs.syncStatus) refs.syncStatus.style.opacity = '0'; 
            }, 3000);
        }
    };

    const triggerCloudSync = async (silent = false) => {
        if (!refs.syncBtn) return;
        
        if (!navigator.onLine) {
            if (!silent) setStatus("Offline", true);
            return;
        }

        if (!silent) {
            setStatus("Syncing...");
            refs.syncBtn.style.opacity = "0.5";
            refs.syncBtn.disabled = true; // Prevent double clicks
        }

        try {
            const result = await googleSync.pushEventsToGoogle(state.allEvents);
            
            if (result.success && result.stats) {
                if (result.stats.updatedEvents && result.stats.updatedEvents.length > 0) {
                    result.stats.updatedEvents.forEach(updatedEvent => {
                        const localIndex = state.allEvents.findIndex(e => e.timestamp === updatedEvent.timestamp);
                        if(localIndex > -1) {
                            state.allEvents[localIndex].googleId = updatedEvent.googleId;
                            state.allEvents[localIndex].isSynced = true;
                        }
                    });
                    dataManager.saveData(); 
                }
                const totalChanges = result.stats.updatedEvents ? result.stats.updatedEvents.length : 0;
                setStatus(totalChanges > 0 ? "Synced" : "Synced (Up to date)");
            } else {
                if (!silent && result.error !== "Login Cancelled") {
                    setStatus(result.error || "Sync Failed", true);
                } else if (!silent) {
                    setStatus("Cancelled", true);
                }
            }
        } catch (err) {
            console.warn("Auto-Sync Error:", err);
            setStatus("Sync Error", true); 
        } finally {
            if (refs.syncBtn) {
                refs.syncBtn.style.opacity = "1";
                refs.syncBtn.disabled = false;
            }
        }
    };

    const checkAndTriggerSync = () => {
        const hasAccepted = localStorage.getItem('hasAcceptedSyncTerms');
        if (hasAccepted === 'true') {
            triggerCloudSync(true); 
        }
    };

    const addSafeListener = (element, event, handler) => {
        if (element) element.addEventListener(event, handler);
    };

    // --- LISTENERS ---
    addSafeListener(refs.saveEventButton, 'click', () => { modals.saveEvent(); restoreFocus(); checkAndTriggerSync(); });
    addSafeListener(refs.saveEditButton, 'click', () => { modals.saveEdit(); restoreFocus(); checkAndTriggerSync(); });

    addSafeListener(refs.taskList, 'click', (event) => { 
        const doneBtn = event.target.closest('.task-done-btn'); 
        const recoverBtn = event.target.closest('.task-recover-btn');
        const deleteBtn = event.target.closest('.task-delete-btn'); 
        const editBtn = event.target.closest('.task-edit-btn'); 
        
        if (doneBtn) { 
            const ts = doneBtn.dataset.timestamp; 
            const eventIndex = state.allEvents.findIndex(e => e.timestamp === ts); 
            if (eventIndex > -1) { 
                state.allEvents[eventIndex].isDone = true; 
                dataManager.saveData(); updateAllDisplays(); checkAndTriggerSync(); 
            } 
        } 
        else if (recoverBtn) {
            const ts = recoverBtn.dataset.timestamp; 
            const eventIndex = state.allEvents.findIndex(e => e.timestamp === ts); 
            if (eventIndex > -1) { 
                state.allEvents[eventIndex].isDone = false;
                state.allEvents[eventIndex].isSynced = false; 
                state.allEvents[eventIndex].googleId = null;  
                dataManager.saveData(); updateAllDisplays(); checkAndTriggerSync(); 
            }
        }
        else if (deleteBtn) { 
            const ts = deleteBtn.dataset.timestamp; 
            modals.showConfirmModal(ts, false, 'task_permanent'); 
        } 
        else if (editBtn) { 
            const ts = editBtn.dataset.timestamp; 
            modals.showEventModal(null, ts); 
        } 
    });

    addSafeListener(refs.confirmDeleteButton, 'click', async () => { 
        const identifier = refs.itemToProcess.value; 
        const itemType = refs.itemToProcess.dataset.itemType || 'log'; 
        if (!identifier) return; 
        modals.hideConfirmModal(); restoreFocus();
        try {
            if (itemType === 'course') { modals.deleteCourse(identifier); } 
            else if (itemType === 'task_permanent') { 
                state.allEvents = state.allEvents.filter(e => e.timestamp !== identifier); 
                dataManager.saveData(); updateAllDisplays(); 
            } else { 
                dataManager.deleteItem(identifier); updateAllDisplays(); 
            }
            setStatus("Deleted");
        } catch (e) { console.error(e); setStatus("Error Deleting", true); }
    });

    addSafeListener(refs.syncBtn, 'click', () => {
        const hasAccepted = localStorage.getItem('hasAcceptedSyncTerms');
        if (hasAccepted === 'true') {
            triggerCloudSync(false); restoreFocus();
        } else {
            modals.showSyncOnboarding();
        }
    });

    addSafeListener(refs.confirmSyncSetupBtn, 'click', () => {
        localStorage.setItem('hasAcceptedSyncTerms', 'true');
        modals.hideSyncOnboarding();
        restoreFocus();
        triggerCloudSync(false);
    });

    addSafeListener(refs.cancelSyncSetupBtn, 'click', () => { modals.hideSyncOnboarding(); restoreFocus(); });

    addSafeListener(refs.googleLogoutBtn, 'click', async () => {
        const originalText = refs.googleLogoutBtn.textContent;
        refs.googleLogoutBtn.textContent = "Disconnecting...";
        refs.googleLogoutBtn.disabled = true;
        try {
            googleSync.handleSignoutClick();
            localStorage.removeItem('hasAcceptedSyncTerms');
            modals.hideSettingsModal();
            setStatus("Disconnected");
        } catch (e) {
            console.error(e);
            setStatus("Logout Error", true);
        } finally {
            refs.googleLogoutBtn.textContent = originalText;
            refs.googleLogoutBtn.disabled = false;
            restoreFocus();
        }
    });

    const handleCourseChange = (event) => { const newCourse = event.target.value; state.lastSelectedCourse = newCourse; refs.courseSelect.value = newCourse; refs.scoreCourseSelect.value = newCourse; refs.pomodoroCourseSelect.value = newCourse; refs.countdownCourseSelect.value = newCourse; dataManager.saveLastSelectedCourse(); };
    addSafeListener(refs.courseSelect, 'change', handleCourseChange);
    addSafeListener(refs.scoreCourseSelect, 'change', handleCourseChange);
    addSafeListener(refs.pomodoroCourseSelect, 'change', handleCourseChange);
    addSafeListener(refs.countdownCourseSelect, 'change', handleCourseChange);
    
    addSafeListener(refs.startButton, 'click', () => { timers.startTimer(); });
    addSafeListener(refs.stopButton, 'click', timers.stopTimer);
    addSafeListener(refs.resetButton, 'click', timers.resetStopwatch);

    addSafeListener(refs.pomodoroStartBtn, 'click', () => { state.pomodoroCycle = 0; const duration = (state.pomodoroFocusDuration || 50) * 60; timers.beginNewPomodoroPhase(duration, 'studying'); });
    addSafeListener(refs.pomodoroPauseResumeBtn, 'click', timers.togglePomodoroPause);
    addSafeListener(refs.pomodoroStopBtn, 'click', timers.stopPomodoro);
    addSafeListener(refs.pomodoroSkipBtn, 'click', timers.skipPomodoroPhase);
    addSafeListener(refs.pomodoroResetBtn, 'click', timers.resetPomodoro);

    addSafeListener(refs.countdownStartPauseBtn, 'click', () => { timers.startCountdownTimer(); });
    addSafeListener(refs.countdownStopBtn, 'click', timers.stopCountdownTimer);
    addSafeListener(refs.countdownResetBtn, 'click', timers.resetCountdownTimer);
    
    addSafeListener(refs.logScoreButton, 'click', () => { if (dataManager.logScore()) { updateAllDisplays(); } });
    addSafeListener(refs.showAllButton, 'click', () => { views.updateLogDisplay(null); if (state.calendar) { state.calendar.clear(); } });
    addSafeListener(refs.btnCalendarToday, 'click', () => { views.resetCalendarToToday(); });

    addSafeListener(refs.cancelEventButton, 'click', () => { modals.hideEventModal(); views.updateCalendar(); restoreFocus(); });
    addSafeListener(refs.cancelDeleteButton, 'click', () => { modals.hideConfirmModal(); restoreFocus(); });
    addSafeListener(refs.cancelEditButton, 'click', () => { modals.hideEditModal(); restoreFocus(); });
    addSafeListener(refs.closeChartModalButton, 'click', () => { modals.hideChartModal(); restoreFocus(); });
    
    addSafeListener(refs.btnPieTotal, 'click', () => charts.setPieMode('total'));
    addSafeListener(refs.btnPieToday, 'click', () => charts.setPieMode('today'));
    addSafeListener(refs.btnPieTrend, 'click', () => charts.setPieMode('trend'));
    addSafeListener(refs.trendSpanSelect, 'change', (e) => { state.trendChartSpan = parseInt(e.target.value); charts.updateTimeChart(); });
    addSafeListener(refs.btnToggleTasks, 'click', () => { state.showCompletedTasks = !state.showCompletedTasks; views.updateTaskDashboard(); });
    
    addSafeListener(refs.btnTimerStopwatch, 'click', () => timers.setTimerMode('stopwatch'));
    addSafeListener(refs.btnTimerPomodoro, 'click', () => timers.setTimerMode('pomodoro'));
    addSafeListener(refs.btnTimerCountdown, 'click', () => timers.setTimerMode('countdown'));
    addSafeListener(refs.btnFocusMode, 'click', () => { state.isFocusMode = !state.isFocusMode; views.toggleFocusModeVisuals(); });
    addSafeListener(refs.btnLogChrono, 'click', () => views.setLogViewMode('chrono'));
    addSafeListener(refs.btnLogTopic, 'click', () => views.setLogViewMode('topic'));
    
    addSafeListener(refs.globalSettingsBtn, 'click', modals.showSettingsModal);
    addSafeListener(refs.manageCoursesFromSettingsBtn, 'click', modals.showCoursesModal);
    addSafeListener(refs.closeCoursesModalBtn, 'click', () => { modals.hideCoursesModal(); restoreFocus(); });
    addSafeListener(refs.addCourseBtn, 'click', modals.addCourse);
    addSafeListener(refs.courseListEditor, 'click', (event) => { const btn = event.target.closest('.course-delete-btn'); if (btn) { const courseName = btn.dataset.course; modals.showConfirmModal(courseName, false, 'course'); } });
    addSafeListener(refs.closeSettingsModalBtn, 'click', () => { modals.hideSettingsModal(); restoreFocus(); });
    addSafeListener(refs.saveSettingsBtn, 'click', () => { modals.saveSettings(); restoreFocus(); });
    addSafeListener(refs.testAlarmBtn, 'click', modals.testAlarm);
    addSafeListener(refs.selectAlarmBtn, 'click', modals.selectAlarmFile);
    addSafeListener(refs.exportDataBtn, 'click', dataManager.exportData);
    addSafeListener(refs.importDataBtn, 'click', () => refs.importFileInput.click());
    addSafeListener(refs.importFileInput, 'change', (event) => { if (event.target.files.length > 0) { dataManager.importData(event.target.files[0]); } });
    
    addSafeListener(refs.sessionLog, 'click', (event) => { 
        const deleteBtn = event.target.closest('.delete-btn'); 
        const editBtn = event.target.closest('.edit-btn'); 
        if (deleteBtn) { const ts = deleteBtn.dataset.timestamp; modals.showConfirmModal(ts, false, 'log'); } 
        else if (editBtn) { const ts = editBtn.dataset.timestamp; modals.showEditModal(ts); } 
    });

    if (state.timeChart) { state.timeChart.on('click', (params) => { if (params.componentType === 'series') modals.showChartModal('time'); }); }
    if (state.scoreChart) { state.scoreChart.on('click', () => modals.showChartModal('score')); }

    addSafeListener(refs.helpBtn, 'click', modals.showHelpModal);
    addSafeListener(refs.closeHelpModalBtn, 'click', () => { modals.hideHelpModal(); restoreFocus(); });

    addSafeListener(refs.pomodoroPromptConfirmBtn, 'click', () => { if (state.nextPomodoroPhase) { timers.beginNewPomodoroPhase(state.nextPomodoroPhase.duration, state.nextPomodoroPhase.name); modals.hidePomodoroPrompt(); modals.playAlarm(true); restoreFocus(); } });
    addSafeListener(refs.pomodoroPromptStopBtn, 'click', () => { timers.stopPomodoro(); modals.hidePomodoroPrompt(); modals.playAlarm(true); restoreFocus(); });
}