// js/uiRefs.js
// Using getters ensures elements are fetched only when accessed (after DOM load)

const refs = {
    get courseSelect() { return document.getElementById('courseSelect'); },
    get timerDisplay() { return document.getElementById('timerDisplay'); },
    get startButton() { return document.getElementById('startButton'); },
    get stopButton() { return document.getElementById('stopButton'); },
    get resetButton() { return document.getElementById('resetButton'); },
    get sessionNotes() { return document.getElementById('sessionNotes'); },
    get sessionLog() { return document.getElementById('sessionLog'); },
    get showAllButton() { return document.getElementById('showAllButton'); },
    get scoreCourseSelect() { return document.getElementById('scoreCourseSelect'); },
    get scoreInput() { return document.getElementById('scoreInput'); },
    get scoreNotes() { return document.getElementById('scoreNotes'); },
    get logScoreButton() { return document.getElementById('logScoreButton'); },
    get streakContainer() { return document.getElementById('streak-container'); },
    get streakCount() { return document.getElementById('streak-count'); },
    get syncStatus() { return document.getElementById('sync-status'); },
    get googleLogoutBtn() { return document.getElementById('google-logout-btn'); },

    get syncBtn() { return document.getElementById('sync-btn'); },
    get syncOnboardingModal() { return document.getElementById('sync-onboarding-modal'); },
    get cancelSyncSetupBtn() { return document.getElementById('cancel-sync-setup-btn'); },
    get confirmSyncSetupBtn() { return document.getElementById('confirm-sync-setup-btn'); },
    
    get taskList() { return document.getElementById('task-list'); },
    get btnToggleTasks() { return document.getElementById('btn-toggle-tasks'); },
    
    get btnCalendarToday() { return document.getElementById('btn-calendar-today'); },

    get eventModal() { return document.getElementById('event-modal'); }, 
    get modalTitle() { return document.getElementById('modal-title'); }, 
    get eventText() { return document.getElementById('event-text'); },
    get eventPriority() { return document.getElementById('event-priority'); }, 
    get saveEventButton() { return document.getElementById('save-event-button'); }, 
    get cancelEventButton() { return document.getElementById('cancel-event-button'); },
    get eventTimestamp() { return document.getElementById('event-timestamp'); },
    get eventError() { return document.getElementById('eventError'); },
    get eventDatePicker() { return document.getElementById('event-date-picker'); },
    
    get timerError() { return document.getElementById('timerError'); },
    get scoreError() { return document.getElementById('scoreError'); },
    get pomodoroError() { return document.getElementById('pomodoroError'); },
    
    get confirmModal() { return document.getElementById('confirm-modal'); },
    get itemToProcess() { return document.getElementById('item-to-process'); }, 
    get confirmDeleteButton() { return document.getElementById('confirm-delete-button'); },
    get cancelDeleteButton() { return document.getElementById('cancel-delete-button'); },
    get modalConfirmTitle() { return document.getElementById('modal-confirm-title'); },
    get modalConfirmText() { return document.getElementById('modal-confirm-text'); },

    get pomodoroPromptModal() { return document.getElementById('pomodoro-prompt-modal'); },
    get pomodoroPromptTitle() { return document.getElementById('pomodoro-prompt-title'); },
    get pomodoroPromptText() { return document.getElementById('pomodoro-prompt-text'); },
    get pomodoroPromptConfirmBtn() { return document.getElementById('pomodoro-prompt-confirm-btn'); },
    get pomodoroPromptStopBtn() { return document.getElementById('pomodoro-prompt-stop-btn'); },

    get editModal() { return document.getElementById('edit-log-modal'); },
    get editTimestamp() { return document.getElementById('edit-timestamp'); },
    get editDatePicker() { return document.getElementById('edit-date-picker'); }, 
    get editCourseSelect() { return document.getElementById('edit-course-select'); },
    get editSessionGroup() { return document.getElementById('edit-session-group'); },
    get editDuration() { return document.getElementById('edit-duration'); },
    get editScoreGroup() { return document.getElementById('edit-score-group'); },
    get editScore() { return document.getElementById('edit-score'); },
    get editNotes() { return document.getElementById('edit-notes'); },
    get editError() { return document.getElementById('editError'); },
    get saveEditButton() { return document.getElementById('save-edit-button'); },
    get cancelEditButton() { return document.getElementById('cancel-edit-button'); },

    get chartModal() { return document.getElementById('chart-modal'); },
    get zoomedChartTitle() { return document.getElementById('zoomed-chart-title'); },
    get zoomedChartContainer() { return document.getElementById('zoomed-chart-container'); },
    get closeChartModalButton() { return document.getElementById('close-chart-modal-button'); },

    get btnPieTotal() { return document.getElementById('btn-pie-total'); },
    get btnPieToday() { return document.getElementById('btn-pie-today'); },
    get btnPieTrend() { return document.getElementById('btn-pie-trend'); }, 
    get trendSpanSelect() { return document.getElementById('trend-span-select'); }, 

    get coursesModal() { return document.getElementById('courses-modal'); },
    get newCourseName() { return document.getElementById('new-course-name'); },
    get addCourseBtn() { return document.getElementById('add-course-btn'); },
    get courseListEditor() { return document.getElementById('course-list-editor'); },
    get closeCoursesModalBtn() { return document.getElementById('close-courses-modal-btn'); },

    get globalSettingsBtn() { return document.getElementById('global-settings-btn'); },
    get manageCoursesFromSettingsBtn() { return document.getElementById('manage-courses-from-settings-btn'); },
    get settingsModal() { return document.getElementById('settings-modal'); },
    get closeSettingsModalBtn() { return document.getElementById('close-settings-modal-btn'); },
    get alarmSoundInput() { return document.getElementById('alarm-sound-input'); },
    get testAlarmBtn() { return document.getElementById('test-alarm-btn'); },
    get saveSettingsBtn() { return document.getElementById('save-settings-btn'); }, 
    get alarmSound() { return document.getElementById('alarm-sound'); },
    get selectAlarmBtn() { return document.getElementById('select-alarm-btn'); },
    get selectedAlarmFile() { return document.getElementById('selected-alarm-file'); },
    
    get deadlineUrgencyInput() { return document.getElementById('deadline-urgency-input'); }, 
    
    get settingHeatmapTarget() { return document.getElementById('setting-heatmap-target'); },

    get settingFocusDuration() { return document.getElementById('setting-focus-duration'); },
    get settingShortBreakDuration() { return document.getElementById('setting-short-break-duration'); },
    get settingLongBreakDuration() { return document.getElementById('setting-long-break-duration'); },

    get exportDataBtn() { return document.getElementById('export-data-btn'); },
    get importDataBtn() { return document.getElementById('import-data-btn'); },
    get importFileInput() { return document.getElementById('import-file-input'); },

    get btnTimerStopwatch() { return document.getElementById('btn-timer-stopwatch'); },
    get btnTimerPomodoro() { return document.getElementById('btn-timer-pomodoro'); },
    get btnTimerCountdown() { return document.getElementById('btn-timer-countdown'); },
    get btnFocusMode() { return document.getElementById('btn-focus-mode'); }, 
    get stopwatchPanel() { return document.getElementById('stopwatch-panel'); },
    get pomodoroPanel() { return document.getElementById('pomodoro-panel'); },
    get countdownPanel() { return document.getElementById('countdown-panel'); },

    get pomodoroCourseSelect() { return document.getElementById('pomodoroCourseSelect'); },
    get pomodoroTimerDisplay() { return document.getElementById('pomodoroTimerDisplay'); },
    get pomodoroStatus() { return document.getElementById('pomodoro-status'); },
    
    get pomodoroStartBtn() { return document.getElementById('pomodoro-start-btn'); },
    
    get pomodoroPauseResumeBtn() { return document.getElementById('pomodoro-pause-resume-btn'); },
    get pomodoroStopBtn() { return document.getElementById('pomodoro-stop-btn'); },
    get pomodoroResetBtn() { return document.getElementById('pomodoro-reset-btn'); },
    get pomodoroSkipBtn() { return document.getElementById('pomodoro-skip-btn'); },

    get pomodoroNotes() { return document.getElementById('pomodoroNotes'); },
    get pomodoroStartControls() { return document.getElementById('pomodoro-start-controls'); },
    get pomodoroRunningControls() { return document.getElementById('pomodoro-running-controls'); },

    get countdownTimerDisplay() { return document.getElementById('countdownTimerDisplay'); },
    get countdownHours() { return document.getElementById('countdown-hours'); },
    get countdownMinutes() { return document.getElementById('countdown-minutes'); },
    get countdownSeconds() { return document.getElementById('countdown-seconds'); },
    get countdownStartPauseBtn() { return document.getElementById('countdown-start-pause-btn'); },
    get countdownStopBtn() { return document.getElementById('countdown-stop-btn'); },
    get countdownResetBtn() { return document.getElementById('countdown-reset-btn'); },
    get countdownCourseSelect() { return document.getElementById('countdownCourseSelect'); },
    get countdownNotes() { return document.getElementById('countdownNotes'); },

    get btnLogChrono() { return document.getElementById('btn-log-chrono'); },
    get btnLogTopic() { return document.getElementById('btn-log-topic'); },

    get studyCalendar() { return document.getElementById('study-calendar'); },
    get timeChart() { return document.getElementById('time-chart'); },
    get scoreChart() { return document.getElementById('score-chart'); },
    get helpBtn() { return document.getElementById('help-btn'); },
    get helpModal() { return document.getElementById('help-modal'); },
    get closeHelpModalBtn() { return document.getElementById('close-help-modal-btn'); }
};
export default refs;