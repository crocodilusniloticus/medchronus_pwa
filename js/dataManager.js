import { getLocalISODateString } from './utils.js';
import { supabase } from './supabaseClient.js';

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

// -------------------------------------------------------------------------
// FIX: Added 'forcePush' to skip merging when we just deleted something
// -------------------------------------------------------------------------
export async function saveData(forcePush = false) {
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

    // Pass the forcePush flag to the sync function
    await syncWithSupabase(forcePush);
}

export function loadData() {
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

    const savedPomo = JSON.parse(localStorage.getItem('pomodoroSettings'));
    if (savedPomo) {
        state.pomodoroFocusDuration = savedPomo.focus || 50;
        state.pomodoroShortBreakDuration = savedPomo.shortBreak || 10;
        state.pomodoroLongBreakDuration = savedPomo.longBreak || 20;
    }

    let savedAlarm = localStorage.getItem('alarmSound') || '';
    if (savedAlarm && refs.alarmSound) {
        // PWA restriction: can't usually load absolute file paths, but if local setup allows:
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
// FIX: Modified Sync to handle Deletions correctly
// -------------------------------------------------------------------------
export async function syncWithSupabase(forcePush = false) {
    if (isSyncing || !navigator.onLine) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Not logged in

    isSyncing = true;
    updateSyncStatus("Syncing Cloud...", false);

    try {
        let merged = false;

        // ONLY fetch data if we are NOT force pushing.
        // If forcePush is true (e.g. after a delete), we assume local data is the authority.
        if (!forcePush) {
            // 1. Fetch Cloud Data
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
                
                // 2. Smart Merge (Deduplicate based on timestamp)
                const mergeArrays = (localArr, cloudArr) => {
                    const map = new Map();
                    [...localArr, ...cloudArr].forEach(item => {
                        if (item.timestamp) map.set(item.timestamp, item);
                    });
                    return Array.from(map.values());
                };

                const mergedSessions = mergeArrays(state.allSessions, cloudData.sessions || []);
                const mergedScores = mergeArrays(state.allScores, cloudData.scores || []);
                const mergedEvents = mergeArrays(state.allEvents, cloudData.events || []);
                const mergedCourses = [...new Set([...state.allCourses, ...(cloudData.courses || [])])].sort();

                // Detect if we actually changed anything locally
                if (mergedSessions.length !== state.allSessions.length || 
                    mergedScores.length !== state.allScores.length || 
                    mergedEvents.length !== state.allEvents.length) {
                    
                    state.allSessions = mergedSessions;
                    state.allScores = mergedScores;
                    state.allEvents = mergedEvents;
                    state.allCourses = mergedCourses;
                    
                    // Update local storage without triggering another sync loop
                    saveData(false); // forcePush = false here to avoid infinite loop
                    merged = true;
                }
            }
        }

        // 3. Push Data to Cloud (Upsert)
        // If forcePush was true, we skipped step 1 & 2, so we are overwriting cloud with local state.
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

        updateSyncStatus(merged ? "Cloud Merged" : "Cloud Saved", false);

    } catch (err) {
        console.error("Supabase Sync Error:", err);
        updateSyncStatus("Cloud Error", true);
    } finally {
        isSyncing = false;
        // Trigger UI refresh if data changed
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
        }, 4000);
    }
}

// --- STANDARD FUNCTIONS ---

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

export function checkForRecoveredSession() {
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

        if (recoveredTimer.type === 'stopwatch') elapsedSeconds = recoveredTimer.pausedSeconds;
        else if (recoveredTimer.type === 'pomodoro' && recoveredTimer.pomodoroState === 'studying') elapsedSeconds = recoveredTimer.originalDuration - recoveredTimer.pausedRemainingSeconds;
        else if (recoveredTimer.type === 'countdown') elapsedSeconds = recoveredTimer.originalDuration - recoveredTimer.pausedRemainingSeconds;

        if (elapsedSeconds >= 1) { 
            state.allSessions.push({ 
                type:'session',
                course: course,
                duration: formatTime(elapsedSeconds),
                seconds: elapsedSeconds,
                notes: `${notes || ''}`.trim(), 
                timestamp: timestamp
            });
            saveData(); 
        }

    } catch (err) {
        console.error(err);
    }
    localStorage.removeItem('activeTimer'); 
}

// -------------------------------------------------------------------------
// FIX: Call saveData(true) to force Cloud Overwrite
// -------------------------------------------------------------------------
export function deleteItem(timestamp) { 
    state.allSessions = state.allSessions.filter(i => i.timestamp !== timestamp); 
    state.allScores = state.allScores.filter(i => i.timestamp !== timestamp); 
    state.allEvents = state.allEvents.filter(i => i.timestamp !== timestamp); 
    
    // Pass TRUE to force overwrite cloud data (preventing zombie resurrection)
    saveData(true); 
}

export function logSession(course, seconds, notes, startTimeStamp) { 
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

export function logScore() { 
    const s = parseInt(refs.scoreInput.value, 10); 
    if(isNaN(s) || s < 0 || s > 100){
        refs.scoreError.textContent = '0-100 only.';
        return false;
    }
    refs.scoreError.textContent = ''; 
    state.allScores.push({type:'score',course: refs.scoreCourseSelect.value,score:s,notes: refs.scoreNotes.value.trim(),timestamp:new Date().toISOString()}); 
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