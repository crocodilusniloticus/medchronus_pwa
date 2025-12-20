import { pushEventsToGoogle, handleSignoutClick, deleteSingleEvent } from './googleSync.js'; // FIX: Import logic

let refs, timers, modals, charts, views, dataManager, state, updateAllDisplays;
let statusTimeout = null; 

function init(appState, uiRefs, timerFuncs, modalFuncs, chartFuncs, viewFuncs, dataMgr, updateAllDisplaysFn) {
    state = appState;
    refs = uiRefs;
    timers = timerFuncs;
    modals = modalFuncs;
    charts = chartFuncs;
    views = viewFuncs;
    dataManager = dataMgr; 
    updateAllDisplays = updateAllDisplaysFn;

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
            }, 4000);
        }
    };

    window.addEventListener('storage', (event) => {
        if (['studySessions', 'studyScores', 'studyEvents', 'studyCourses'].includes(event.key)) {
            console.log('Data changed in another tab. Reloading...');
            dataManager.loadData();
            updateAllDisplays();
            if (views && typeof views.updateCalendar === 'function') {
                views.updateCalendar();
            }
        }
    });

    // --- SYNC ENGINE (FIXED FOR PWA) ---
    const triggerCloudSync = async (silent = false) => {
        if (!refs.syncBtn) return;
        if (!navigator.onLine) {
            if (!silent) setStatus("Offline (Local Only)", true);
            return;
        }

        try {
            if (!silent) {
                setStatus("Syncing...");
                refs.syncBtn.style.opacity = "0.5";
            }
            
            // 1. ELECTRON MODE
            if (window.ipcRenderer) {
                const cleanEvents = JSON.parse(JSON.stringify(state.allEvents));
                const result = await window.ipcRenderer.invoke('google-calendar-sync', cleanEvents);
                handleSyncResult(result, silent);
            } 
            // 2. PWA / WEB MODE (FIXED)
            else {
                // Call the client-side Google Sync logic
                const result = await pushEventsToGoogle(state.allEvents);
                handleSyncResult(result, silent);
            }

        } catch (err) {
            console.warn("Auto-Sync Error:", err);
            setStatus("Sync Failed", true); 
        } finally {
            if (refs.syncBtn) refs.syncBtn.style.opacity = "1";
        }
    };

    // Helper to process sync results from either Electron or Web
    const handleSyncResult = (result, silent) => {
        if (result.success && result.stats) {
            // Update local IDs with the new Google IDs to prevent duplicates
            if (result.stats.updatedEvents && result.stats.updatedEvents.length > 0) {
                let changesMade = false;
                result.stats.updatedEvents.forEach(updatedEvent => {
                    const localIndex = state.allEvents.findIndex(e => e.timestamp === updatedEvent.timestamp);
                    if(localIndex > -1) {
                        state.allEvents[localIndex].googleId = updatedEvent.googleId;
                        state.allEvents[localIndex].isSynced = true;
                        changesMade = true;
                    }
                });
                if (changesMade) dataManager.saveData(); 
            }
            
            const totalChanges = result.stats.updatedEvents ? result.stats.updatedEvents.length : 0;
            if (!silent || totalChanges > 0) {
                setStatus(totalChanges > 0 ? "Synced to Google" : "Google Cal: Up to date");
            }
        } else {
            throw new Error(result.error || "Unknown error.");
        }
    };

    const checkAndTriggerSync = () => {
        const hasAccepted = localStorage.getItem('hasAcceptedSyncTerms');
        if (hasAccepted === 'true') {
            triggerCloudSync(true); 
        }
    };

    // --- EVENT LISTENERS ---

    refs.saveEventButton.addEventListener('click', () => {
        modals.saveEvent();
        restoreFocus();
        checkAndTriggerSync(); 
    });

    refs.saveEditButton.addEventListener('click', () => {
        modals.saveEdit();
        restoreFocus();
        checkAndTriggerSync(); 
    });

    refs.taskList.addEventListener('click', (event) => { 
        const doneBtn = event.target.closest('.task-done-btn'); 
        const recoverBtn = event.target.closest('.task-recover-btn');
        const deleteBtn = event.target.closest('.task-delete-btn'); 
        const editBtn = event.target.closest('.task-edit-btn'); 
        
        if (doneBtn) { 
            const ts = doneBtn.dataset.timestamp; 
            const eventIndex = state.allEvents.findIndex(e => e.timestamp === ts); 
            if (eventIndex > -1) { 
                state.allEvents[eventIndex].isDone = true; 
                dataManager.saveData(); 
                updateAllDisplays(); 
                checkAndTriggerSync(); 
            } 
        } 
        else if (recoverBtn) {
            const ts = recoverBtn.dataset.timestamp; 
            const eventIndex = state.allEvents.findIndex(e => e.timestamp === ts); 
            if (eventIndex > -1) { 
                state.allEvents[eventIndex].isDone = false;
                state.allEvents[eventIndex].isSynced = false; 
                state.allEvents[eventIndex].googleId = null;  
                dataManager.saveData(); 
                updateAllDisplays(); 
                checkAndTriggerSync(); 
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

    refs.confirmDeleteButton.addEventListener('click', async () => { 
        const identifier = refs.itemToProcess.value; 
        const itemType = refs.itemToProcess.dataset.itemType || 'log'; 
        
        if (!identifier) return; 
        modals.hideConfirmModal(); 
        restoreFocus();

        try {
            // Check if we need to delete from Google Calendar before removing local reference
            if (itemType === 'task_permanent') {
                const eventToDelete = state.allEvents.find(e => e.timestamp === identifier);
                if (eventToDelete && eventToDelete.googleId) {
                     // Fire and forget delete on cloud (or await if you want strict consistency)
                     if (window.ipcRenderer) {
                         // Electron logic (existing)
                     } else {
                         deleteSingleEvent(eventToDelete.googleId).catch(err => console.error("Cloud delete fail", err));
                     }
                }
                
                state.allEvents = state.allEvents.filter(e => e.timestamp !== identifier); 
                dataManager.saveData(); 
                updateAllDisplays(); 
            } else if (itemType === 'course') { 
                modals.deleteCourse(identifier); 
            } else { 
                dataManager.deleteItem(identifier); 
                updateAllDisplays(); 
            }
            setStatus("Deleted");
        } catch (e) {
            console.error(e);
            setStatus("Error Deleting", true);
        }
    });

    if(refs.syncBtn) {
        refs.syncBtn.addEventListener('click', () => {
            const hasAccepted = localStorage.getItem('hasAcceptedSyncTerms');
            if (hasAccepted === 'true') {
                triggerCloudSync(false); 
                restoreFocus();
            } else {
                modals.showSyncOnboarding();
            }
        });
    }

    if (refs.confirmSyncSetupBtn) {
        refs.confirmSyncSetupBtn.addEventListener('click', () => {
            localStorage.setItem('hasAcceptedSyncTerms', 'true');
            modals.hideSyncOnboarding();
            restoreFocus();
            triggerCloudSync(false);
        });
    }
    if (refs.cancelSyncSetupBtn) {
        refs.cancelSyncSetupBtn.addEventListener('click', () => {
            modals.hideSyncOnboarding();
            restoreFocus();
        });
    }

    // --- LOGOUT BUTTON (FIXED FOR PWA) ---
if (refs.googleLogoutBtn) {
        refs.googleLogoutBtn.addEventListener('click', async () => {
            const originalText = refs.googleLogoutBtn.textContent;
            refs.googleLogoutBtn.textContent = "Disconnecting...";
            refs.googleLogoutBtn.disabled = true;

            try {
                let result = { success: false };
                if (window.ipcRenderer) {
                    result = await window.ipcRenderer.invoke('google-auth-logout');
                } else {
                    // PWA Logout
                    handleSignoutClick();
                    result = { success: true }; 
                }
                
                modals.hideSettingsModal();

                if (result.success) {
                    localStorage.removeItem('hasAcceptedSyncTerms');
                    setStatus("Google Calendar Disconnected");
                    
                    // --- OPTIONAL: Reset the UI state immediately ---
                    // Since the user is now disconnected, the sync button in the header 
                    // should probably stop showing "Synced" or reset its opacity/state.
                    // You might want to trigger a UI update here if you have visual indicators.
                } else {
                    setStatus("Logout Failed", true);
                }
            } catch (e) {
                console.error(e);
                modals.hideSettingsModal();
            } finally {
                // Ensure text goes back to normal so it doesn't get stuck on "Disconnecting..."
                refs.googleLogoutBtn.textContent = "Disconnect Google Calendar";
                refs.googleLogoutBtn.disabled = false;
                restoreFocus();
            }
        });
    }

    // --- STANDARD UI LISTENERS ---
    const handleCourseChange = (event) => { const newCourse = event.target.value; state.lastSelectedCourse = newCourse; refs.courseSelect.value = newCourse; refs.scoreCourseSelect.value = newCourse; refs.pomodoroCourseSelect.value = newCourse; refs.countdownCourseSelect.value = newCourse; dataManager.saveLastSelectedCourse(); };
    refs.courseSelect.addEventListener('change', handleCourseChange); refs.scoreCourseSelect.addEventListener('change', handleCourseChange); refs.pomodoroCourseSelect.addEventListener('change', handleCourseChange); refs.countdownCourseSelect.addEventListener('change', handleCourseChange);
    
    refs.startButton.addEventListener('click', () => { timers.startTimer(); });
    refs.stopButton.addEventListener('click', timers.stopTimer);
    if(refs.resetButton) refs.resetButton.addEventListener('click', timers.resetStopwatch);

    refs.pomodoroStartBtn.addEventListener('click', () => { state.pomodoroCycle = 0; const duration = (state.pomodoroFocusDuration || 50) * 60; timers.beginNewPomodoroPhase(duration, 'studying'); });
    refs.pomodoroPauseResumeBtn.addEventListener('click', timers.togglePomodoroPause);
    refs.pomodoroStopBtn.addEventListener('click', timers.stopPomodoro);
    if (refs.pomodoroSkipBtn) refs.pomodoroSkipBtn.addEventListener('click', timers.skipPomodoroPhase);
    if (refs.pomodoroResetBtn) refs.pomodoroResetBtn.addEventListener('click', timers.resetPomodoro);

    refs.countdownStartPauseBtn.addEventListener('click', () => { timers.startCountdownTimer(); });
    refs.countdownStopBtn.addEventListener('click', timers.stopCountdownTimer);
    refs.countdownResetBtn.addEventListener('click', timers.resetCountdownTimer);
    
    refs.logScoreButton.addEventListener('click', () => { if (dataManager.logScore()) { updateAllDisplays(); } });
    
    refs.showAllButton.addEventListener('click', () => { views.updateLogDisplay(null); if (state.calendar) { state.calendar.clear(); } });
    if(refs.btnCalendarToday) { refs.btnCalendarToday.addEventListener('click', () => { views.resetCalendarToToday(); }); }

    refs.cancelEventButton.addEventListener('click', () => { modals.hideEventModal(); views.updateCalendar(); restoreFocus(); });
    refs.cancelDeleteButton.addEventListener('click', () => { modals.hideConfirmModal(); restoreFocus(); });
    refs.cancelEditButton.addEventListener('click', () => { modals.hideEditModal(); restoreFocus(); });
    refs.closeChartModalButton.addEventListener('click', () => { modals.hideChartModal(); restoreFocus(); });
    
    refs.btnPieTotal.addEventListener('click', () => charts.setPieMode('total'));
    refs.btnPieToday.addEventListener('click', () => charts.setPieMode('today'));
    refs.btnPieTrend.addEventListener('click', () => charts.setPieMode('trend'));
    refs.trendSpanSelect.addEventListener('change', (e) => { state.trendChartSpan = parseInt(e.target.value); charts.updateTimeChart(); });
    refs.btnToggleTasks.addEventListener('click', () => { state.showCompletedTasks = !state.showCompletedTasks; views.updateTaskDashboard(); });
    
    refs.btnTimerStopwatch.addEventListener('click', () => timers.setTimerMode('stopwatch'));
    refs.btnTimerPomodoro.addEventListener('click', () => timers.setTimerMode('pomodoro'));
    refs.btnTimerCountdown.addEventListener('click', () => timers.setTimerMode('countdown'));
    refs.btnFocusMode.addEventListener('click', () => { state.isFocusMode = !state.isFocusMode; views.toggleFocusModeVisuals(); });
    refs.btnLogChrono.addEventListener('click', () => views.setLogViewMode('chrono'));
    refs.btnLogTopic.addEventListener('click', () => views.setLogViewMode('topic'));
    
    refs.globalSettingsBtn.addEventListener('click', modals.showSettingsModal);
    refs.manageCoursesFromSettingsBtn.addEventListener('click', modals.showCoursesModal);
    refs.closeCoursesModalBtn.addEventListener('click', () => { modals.hideCoursesModal(); restoreFocus(); });
    refs.addCourseBtn.addEventListener('click', modals.addCourse);
    refs.courseListEditor.addEventListener('click', (event) => { const btn = event.target.closest('.course-delete-btn'); if (btn) { const courseName = btn.dataset.course; modals.showConfirmModal(courseName, false, 'course'); } });
    refs.closeSettingsModalBtn.addEventListener('click', () => { modals.hideSettingsModal(); restoreFocus(); });
    refs.saveSettingsBtn.addEventListener('click', () => { modals.saveSettings(); restoreFocus(); });
    refs.testAlarmBtn.addEventListener('click', modals.testAlarm);
    refs.selectAlarmBtn.addEventListener('click', modals.selectAlarmFile);
    refs.exportDataBtn.addEventListener('click', dataManager.exportData);
    refs.importDataBtn.addEventListener('click', () => refs.importFileInput.click());
    refs.importFileInput.addEventListener('change', (event) => { if (event.target.files.length > 0) { dataManager.importData(event.target.files[0]); } });
    
    refs.sessionLog.addEventListener('click', (event) => { 
        const deleteBtn = event.target.closest('.delete-btn'); 
        const editBtn = event.target.closest('.edit-btn'); 
        if (deleteBtn) { 
            const ts = deleteBtn.dataset.timestamp; 
            modals.showConfirmModal(ts, false, 'log'); 
        } else if (editBtn) { 
            const ts = editBtn.dataset.timestamp; 
            modals.showEditModal(ts); 
        } 
    });

    if (state.timeChart) {
        state.timeChart.on('click', (params) => { if (params.componentType === 'series') modals.showChartModal('time'); });
    }
    if (state.scoreChart) {
        state.scoreChart.on('click', () => modals.showChartModal('score'));
    }

    if (refs.helpBtn) refs.helpBtn.addEventListener('click', modals.showHelpModal);
    if (refs.closeHelpModalBtn) refs.closeHelpModalBtn.addEventListener('click', () => { modals.hideHelpModal(); restoreFocus(); });

    refs.pomodoroPromptConfirmBtn.addEventListener('click', () => { if (state.nextPomodoroPhase) { timers.beginNewPomodoroPhase(state.nextPomodoroPhase.duration, state.nextPomodoroPhase.name); modals.hidePomodoroPrompt(); modals.playAlarm(true); restoreFocus(); } });
    refs.pomodoroPromptStopBtn.addEventListener('click', () => { timers.stopPomodoro(); modals.hidePomodoroPrompt(); modals.playAlarm(true); restoreFocus(); });
}

export { init };