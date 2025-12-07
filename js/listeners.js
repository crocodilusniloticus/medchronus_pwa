let refs, timers, modals, charts, views, dataManager, state, updateAllDisplays;

function init(appState, uiRefs, timerFuncs, modalFuncs, chartFuncs, viewFuncs, dataMgr, updateAllDisplaysFn) {
    state = appState;
    refs = uiRefs;
    timers = timerFuncs;
    modals = modalFuncs;
    charts = chartFuncs;
    views = viewFuncs;
    dataManager = dataMgr; 
    updateAllDisplays = updateAllDisplaysFn;

    const handleCourseChange = (event) => { const newCourse = event.target.value; state.lastSelectedCourse = newCourse; refs.courseSelect.value = newCourse; refs.scoreCourseSelect.value = newCourse; refs.pomodoroCourseSelect.value = newCourse; refs.countdownCourseSelect.value = newCourse; dataManager.saveLastSelectedCourse(); };
    refs.courseSelect.addEventListener('change', handleCourseChange); refs.scoreCourseSelect.addEventListener('change', handleCourseChange); refs.pomodoroCourseSelect.addEventListener('change', handleCourseChange); refs.countdownCourseSelect.addEventListener('change', handleCourseChange);
    
    // STOPWATCH
    refs.startButton.addEventListener('click', () => { timers.startTimer(); });
    refs.stopButton.addEventListener('click', timers.stopTimer);
    if(refs.resetButton) refs.resetButton.addEventListener('click', timers.resetStopwatch);

    // POMODORO
    refs.pomodoroStartBtn.addEventListener('click', () => { 
        state.pomodoroCycle = 0; 
        const duration = (state.pomodoroFocusDuration || 50) * 60;
        timers.beginNewPomodoroPhase(duration, 'studying'); 
    });
    refs.pomodoroPauseResumeBtn.addEventListener('click', timers.togglePomodoroPause);
    refs.pomodoroStopBtn.addEventListener('click', timers.stopPomodoro);
    if (refs.pomodoroSkipBtn) refs.pomodoroSkipBtn.addEventListener('click', timers.skipPomodoroPhase);
    if (refs.pomodoroResetBtn) refs.pomodoroResetBtn.addEventListener('click', timers.resetPomodoro);

    // COUNTDOWN
    refs.countdownStartPauseBtn.addEventListener('click', () => { timers.startCountdownTimer(); });
    refs.countdownStopBtn.addEventListener('click', timers.stopCountdownTimer);
    refs.countdownResetBtn.addEventListener('click', timers.resetCountdownTimer);
    
    // LOG & GENERAL
    refs.logScoreButton.addEventListener('click', () => { if (dataManager.logScore()) { updateAllDisplays(); } });
    refs.showAllButton.addEventListener('click', () => { views.updateLogDisplay(); if (state.calendar) { state.calendar.clear(); } });
    if(refs.btnCalendarToday) { refs.btnCalendarToday.addEventListener('click', () => { views.resetCalendarToToday(); }); }

    // MODALS & ACTIONS
    refs.saveEventButton.addEventListener('click', modals.saveEvent);
    refs.cancelEventButton.addEventListener('click', () => { modals.hideEventModal(); views.updateCalendar(); });
    refs.confirmDeleteButton.addEventListener('click', () => { const identifier = refs.itemToProcess.value; const itemType = refs.itemToProcess.dataset.itemType || 'log'; if (!identifier) return; if (itemType === 'course') { modals.deleteCourse(identifier); } else if (itemType === 'task_permanent') { state.allEvents = state.allEvents.filter(e => e.timestamp !== identifier); dataManager.saveData(); updateAllDisplays(); } else { dataManager.deleteItem(identifier); updateAllDisplays(); } modals.hideConfirmModal(); });
    refs.cancelDeleteButton.addEventListener('click', modals.hideConfirmModal);
    refs.saveEditButton.addEventListener('click', modals.saveEdit);
    refs.cancelEditButton.addEventListener('click', modals.hideEditModal);
    refs.closeChartModalButton.addEventListener('click', modals.hideChartModal);
    
    // CHARTS
    refs.btnPieTotal.addEventListener('click', () => charts.setPieMode('total'));
    refs.btnPieToday.addEventListener('click', () => charts.setPieMode('today'));
    refs.btnPieTrend.addEventListener('click', () => charts.setPieMode('trend'));
    refs.trendSpanSelect.addEventListener('change', (e) => { state.trendChartSpan = parseInt(e.target.value); charts.updateTimeChart(); });
    refs.btnToggleTasks.addEventListener('click', () => { state.showCompletedTasks = !state.showCompletedTasks; views.updateTaskDashboard(); });
    
    // TIMER TABS & MODES
    refs.btnTimerStopwatch.addEventListener('click', () => timers.setTimerMode('stopwatch'));
    refs.btnTimerPomodoro.addEventListener('click', () => timers.setTimerMode('pomodoro'));
    refs.btnTimerCountdown.addEventListener('click', () => timers.setTimerMode('countdown'));
    refs.btnFocusMode.addEventListener('click', () => { state.isFocusMode = !state.isFocusMode; views.toggleFocusModeVisuals(); });
    refs.btnLogChrono.addEventListener('click', () => views.setLogViewMode('chrono'));
    refs.btnLogTopic.addEventListener('click', () => views.setLogViewMode('topic'));
    
    // SETTINGS & DATA
    refs.globalSettingsBtn.addEventListener('click', modals.showSettingsModal);
    refs.manageCoursesFromSettingsBtn.addEventListener('click', modals.showCoursesModal);
    refs.closeCoursesModalBtn.addEventListener('click', modals.hideCoursesModal);
    refs.addCourseBtn.addEventListener('click', modals.addCourse);
    refs.courseListEditor.addEventListener('click', (event) => { const btn = event.target.closest('.course-delete-btn'); if (btn) { const courseName = btn.dataset.course; modals.showConfirmModal(courseName, false, 'course'); } });
    refs.closeSettingsModalBtn.addEventListener('click', modals.hideSettingsModal);
    refs.saveSettingsBtn.addEventListener('click', modals.saveSettings);
    refs.testAlarmBtn.addEventListener('click', modals.testAlarm);
    refs.selectAlarmBtn.addEventListener('click', modals.selectAlarmFile);
    refs.exportDataBtn.addEventListener('click', dataManager.exportData);
    refs.importDataBtn.addEventListener('click', () => refs.importFileInput.click());
    refs.importFileInput.addEventListener('change', (event) => { if (event.target.files.length > 0) { dataManager.importData(event.target.files[0]); } });
    
    // LISTS
    refs.sessionLog.addEventListener('click', (event) => { const deleteBtn = event.target.closest('.delete-btn'); const editBtn = event.target.closest('.edit-btn'); if (deleteBtn) { const ts = deleteBtn.dataset.timestamp; modals.showConfirmModal(ts, false, 'log'); } else if (editBtn) { const ts = editBtn.dataset.timestamp; modals.showEditModal(ts); } });
    refs.taskList.addEventListener('click', (event) => { const doneBtn = event.target.closest('.task-done-btn'); const deleteBtn = event.target.closest('.task-delete-btn'); const editBtn = event.target.closest('.task-edit-btn'); if (doneBtn) { const ts = doneBtn.dataset.timestamp; const eventIndex = state.allEvents.findIndex(e => e.timestamp === ts); if (eventIndex > -1) { state.allEvents[eventIndex].isDone = true; dataManager.saveData(); updateAllDisplays(); } } else if (deleteBtn) { const ts = deleteBtn.dataset.timestamp; modals.showConfirmModal(ts, false, 'task_permanent'); } else if (editBtn) { const ts = editBtn.dataset.timestamp; modals.showEventModal(null, ts); } });
    
    if (state.timeChart) {
        state.timeChart.on('click', (params) => {
            if (params.componentType === 'series') {
                modals.showChartModal('time');
            }
        });
    }
    if (state.scoreChart) {
        state.scoreChart.on('click', () => modals.showChartModal('score'));
    }

    refs.pomodoroPromptConfirmBtn.addEventListener('click', () => { if (state.nextPomodoroPhase) { timers.beginNewPomodoroPhase(state.nextPomodoroPhase.duration, state.nextPomodoroPhase.name); modals.hidePomodoroPrompt(); modals.playAlarm(true); } });
    refs.pomodoroPromptStopBtn.addEventListener('click', () => { timers.stopPomodoro(); modals.hidePomodoroPrompt(); modals.playAlarm(true); });
}

module.exports = { init };