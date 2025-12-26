import { fetchGoogleEventsMaster, upsertEventToGoogle, deleteEventFromGoogle, handleSignoutClick } from './googleSync-v2.2.22.js';

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

    // --- GOOGLE MASTER SYNC ---
    const triggerCloudSync = async (silent = false) => {
        if (!refs.syncBtn) return;
        if (!navigator.onLine) {
            if (!silent) setStatus("Offline (Local Only)", true);
            return;
        }

        try {
            if (!silent) {
                setStatus("Fetching Google Calendar...");
                refs.syncBtn.style.opacity = "0.5";
            }
            
            // 1. Fetch from Google (Source of Truth for ACTIVE events)
            const result = await fetchGoogleEventsMaster();
            
            if (result.success && result.events) {
                // 2. PRESERVE LOCAL HISTORY
                // Since "Done" events are deleted from Google, we must keep our local copy of them.
                const localCompleted = state.allEvents.filter(e => e.isDone);
                
                // Avoid duplicates: If Google sends an event, use Google's version. 
                // Only keep local completed items if they are NOT in the Google result.
                const googleIds = new Set(result.events.map(e => e.googleId));
                const uniqueLocalCompleted = localCompleted.filter(e => !e.googleId || !googleIds.has(e.googleId));

                // 3. MERGE: Google Active + Local Completed
                state.allEvents = [...result.events, ...uniqueLocalCompleted];
                
                dataManager.saveData(); 
                updateAllDisplays();    
                
                if (!silent) setStatus(`Synced: ${result.events.length} Active Events`);
            } else {
                 if(!silent && result.error) setStatus("Google Sync Error", true);
            }

            // 4. Trigger Supabase (Sessions/Scores ONLY)
            await dataManager.syncWithSupabase();

        } catch (err) {
            console.warn("Auto-Sync Error:", err);
            setStatus("Sync Failed", true); 
        } finally {
            if (refs.syncBtn) refs.syncBtn.style.opacity = "1";
        }
    };

    const checkAndTriggerSync = () => {
        const hasAccepted = localStorage.getItem('hasAcceptedSyncTerms');
        if (hasAccepted === 'true') {
            triggerCloudSync(true); 
        }
    };

    // --- BUTTON HANDLERS ---

    refs.saveEventButton.addEventListener('click', () => {
        modals.saveEvent();
    });

    refs.saveEditButton.addEventListener('click', () => {
        modals.saveEdit();
    });

    refs.taskList.addEventListener('click', async (event) => { 
        const doneBtn = event.target.closest('.task-done-btn'); 
        const recoverBtn = event.target.closest('.task-recover-btn');
        const deleteBtn = event.target.closest('.task-delete-btn'); 
        const editBtn = event.target.closest('.task-edit-btn'); 
        
        // 1. MARK DONE -> DELETE FROM GOOGLE
        if (doneBtn) { 
            const ts = doneBtn.dataset.timestamp; 
            const eventItem = state.allEvents.find(e => e.timestamp === ts); 
            if (eventItem) { 
                eventItem.isDone = true; 
                dataManager.saveData(); 
                updateAllDisplays(); 
                
                // DELETE from Google (It is done, get it off the calendar)
                if (eventItem.googleId) {
                    await deleteEventFromGoogle(eventItem.googleId);
                }
            } 
        } 
        // 2. RECOVER -> ADD BACK TO GOOGLE
        else if (recoverBtn) {
            const ts = recoverBtn.dataset.timestamp; 
            const eventItem = state.allEvents.find(e => e.timestamp === ts); 
            if (eventItem) { 
                eventItem.isDone = false; 
                dataManager.saveData(); 
                updateAllDisplays(); 
                
                // ADD back to Google (It is active again)
                const result = await upsertEventToGoogle(eventItem);
                if (result.success && result.googleId) {
                    eventItem.googleId = result.googleId;
                    dataManager.saveData();
                }
            }
        }
        // 3. PERMANENT DELETE
        else if (deleteBtn) { 
            const ts = deleteBtn.dataset.timestamp; 
            modals.showConfirmModal(ts, false, 'task_permanent'); 
        } 
        // 4. EDIT
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
            if (itemType === 'task_permanent') {
                const eventToDelete = state.allEvents.find(e => e.timestamp === identifier);
                const googleId = eventToDelete ? eventToDelete.googleId : null;

                // Local Delete
                state.allEvents = state.allEvents.filter(e => e.timestamp !== identifier); 
                dataManager.saveData(); 
                updateAllDisplays(); 
                setStatus("Deleting...");

                // Cloud Delete
                if (googleId) {
                    await deleteEventFromGoogle(googleId);
                    setStatus("Deleted");
                } else {
                    setStatus("Deleted (Local)");
                }
            } 
            else if (itemType === 'course') { 
                modals.deleteCourse(identifier); 
                setStatus("Course Deleted");
            } 
            else { 
                await dataManager.deleteItem(identifier); 
                updateAllDisplays(); 
                setStatus("Log Deleted");
            }
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

    if (refs.googleLogoutBtn) {
        refs.googleLogoutBtn.addEventListener('click', async () => {
            refs.googleLogoutBtn.textContent = "Disconnecting...";
            refs.googleLogoutBtn.disabled = true;

            try {
                handleSignoutClick();
                localStorage.removeItem('hasAcceptedSyncTerms');
                setStatus("Google Calendar Disconnected");
                modals.hideSettingsModal();
            } catch (e) {
                console.error(e);
            } finally {
                refs.googleLogoutBtn.textContent = "Disconnect Google Calendar";
                refs.googleLogoutBtn.disabled = false;
                restoreFocus();
            }
        });
    }

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