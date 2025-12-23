import { getLocalISODateString, generateUUID } from './utils.js?v=2.2.6';
import { supabase } from './supabaseClient.js?v=2.2.6';

let state, refs;
let isSyncing = false;

export function init(appState, uiRefs) {
    state = appState;
    refs = uiRefs;
}

export function saveLastSelectedCourse() {
    if (state.lastSelectedCourse) {
        localStorage.setItem('lastSelectedCourse', state.lastSelectedCourse);
    }
}

export function saveTimerProgress() {
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

export async function saveData(forcePush = false) {
    // 1. Save to Local Storage (Instant)
    localStorage.setItem('studySessions', JSON.stringify(state.allSessions));
    localStorage.setItem('studyScores', JSON.stringify(state.allScores));
    localStorage.setItem('studyEvents', JSON.stringify(state.allEvents));
    localStorage.setItem('studyCourses', JSON.stringify(state.allCourses));
    localStorage.setItem('streakTarget', state.streakTarget);
    localStorage.setItem('streakMinMinutes', state.streakMinMinutes);
    localStorage.setItem('heatmapTargetHours', state.heatmapTargetHours);
    localStorage.setItem('heatmapOverdriveHours', state.heatmapOverdriveHours);

    const pomodoroSettings = {
        focus: state.pomodoroFocusDuration,
        shortBreak: state.pomodoroShortBreakDuration,
        longBreak: state.pomodoroLongBreakDuration
    };
    localStorage.setItem('pomodoroSettings', JSON.stringify(pomodoroSettings));
    
    saveTimerProgress();
    calculateStreak();

    // 2. Trigger Cloud Sync
    await syncWithSupabase(forcePush);
}

export function loadData() {
    // Helper to ensure every item has a UUID for reliable syncing
    const ensureIDs = (arr) => arr.map(item => {
        if (!item.id) {
    // Falls back to timestamp if available, ensuring Device A and B generate the same ID
    item.id = item.timestamp ? `legacy-${item.timestamp}` : generateUUID();
}
        return item;
    });

    state.allSessions = ensureIDs(JSON.parse(localStorage.getItem('studySessions')) || [])
        .filter(s => s && s.timestamp && s.course);
    state.allScores = ensureIDs(JSON.parse(localStorage.getItem('studyScores')) || [])
        .filter(s => s && s.timestamp && s.course);
    state.allEvents = ensureIDs(JSON.parse(localStorage.getItem('studyEvents')) || [])
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

    const savedPomo = JSON.parse(localStorage.getItem('pomodoroSettings'));
    if (savedPomo) {
        state.pomodoroFocusDuration = savedPomo.focus || 50;
        state.pomodoroShortBreakDuration = savedPomo.shortBreak || 10;
        state.pomodoroLongBreakDuration = savedPomo.longBreak || 20;
    }

    let savedAlarm = localStorage.getItem('alarmSound') || '';
    if (savedAlarm && refs.alarmSound) {
        refs.alarmSound.src = savedAlarm;
    }

    const savedCountdown = JSON.parse(localStorage.getItem('countdownValues'));
    if (savedCountdown) {
        refs.countdownHours.value = savedCountdown.h ?? 0;
        refs.countdownMinutes.value = savedCountdown.m ?? 30;
        refs.countdownSeconds.value = savedCountdown.s ?? 0;
    }

    calculateStreak();
}

// -------------------------------------------------------------------------
// SYNC ENGINE (UUID Aware)
// -------------------------------------------------------------------------
export async function syncWithSupabase(forcePush = false) {
    if (isSyncing || !navigator.onLine) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; 

    isSyncing = true;
    updateSyncStatus(forcePush ? "Deleting..." : "Syncing...", false);

    try {
        let merged = false;

        // STEP 1: Fetch Cloud Data (ONLY if NOT force pushing)
        if (!forcePush) {
            const { data: cloudRow, error } = await supabase
                .from('user_data')
                .select('content')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (cloudRow && cloudRow.content) {
                const cloudData = cloudRow.content;
                
                // UUID-Based Smart Merge
                // If ID exists, match by ID. If not, match by Timestamp (Legacy).
                // Local edits override Cloud.
                const mergeArrays = (localArr, cloudArr) => {
                    const map = new Map();
                    
                    // 1. Put Cloud items in map
                    cloudArr.forEach(item => {
                        const key = item.id || item.timestamp;
                        if(key) map.set(key, item);
                    });

                    // 2. Overwrite with Local items
                    localArr.forEach(item => {
                        // Ensure local item has ID
                        if(!item.id) item.id = generateUUID(); 
                        const key = item.id || item.timestamp;
                        if(key) map.set(key, item);
                    });
                    
                    return Array.from(map.values());
                };

                const mergedSessions = mergeArrays(state.allSessions, cloudData.sessions || []);
                const mergedScores = mergeArrays(state.allScores, cloudData.scores || []);
                const mergedEvents = mergeArrays(state.allEvents, cloudData.events || []);
                const mergedCourses = [...new Set([...state.allCourses, ...(cloudData.courses || [])])].sort();

                // Check for differences
                if (mergedSessions.length !== state.allSessions.length || 
                    mergedScores.length !== state.allScores.length || 
                    mergedEvents.length !== state.allEvents.length) {
                    
                    state.allSessions = mergedSessions;
                    state.allScores = mergedScores;
                    state.allEvents = mergedEvents;
                    state.allCourses = mergedCourses;
                    
                    saveData(false); 
                    merged = true;
                }
            }
        }

        // STEP 2: Push Local Data to Cloud
        const payload = {
            sessions: state.allSessions,
            scores: state.allScores,
            events: state.allEvents,
            courses: state.allCourses,
            preferences: {
                streakTarget: state.streakTarget,
                heatmapTarget: state.heatmapTargetHours,
            }
        };

        const { error: upsertError } = await supabase
            .from('user_data')
            .upsert({ user_id: user.id, content: payload });

        if (upsertError) throw upsertError;

        updateSyncStatus(forcePush ? "Item Deleted" : (merged ? "Cloud Merged" : "Cloud Saved"), false);

    } catch (err) {
        console.error("Supabase Sync Error:", err);
        updateSyncStatus("Cloud Error", true);
    } finally {
        isSyncing = false;
        window.dispatchEvent(new CustomEvent('data-updated'));
    }
}

function updateSyncStatus(msg, isError) {
    if (refs.syncStatus) {
        refs.syncStatus.textContent = msg;
        refs.syncStatus.style.opacity = '1';
        refs.syncStatus.style.color = isError ? 'var(--danger)' : 'var(--success)';
        setTimeout(() => { 
            if(refs.syncStatus) refs.syncStatus.style.opacity = '0'; 
        }, 3000);
    }
}

// -------------------------------------------------------------------------
// RECOVERY LOGIC (Timer Persistence)
// -------------------------------------------------------------------------

export function restoreActiveTimer() {
    const recoveredTimer = JSON.parse(localStorage.getItem('activeTimer'));
    if (!recoveredTimer || !recoveredTimer.startTime) {
        localStorage.removeItem('activeTimer');
        return;
    }

    const now = Date.now();
    
    try {
        if (recoveredTimer.isPaused) {
            // If paused, we just reload the state variables
            if (recoveredTimer.type === 'stopwatch') {
                state.stopwatchStartTime = recoveredTimer.startTime;
                state.stopwatchSeconds = recoveredTimer.pausedSeconds;
                state.isStopwatchPaused = true;
                state.isStopwatchRunning = false;
            } else if (recoveredTimer.type === 'pomodoro') {
                state.pomodoroStartTime = recoveredTimer.startTime;
                state.pomodoroOriginalDuration = recoveredTimer.originalDuration;
                state.pomodoroState = recoveredTimer.pomodoroState;
                state.pomodoroPausedTime = recoveredTimer.pausedRemainingSeconds;
                state.isPomodoroPaused = true;
                // UI needs secondsLeft to display correct time
                state.pomodoroSecondsLeft = recoveredTimer.pausedRemainingSeconds;
            } else if (recoveredTimer.type === 'countdown') {
                state.countdownStartTime = recoveredTimer.startTime;
                state.countdownOriginalDuration = recoveredTimer.originalDuration;
                state.countdownPausedTime = recoveredTimer.pausedRemainingSeconds;
                state.isCountdownPaused = true;
                state.isCountdownRunning = false;
                state.countdownSecondsLeft = recoveredTimer.pausedRemainingSeconds;
            }
        } else {
            // Timer was RUNNING. Calculate if it finished while we were gone.
            
            if (recoveredTimer.type === 'stopwatch') {
                // Stopwatch never "finishes" on its own. It keeps running.
                state.stopwatchStartTime = recoveredTimer.startTime;
                state.isStopwatchRunning = true;
                // stopwatchSeconds will be calculated in timers.js startTimer loop
            } 
            else if (recoveredTimer.type === 'pomodoro') {
                const elapsedSinceStart = Math.floor((now - recoveredTimer.startTime) / 1000);
                const duration = recoveredTimer.originalDuration;
                
                if (elapsedSinceStart >= duration) {
                    // It finished while closed
                    if (recoveredTimer.pomodoroState === 'studying') {
                        state.allSessions.push({ 
                            id: generateUUID(),
                            type:'session',
                            course: recoveredTimer.context.course,
                            duration: formatTime(duration),
                            seconds: duration,
                            notes: `${recoveredTimer.context.notes || ''}`.trim(), 
                            timestamp: new Date(recoveredTimer.startTime).toISOString()
                        });
                        saveData();
                    }
                    localStorage.removeItem('activeTimer');
                    return; // Done
                } else {
                    // Still running
                    state.pomodoroStartTime = recoveredTimer.startTime;
                    state.pomodoroOriginalDuration = recoveredTimer.originalDuration;
                    state.pomodoroState = recoveredTimer.pomodoroState;
                    state.isPomodoroPaused = false;
                    // Will be updated by interval
                }
            } 
            else if (recoveredTimer.type === 'countdown') {
                const elapsedSinceStart = Math.floor((now - recoveredTimer.startTime) / 1000);
                const duration = recoveredTimer.originalDuration;

                if (elapsedSinceStart >= duration) {
                    // Finished
                     state.allSessions.push({ 
                        id: generateUUID(),
                        type:'session',
                        course: recoveredTimer.context.course,
                        duration: formatTime(duration),
                        seconds: duration,
                        notes: `${recoveredTimer.context.notes || ''}`.trim(), 
                        timestamp: new Date(recoveredTimer.startTime).toISOString()
                    });
                    saveData();
                    localStorage.removeItem('activeTimer');
                    return;
                } else {
                    // Still running
                    state.countdownStartTime = recoveredTimer.startTime;
                    state.countdownOriginalDuration = recoveredTimer.originalDuration;
                    state.isCountdownRunning = true;
                }
            }
        }

        // Restore Input Context
        if (recoveredTimer.context) {
            if (recoveredTimer.type === 'stopwatch') {
                refs.courseSelect.value = recoveredTimer.context.course;
                refs.sessionNotes.value = recoveredTimer.context.notes;
            } else if (recoveredTimer.type === 'pomodoro') {
                refs.pomodoroCourseSelect.value = recoveredTimer.context.course;
                refs.pomodoroNotes.value = recoveredTimer.context.notes;
            } else if (recoveredTimer.type === 'countdown') {
                refs.countdownCourseSelect.value = recoveredTimer.context.course;
                refs.countdownNotes.value = recoveredTimer.context.notes;
            }
        }

    } catch (err) {
        console.error("Error restoring timer:", err);
        localStorage.removeItem('activeTimer');
    }
}

export function checkForRecoveredSession() {
    restoreActiveTimer();
}

// -------------------------------------------------------------------------
// STANDARD LOGIC
// -------------------------------------------------------------------------

export function calculateStreak() {
    if (!state.allSessions || state.allSessions.length === 0) {
        state.streakCount = 0;
        return;
    }
    const dailyTotals = {};
    state.allSessions.forEach(s => {
        const dateStr = getLocalISODateString(new Date(s.timestamp));
        dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + (s.seconds || 0);
    });

    const targetHours = state.heatmapTargetHours || 8;
    const minSeconds = targetHours * 3600;
    const validDates = Object.keys(dailyTotals).filter(date => dailyTotals[date] >= minSeconds);
    const sortedDates = validDates.sort((a, b) => new Date(b) - new Date(a)); 

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
    if (sortedDates[0] === yesterdayStr) checkDate = new Date(yesterday);
    
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

export function exportData() {
    const data = {
        sessions: state.allSessions,
        scores: state.allScores,
        events: state.allEvents,
        courses: state.allCourses,
        preferences: {
            streakTarget: state.streakTarget,
            heatmapTarget: state.heatmapTargetHours,
            lastCourse: state.lastSelectedCourse,
            countdown: JSON.parse(localStorage.getItem('countdownValues')),
            pomodoroSettings: JSON.parse(localStorage.getItem('pomodoroSettings'))
        }
    };
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `medchronos_backup_${getLocalISODateString(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data.sessions)) throw new Error("Invalid data format");

            state.allSessions = data.sessions;
            state.allScores = data.scores || [];
            state.allEvents = data.events || [];
            state.allCourses = data.courses || state.allCourses;
            
            if (data.preferences) {
                state.streakTarget = data.preferences.streakTarget || 7;
                state.heatmapTargetHours = data.preferences.heatmapTarget || 8;
                state.lastSelectedCourse = data.preferences.lastCourse;
                if (data.preferences.pomodoroSettings) localStorage.setItem('pomodoroSettings', JSON.stringify(data.preferences.pomodoroSettings));
            }
            saveData(); 
            alert("Data imported successfully! Reloading...");
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert("Error importing data.");
        }
    };
    reader.readAsText(file);
}

export async function deleteItem(idOrTimestamp) { 
    // Delete by ID first, fallback to timestamp
    state.allSessions = state.allSessions.filter(i => (i.id !== idOrTimestamp && i.timestamp !== idOrTimestamp)); 
    state.allScores = state.allScores.filter(i => (i.id !== idOrTimestamp && i.timestamp !== idOrTimestamp)); 
    state.allEvents = state.allEvents.filter(i => (i.id !== idOrTimestamp && i.timestamp !== idOrTimestamp)); 
    
    await saveData(true); 
}

export function logSession(course, seconds, notes, startTimeStamp) { 
    state.allSessions.push({ 
        id: generateUUID(),
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

export function logScore() { 
    const s = parseInt(refs.scoreInput.value, 10); 
    if(isNaN(s) || s < 0 || s > 100){
        refs.scoreError.textContent = '0-100 only.';
        return false;
    }
    refs.scoreError.textContent = ''; 
    state.allScores.push({
        id: generateUUID(),
        type:'score',
        course: refs.scoreCourseSelect.value,
        score:s,
        notes: refs.scoreNotes.value.trim(),
        timestamp:new Date().toISOString()
    }); 
    saveData(); 
    refs.scoreInput.value='';
    refs.scoreNotes.value='';
    return true;
}

export function formatTime(sec) { 
    const h=Math.floor(sec/3600).toString().padStart(2,'0'); 
    const m=Math.floor((sec%3600)/60).toString().padStart(2,'0'); 
    const s=(sec%60).toString().padStart(2,'0'); 
    return `${h}:${m}:${s}`; 
}