const { getLocalISODateString } = require('./utils');
let state, refs;

function init(appState, uiRefs) {
    state = appState;
    refs = uiRefs;
}

function saveLastSelectedCourse() {
    if (state.lastSelectedCourse) {
        localStorage.setItem('lastSelectedCourse', state.lastSelectedCourse);
    }
}

function saveTimerProgress() {
    let activeTimerData = null;

    if (state.isStopwatchRunning || state.isStopwatchPaused) {
        activeTimerData = {
            type: 'stopwatch',
            startTime: state.stopwatchStartTime,
            isPaused: state.isStopwatchPaused,
            pausedSeconds: state.stopwatchSeconds, 
            context: {
                course: refs.courseSelect.value,
                notes: refs.sessionNotes.value.trim()
            }
        };
    } else if (state.pomodoroState !== 'idle') {
        activeTimerData = {
            type: 'pomodoro',
            startTime: state.pomodoroStartTime, 
            originalDuration: state.pomodoroOriginalDuration,
            isPaused: state.isPomodoroPaused,
            pausedRemainingSeconds: state.isPomodoroPaused ? state.pomodoroPausedTime : state.pomodoroSecondsLeft,
            pomodoroState: state.pomodoroState,
            context: {
                course: refs.pomodoroCourseSelect.value,
                notes: refs.pomodoroNotes.value.trim()
            }
        };
    } else if (state.isCountdownRunning || state.isCountdownPaused) {
        activeTimerData = {
            type: 'countdown',
            startTime: state.countdownStartTime,
            originalDuration: state.countdownOriginalDuration,
            isPaused: state.isCountdownPaused,
            pausedRemainingSeconds: state.isCountdownPaused ? state.countdownPausedTime : state.countdownSecondsLeft,
            context: {
                course: refs.countdownCourseSelect.value,
                notes: refs.countdownNotes.value.trim()
            }
        };
    }

    if (activeTimerData) {
        localStorage.setItem('activeTimer', JSON.stringify(activeTimerData));
    } else {
        localStorage.removeItem('activeTimer');
    }
}

function saveData() { 
    localStorage.setItem('studySessions', JSON.stringify(state.allSessions)); 
    localStorage.setItem('studyScores', JSON.stringify(state.allScores)); 
    localStorage.setItem('studyEvents', JSON.stringify(state.allEvents));
    localStorage.setItem('studyCourses', JSON.stringify(state.allCourses));
    localStorage.setItem('streakTarget', state.streakTarget); 
    localStorage.setItem('streakMinMinutes', state.streakMinMinutes);
    localStorage.setItem('heatmapTargetHours', state.heatmapTargetHours);
    localStorage.setItem('heatmapOverdriveHours', state.heatmapOverdriveHours);

    // *** NEW: Save Pomodoro Settings ***
    const pomodoroSettings = {
        focus: state.pomodoroFocusDuration,
        shortBreak: state.pomodoroShortBreakDuration,
        longBreak: state.pomodoroLongBreakDuration
    };
    localStorage.setItem('pomodoroSettings', JSON.stringify(pomodoroSettings));
    
    saveTimerProgress();
    calculateStreak(); 
}

