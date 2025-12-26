// --- All state variables ---
export const state = {
    allCourses: [], 
    allSessions: [], 
    allScores: [], 
    allEvents: [],
    lastSelectedCourse: null,

    calendar: null, 
    timeChart: null, 
    scoreChart: null,
    stopwatchTimer: null, 
    pomodoroTimer: null, 
    countdownTimer: null, 
    saveDataInterval: null,

    stopwatchSeconds: 0,
    stopwatchStartTime: null,
    isStopwatchRunning: false,
    isStopwatchPaused: false,

    pomodoroState: 'idle',
    pomodoroSecondsLeft: 50 * 60,
    pomodoroCycle: 0,
    isPomodoroPaused: false,
    pomodoroPausedTime: 0,
    pomodoroOriginalDuration: 0,
    pomodoroStartTime: null,
    nextPomodoroPhase: null,

    pomodoroFocusDuration: 50,
    pomodoroShortBreakDuration: 10,
    pomodoroLongBreakDuration: 20,

    countdownSecondsLeft: 0,
    isCountdownRunning: false,
    isCountdownPaused: false,
    countdownPausedTime: 0,
    countdownStartTime: null,

    isSavingEvent: false, 
    zoomedTimeChart: null,
    zoomedScoreChart: null,
    eventModalPicker: null, 

    pieChartMode: 'trend', 
    trendChartSpan: 7, 
    logViewMode: 'chrono', 
    showCompletedTasks: false, 
    logFilterDate: null, 

    streakCount: 0,
    streakTarget: 7, 
    streakMinMinutes: 15, 
    isFocusMode: false,

    heatmapTargetHours: 8,
    heatmapOverdriveHours: 10,

    deadlineUrgencyDays: 60,

    calendarCurrentMonth: null,
    calendarCurrentYear: null
};