// --- All state variables ---
let allCourses = []; 
let allSessions = [], allScores = [], allEvents = [];
let lastSelectedCourse = null;

let calendar, timeChart, scoreChart;
let stopwatchTimer, pomodoroTimer, countdownTimer; 
let saveDataInterval = null;

let stopwatchSeconds = 0;
let stopwatchStartTime = null;
let isStopwatchRunning = false;
let isStopwatchPaused = false;

let pomodoroState = 'idle';
let pomodoroSecondsLeft = 50 * 60;
let pomodoroCycle = 0;
let isPomodoroPaused = false;
let pomodoroPausedTime = 0;
let pomodoroOriginalDuration = 0;
let pomodoroStartTime = null;
let nextPomodoroPhase = null;

// *** NEW: Customizable Pomodoro Timings (Defaults) ***
let pomodoroFocusDuration = 50;
let pomodoroShortBreakDuration = 10;
let pomodoroLongBreakDuration = 20;

let countdownSecondsLeft = 0;
let isCountdownRunning = false;
let isCountdownPaused = false;
let countdownPausedTime = 0;
let countdownStartTime = null;

let isSavingEvent = false; 
let zoomedTimeChart = null;
let zoomedScoreChart = null;
let eventModalPicker = null; 

let pieChartMode = 'trend'; 
let trendChartSpan = 7; 
let logViewMode = 'chrono'; 
let showCompletedTasks = false; 
let logFilterDate = null; 

let streakCount = 0;
let streakTarget = 7; 
let streakMinMinutes = 15; 
let isFocusMode = false;

let heatmapTargetHours = 8;    // Default: 8 hours for solid ink
let heatmapOverdriveHours = 10; // Default: 10 hours for gold border

let deadlineUrgencyDays = 60;

let calendarCurrentMonth = null;
let calendarCurrentYear = null;

module.exports = {
    allCourses, allSessions, allScores, allEvents, lastSelectedCourse,
    calendar, timeChart, scoreChart, stopwatchTimer, pomodoroTimer, countdownTimer, saveDataInterval,
    stopwatchSeconds, stopwatchStartTime, isStopwatchRunning, isStopwatchPaused,
    pomodoroState, pomodoroSecondsLeft, pomodoroCycle, isPomodoroPaused, pomodoroPausedTime, pomodoroOriginalDuration, pomodoroStartTime, nextPomodoroPhase,
    pomodoroFocusDuration, pomodoroShortBreakDuration, pomodoroLongBreakDuration, 
    countdownSecondsLeft, heatmapTargetHours, heatmapOverdriveHours, isCountdownRunning, isCountdownPaused, countdownPausedTime, countdownStartTime,
    isSavingEvent, zoomedTimeChart, zoomedScoreChart, eventModalPicker,
    pieChartMode, trendChartSpan, logViewMode, showCompletedTasks,
    streakCount, streakTarget, streakMinMinutes, isFocusMode,
    deadlineUrgencyDays, 
    calendarCurrentMonth, calendarCurrentYear, logFilterDate
};