function loadData() { 
    state.allSessions = (JSON.parse(localStorage.getItem('studySessions')) || [])
        .filter(s => s && s.timestamp && s.course); 
    state.allScores = (JSON.parse(localStorage.getItem('studyScores')) || [])
        .filter(s => s && s.timestamp && s.course); 
    state.allEvents = (JSON.parse(localStorage.getItem('studyEvents')) || [])
        .map(e => ({...e, isDone: typeof e.isDone === 'boolean' ? e.isDone : false}))
        .filter(e => e && e.date && e.title && e.timestamp);
    
    const savedCourses = JSON.parse(localStorage.getItem('studyCourses'));
    if (savedCourses && savedCourses.length > 0) {
        state.allCourses = savedCourses;
    } else {
        state.allCourses = ["Cardio", "Pulmono", "Nephro", "Gastro", "Endocrino", "Hemato", "Neuro", "Infect", "Rheumatology", "Surgery", "Peds", "Psychiatry", "Dermatology", "Gyneco", "Radio", "Ortho", "Uro", "Ophtalmo", "Biostat", "Pharma", "ENT", "Akhlagh", "Patho", "Genetics", "Physics", "Immuno", "Nutrition"];
    }
    state.allCourses.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    state.lastSelectedCourse = localStorage.getItem('lastSelectedCourse');
    state.streakTarget = parseInt(localStorage.getItem('streakTarget')) || 7;
    state.streakMinMinutes = parseInt(localStorage.getItem('streakMinMinutes')) || 15;

    state.heatmapTargetHours = parseInt(localStorage.getItem('heatmapTargetHours')) || 8;
    state.heatmapOverdriveHours = parseInt(localStorage.getItem('heatmapOverdriveHours')) || 10;

    // *** NEW: Load Pomodoro Settings ***
    const savedPomo = JSON.parse(localStorage.getItem('pomodoroSettings'));
    if (savedPomo) {
        state.pomodoroFocusDuration = savedPomo.focus || 50;
        state.pomodoroShortBreakDuration = savedPomo.shortBreak || 10;
        state.pomodoroLongBreakDuration = savedPomo.longBreak || 20;
    }

    const savedAlarm = localStorage.getItem('alarmSound') || '';
    if (savedAlarm) {
        refs.alarmSound.src = 'file://' + savedAlarm;
        refs.selectedAlarmFile.textContent = savedAlarm.split('\\').pop().split('/').pop();
    }

    const savedCountdown = JSON.parse(localStorage.getItem('countdownValues'));
    if (savedCountdown) {
        refs.countdownHours.value = savedCountdown.h ?? 0;
        refs.countdownMinutes.value = savedCountdown.m ?? 30;
        refs.countdownSeconds.value = savedCountdown.s ?? 0;
    }

    calculateStreak();
}

