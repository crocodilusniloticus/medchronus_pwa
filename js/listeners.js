let refs, timers, modals, charts, views, dataManager, state, updateAllDisplays;
let statusTimeout = null; // Variable to manage the status message timer

function init(appState, uiRefs, timerFuncs, modalFuncs, chartFuncs, viewFuncs, dataMgr, updateAllDisplaysFn) {
    state = appState;
    refs = uiRefs;
    timers = timerFuncs;
    modals = modalFuncs;
    charts = chartFuncs;
    views = viewFuncs;
    dataManager = dataMgr; 
    updateAllDisplays = updateAllDisplaysFn;

    // --- UTILITIES ---
    const restoreFocus = () => {
        if (document.activeElement) { document.activeElement.blur(); }
        window.focus(); document.body.focus(); 
    };

    // Robust Status Message handling (prevents flickering or hidden messages)
    const setStatus = (text, isError = false) => {
        if(refs.syncStatus) {
            // 1. Clear any existing timer so the message doesn't disappear instantly
            if (statusTimeout) clearTimeout(statusTimeout);

            // 2. Set content and style
            refs.syncStatus.textContent = text;
            refs.syncStatus.style.color = isError ? 'var(--danger)' : 'var(--primary)';
            refs.syncStatus.style.opacity = '1';
            
            // 3. Set new timer to fade out after 3 seconds
            statusTimeout = setTimeout(() => { 
                if(refs.syncStatus) refs.syncStatus.style.opacity = '0'; 
            }, 3000);
        }
    };

    // ---------------------------------------------------------
    // NEW: Multi-Tab Synchronization (Fixes "Zombie Data")
    // ---------------------------------------------------------
    window.addEventListener('storage', (event) => {
        // Only react if one of our core data keys changed
        if (['studySessions', 'studyScores', 'studyEvents', 'studyCourses'].includes(event.key)) {
            console.log('Data changed in another tab. Reloading...');
            
            // 1. Reload data from the updated Local Storage
            dataManager.loadData();
            
            // 2. Refresh the UI to show the changes
            updateAllDisplays();
            
            // 3. Refresh Calendar to remove/add event dots
            if (views && typeof views.updateCalendar === 'function') {
                views.updateCalendar();
            }
        }
    });

    // --- SYNC ENGINE ---
    const triggerCloudSync = async (silent = false) => {
        if (!refs.syncBtn) return;
        if (!navigator.onLine) {
            // Even if silent, if we are offline, we might want to know why it didn't sync
            // But usually, keep silent to avoid annoyance unless manual click
            if (!silent) setStatus("Offline (Local Save Only)", true);
            return;
        }

        try {
            // Only show "Syncing..." text if it's a manual click (not silent)
            if (!silent) {
                setStatus("Syncing...");
                refs.syncBtn.style.opacity = "0.5";
            }
            
            // Check if we are in Electron or Web environment for sync
            if (window.ipcRenderer) {
                const cleanEvents = JSON.parse(JSON.stringify(state.allEvents));
                const result = await window.ipcRenderer.invoke('google-calendar-sync', cleanEvents);
                
                if (result.success && result.stats) {
                    // Update local IDs with the new Google IDs
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
                    
                    // FORCE SHOW "SYNCED" Message even if triggered silently
                    const totalChanges = result.stats.updatedEvents ? result.stats.updatedEvents.length : 0;
                    setStatus(totalChanges > 0 ? "Synced" : "Synced (Up to date)");
                
                } else {
                    throw new Error(result.error || "Unknown error.");
                }
            } else {
                // Web/Supabase Sync logic would go here if different from Electron
                // For now, assuming this function handles the primary sync method
            }

        } catch (err) {
            console.warn("Auto-Sync Error:", err);
            // If manual, show error. If silent, only show if it's a critical auth error maybe?
            // For now, let's show "Sync Failed" so user knows why their calendar isn't updating.
            setStatus("Sync Failed", true); 
        } finally {
            if (refs.syncBtn) refs.syncBtn.style.opacity = "1";
        }
    };

    // --- SMART SYNC CHECKER ---
    const checkAndTriggerSync = () => {
        const hasAccepted = localStorage.getItem('hasAcceptedSyncTerms');
        
        // ONLY trigger auto-sync if they are ALREADY logged in.
        if (hasAccepted === 'true') {
            triggerCloudSync(true); // Run in background (silent start, visible success)
        }
    };

    // --- EVENT LISTENERS ---

    // 1. SAVE EVENT
    refs.saveEventButton.addEventListener('click', () => {
        modals.saveEvent();
        restoreFocus();
        checkAndTriggerSync(); 
    });

    // 2. EDIT EVENT
    refs.saveEditButton.addEventListener('click', () => {
        modals.saveEdit();
        restoreFocus();
        checkAndTriggerSync(); 
    });

    // 3. TASK LIST ACTIONS
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
                // Reset sync status to force a re-check
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

    // --- DELETE CONFIRMATION ---
    refs.confirmDeleteButton.addEventListener('click', async () => { 
        const identifier = refs.itemToProcess.value; 
        const itemType = refs.itemToProcess.dataset.itemType || 'log'; 
        
        if (!identifier) return; 
        modals.hideConfirmModal(); 
        restoreFocus();

        try {
            // 1. Local Delete (Existing code)
            if (itemType === 'course') { 
                modals.deleteCourse(identifier); 
            } else if (itemType === 'task_permanent') { 
                state.allEvents = state.allEvents.filter(e => e.timestamp !== identifier); 
                dataManager.saveData(); 
                updateAllDisplays(); 
            } else { 
                dataManager.deleteItem(identifier); 
                updateAllDisplays(); 
            }
            setStatus("Deleted");

            // 2. Cloud Delete (NEW FIX)
            // Check if user is logged in before trying
            const hasAccepted = localStorage.getItem('hasAcceptedSyncTerms');
            if (navigator.onLine && hasAccepted === 'true') {
                
                // If Electron (existing code)
                if (window.ipcRenderer && itemType === 'task_permanent') {
                     // ... existing electron logic ...
                } 
                // If Web / Supabase (NEW)
                else {
                    // Call the function we just added to dataManager
                    if (dataManager.deleteFromCloud) {
                        dataManager.deleteFromCloud(identifier, itemType);
                    }
                }
            }

        } catch (e) {
            console.error(e);
            setStatus("Error Deleting", true);
        }
    });

    // --- MANUAL SYNC BUTTON ---
    if(refs.syncBtn) {
        refs.syncBtn.addEventListener('click', () => {
            const hasAccepted = localStorage.getItem('hasAcceptedSyncTerms');
            if (hasAccepted === 'true') {
                triggerCloudSync(false); // Not silent, show "Syncing..."
                restoreFocus();
            } else {
                modals.showSyncOnboarding();
            }
        });
    }

    // --- SYNC MODAL BUTTONS ---
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

    // --- LOGOUT BUTTON ---
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
                    // Handle web logout if applicable
                    result = { success: true }; 
                }
                
                modals.hideSettingsModal();

                if (result.success) {
                    localStorage.removeItem('hasAcceptedSyncTerms');
                    setStatus("Disconnected");
                } else {
                    setStatus("Logout Failed: " + result.error, true);
                }
            } catch (e) {
                console.error(e);
                modals.hideSettingsModal();
            } finally {
                refs.googleLogoutBtn.textContent = originalText;
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