function calculateStreak() {
    if (!state.allSessions || state.allSessions.length === 0) {
        state.streakCount = 0;
        return;
    }

    const dailyTotals = {};
    state.allSessions.forEach(s => {
        const dateStr = getLocalISODateString(new Date(s.timestamp));
        dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + (s.seconds || 0);
    });

    // CHANGE: Use Heatmap Target (Hours) converted to seconds
    const targetHours = state.heatmapTargetHours || 8;
    const minSeconds = targetHours * 3600;

    const validDates = Object.keys(dailyTotals).filter(date => dailyTotals[date] >= minSeconds);
    const sortedDates = validDates.sort((a, b) => new Date(b) - new Date(a)); 

    // ... rest of the function remains the same ...
    if (sortedDates.length === 0) {
        state.streakCount = 0;
        return;
    }

    const today = getLocalISODateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalISODateString(yesterday);

    if (sortedDates[0] !== today && sortedDates[0] !== yesterdayStr) {
        state.streakCount = 0;
        return;
    }

    let streak = 0;
    let checkDate = new Date(); 
    if (sortedDates[0] === yesterdayStr) {
        checkDate = new Date(yesterday);
    }
    
    while (true) {
        const dateStr = getLocalISODateString(checkDate);
        if (dailyTotals[dateStr] >= minSeconds) { 
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    state.streakCount = streak;
}

function exportData() {
    const data = {
        sessions: state.allSessions,
        scores: state.allScores,
        events: state.allEvents,
        courses: state.allCourses,
        preferences: {
            streakTarget: state.streakTarget,
            streakMinMinutes: state.streakMinMinutes,
            heatmapTarget: state.heatmapTargetHours,
            heatmapHero: state.heatmapOverdriveHours,
 
            lastCourse: state.lastSelectedCourse,
            countdown: JSON.parse(localStorage.getItem('countdownValues')),
            alarmSound: localStorage.getItem('alarmSound'),
            // *** NEW: Export Pomodoro Settings ***
            pomodoroSettings: {
                focus: state.pomodoroFocusDuration,
                shortBreak: state.pomodoroShortBreakDuration,
                longBreak: state.pomodoroLongBreakDuration
            }
        }
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `residency_backup_${getLocalISODateString(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!Array.isArray(data.sessions) || !Array.isArray(data.courses)) {
                throw new Error("Invalid data format");
            }

            state.allSessions = data.sessions;
            state.allScores = data.scores || [];
            state.allEvents = data.events || [];
            state.allCourses = data.courses;
            
            if (data.preferences) {
                state.streakTarget = data.preferences.streakTarget || 7;
                state.streakMinMinutes = data.preferences.streakMinMinutes || 15;
                state.heatmapTargetHours = data.preferences.heatmapTarget || 8;
                state.heatmapOverdriveHours = data.preferences.heatmapHero || 10;

                state.lastSelectedCourse = data.preferences.lastCourse;
                if (data.preferences.alarmSound) localStorage.setItem('alarmSound', data.preferences.alarmSound);
                if (data.preferences.countdown) localStorage.setItem('countdownValues', JSON.stringify(data.preferences.countdown));
                
                // *** NEW: Import Pomodoro Settings ***
                if (data.preferences.pomodoroSettings) {
                    state.pomodoroFocusDuration = data.preferences.pomodoroSettings.focus || 50;
                    state.pomodoroShortBreakDuration = data.preferences.pomodoroSettings.shortBreak || 10;
                    state.pomodoroLongBreakDuration = data.preferences.pomodoroSettings.longBreak || 20;
                }
            }

            saveData();
            alert("Data imported successfully! The app will now reload.");
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert("Error importing data. File might be corrupted or invalid.");
        }
    };
    reader.readAsText(file);
}

function checkForRecoveredSession() {
    const recoveredTimer = JSON.parse(localStorage.getItem('activeTimer'));
    if (!recoveredTimer || !recoveredTimer.startTime) {
        localStorage.removeItem('activeTimer');
        return;
    }

    let elapsedSeconds = 0;
    let course = '', notes = '', timestamp = '';
    
    try {
        course = recoveredTimer.context.course;
        notes = recoveredTimer.context.notes;
        timestamp = new Date(recoveredTimer.startTime).toISOString();

        if (recoveredTimer.type === 'stopwatch') {
            elapsedSeconds = recoveredTimer.pausedSeconds;
        } else if (recoveredTimer.type === 'pomodoro') {
            if (recoveredTimer.pomodoroState !== 'studying') {
                localStorage.removeItem('activeTimer');
                return;
            }
            elapsedSeconds = recoveredTimer.originalDuration - recoveredTimer.pausedRemainingSeconds;
        } else if (recoveredTimer.type === 'countdown') {
            elapsedSeconds = recoveredTimer.originalDuration - recoveredTimer.pausedRemainingSeconds;
        }

        if (elapsedSeconds >= 1) { 
            state.allSessions.push({ 
                type:'session',
                course: course,
                duration: formatTime(elapsedSeconds),
                seconds: elapsedSeconds,
                notes: `${notes || ''}`.trim(), 
                timestamp: timestamp
            });
            localStorage.setItem('studySessions', JSON.stringify(state.allSessions)); 
        }

    } catch (err) {
        console.error("Error recovering session:", err, recoveredTimer);
    }
    localStorage.removeItem('activeTimer'); 
}

function deleteItem(timestamp) { 
    state.allSessions = state.allSessions.filter(i => i.timestamp !== timestamp); 
    state.allScores = state.allScores.filter(i => i.timestamp !== timestamp); 
    state.allEvents = state.allEvents.filter(i => i.timestamp !== timestamp); 
    saveData(); 
}

function logSession(course, seconds, notes, startTimeStamp) { 
    state.allSessions.push({ 
        type:'session',
        course: course,
        duration: formatTime(seconds),
        seconds: seconds,
        notes: notes.trim(),
        timestamp: startTimeStamp || new Date().toISOString()
    }); 
    saveData(); 
    refs.sessionNotes.value = ''; 
}

function logScore() { 
    const s = parseInt(refs.scoreInput.value, 10); 
    if(isNaN(s) || s < 0 || s > 100){
        refs.scoreError.textContent = 'Score must be a number from 0-100.';
        return false;
    }
    refs.scoreError.textContent = ''; 
    state.allScores.push({type:'score',course: refs.scoreCourseSelect.value,score:s,notes: refs.scoreNotes.value.trim(),timestamp:new Date().toISOString()}); 
    saveData(); 
    refs.scoreInput.value='';
    refs.scoreNotes.value='';
    return true;
}

function formatTime(sec) { 
    const h=Math.floor(sec/3600).toString().padStart(2,'0'); 
    const m=Math.floor((sec%3600)/60).toString().padStart(2,'0'); 
    const s=(sec%60).toString().padStart(2,'0'); 
    return `${h}:${m}:${s}`; 
}

module.exports = {
    init, 
    saveData, 
    saveTimerProgress, 
    loadData, 
    checkForRecoveredSession, 
    deleteItem, 
    logSession, 
    logScore, 
    formatTime,
    saveLastSelectedCourse,
    exportData,
    importData
};