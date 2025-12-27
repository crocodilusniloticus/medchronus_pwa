import { getLocalISODateString, generateUUID } from './utils-v2.2.27.js';
import { supabase } from './supabaseClient-v2.2.27.js';

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
            context: { course: refs.courseSelect.value, notes: refs.sessionNotes.value.trim() }
        };
    } else if (state.pomodoroState !== 'idle') {
        activeTimerData = {
            type: 'pomodoro',
            startTime: state.pomodoroStartTime,
            originalDuration: state.pomodoroOriginalDuration,
            isPaused: state.isPomodoroPaused,
            pausedRemainingSeconds: state.isPomodoroPaused ? state.pomodoroPausedTime : state.pomodoroSecondsLeft,
            pomodoroState: state.pomodoroState,
            context: { course: refs.pomodoroCourseSelect.value, notes: refs.pomodoroNotes.value.trim() }
        };
    } else if (state.isCountdownRunning || state.isCountdownPaused) {
        activeTimerData = {
            type: 'countdown',
            startTime: state.countdownStartTime,
            originalDuration: state.countdownOriginalDuration,
            isPaused: state.isCountdownPaused,
            pausedRemainingSeconds: state.isCountdownPaused ? state.countdownPausedTime : state.countdownSecondsLeft,
            context: { course: refs.countdownCourseSelect.value, notes: refs.countdownNotes.value.trim() }
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
    localStorage.setItem('settingsUpdatedAt', state.settingsUpdatedAt);
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

    // 2. Trigger Relational Cloud Sync
    await syncWithSupabase(forcePush);
}

export function loadData() {
    // Ensure every item has a UUID
    const ensureIDs = (arr) => arr.map(item => {
        if (!item.id) item.id = generateUUID();
        return item;
    });

    state.allSessions = ensureIDs(JSON.parse(localStorage.getItem('studySessions')) || []).filter(s => s && s.timestamp);
    state.allScores = ensureIDs(JSON.parse(localStorage.getItem('studyScores')) || []).filter(s => s && s.timestamp);
    state.allEvents = ensureIDs(JSON.parse(localStorage.getItem('studyEvents')) || []).map(e => ({...e, isDone: typeof e.isDone === 'boolean' ? e.isDone : false}));
    state.settingsUpdatedAt = localStorage.getItem('settingsUpdatedAt') || new Date(0).toISOString();
   
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

    // Trigger initial pull
    syncWithSupabase(false);
}

// -------------------------------------------------------------------------
// NEW RELATIONAL SYNC ENGINE
// -------------------------------------------------------------------------
export async function syncWithSupabase(forcePush = false) {
    if (isSyncing || !navigator.onLine) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; 

    isSyncing = true;
    updateSyncStatus(forcePush ? "Saving..." : "Syncing...", false);

    // 1. Get the time we last successfully synced
    const lastSyncStr = localStorage.getItem('lastSyncTimestamp');
    const lastSyncDate = lastSyncStr ? new Date(lastSyncStr) : null;

    try {
        let hasChanges = false;

        if (!forcePush) {
            const [sessionsReq, scoresReq, settingsReq] = await Promise.all([
                supabase.from('study_sessions').select('*'),
                supabase.from('exam_scores').select('*'),
                supabase.from('user_settings').select('*').single()
            ]);

            // Smart Merge: Handles Remote Deletions and Updates
            const smartMerge = (localArr, cloudArr, itemType) => {
                const cloudMap = new Map(cloudArr.map(i => [i.id, i]));
                const merged = [];
                const processedIds = new Set();

                // A. Process items that exist Locally
                localArr.forEach(localItem => {
                    if (cloudMap.has(localItem.id)) {
                        // 1. Exists in BOTH: Compare timestamps to see which is newer
                        const cloudItem = cloudMap.get(localItem.id);
                        
                        // Get timestamps (default to 0 if missing)
                        const localTime = new Date(localItem.savedAt || 0).getTime();
                        // Supabase usually returns snake_case 'saved_at'
                        const cloudTime = new Date(cloudItem.saved_at || cloudItem.savedAt || 0).getTime();

                        if (localTime > cloudTime) {
                            // Local is newer: Keep Local (will push to cloud later)
                            localItem.type = itemType;
                            merged.push(localItem);
                            hasChanges = true; // Flag that we have new data to push
                        } else {
                            // Cloud is newer (or equal): Keep Cloud
                            cloudItem.type = itemType;
                            // Ensure internal naming consistency (camelCase)
                            cloudItem.savedAt = cloudItem.saved_at || cloudItem.savedAt; 
                            merged.push(cloudItem);
                            
                            // Check if this actually changed our local data
                            if (JSON.stringify(localItem) !== JSON.stringify(cloudItem)) hasChanges = true;
                        }
                        processedIds.add(localItem.id);

                    } else {
                        // 2. Exists Locally, but MISSING in Cloud
                        const itemTime = new Date(localItem.savedAt || localItem.timestamp);
                        
                        // Logic: If the item is OLDER than our last sync, it must have been deleted on the cloud.
                        if (lastSyncDate && itemTime < lastSyncDate) {
                            hasChanges = true; // Drop it
                        } else {
                            // It's a "New" item created offline -> Keep it
                            merged.push(localItem);
                            processedIds.add(localItem.id);
                        }
                    }
                });

                // B. Add items that exist Only in Cloud
                cloudArr.forEach(cloudItem => {
                    if (!processedIds.has(cloudItem.id)) {
                        cloudItem.type = itemType;
                        cloudItem.savedAt = cloudItem.saved_at || cloudItem.savedAt; // Normalize
                        merged.push(cloudItem);
                        hasChanges = true;
                    }
                });

                return merged;
            };
            // Apply Smart Merge
            if (sessionsReq.data) state.allSessions = smartMerge(state.allSessions, sessionsReq.data, 'session');
            if (scoresReq.data) state.allScores = smartMerge(state.allScores, scoresReq.data, 'score');

            if (settingsReq.data) {
                const cloud = settingsReq.data;
                
                // Compare timestamps
                const cloudTime = new Date(cloud.updated_at || 0).getTime();
                const localTime = new Date(state.settingsUpdatedAt || 0).getTime();

                // ONLY accept cloud settings if they are NEWER than local
                if (cloudTime > localTime) {
                    if (cloud.courses) state.allCourses = cloud.courses;
                    
                    if (cloud.preferences) {
                        state.streakTarget = cloud.preferences.streakTarget || state.streakTarget;
                        state.heatmapTargetHours = cloud.preferences.heatmapTargetHours || state.heatmapTargetHours;
                        
                        if (cloud.preferences.pomodoroSettings) {
                            const p = cloud.preferences.pomodoroSettings;
                            state.pomodoroFocusDuration = p.focus || state.pomodoroFocusDuration;
                            state.pomodoroShortBreakDuration = p.shortBreak || state.pomodoroShortBreakDuration;
                            state.pomodoroLongBreakDuration = p.longBreak || state.pomodoroLongBreakDuration;
                        }
                    }
                    // Update local timestamp to match cloud so we are in sync
                    state.settingsUpdatedAt = cloud.updated_at;
                    localStorage.setItem('settingsUpdatedAt', state.settingsUpdatedAt);
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                localStorage.setItem('studySessions', JSON.stringify(state.allSessions));
                localStorage.setItem('studyScores', JSON.stringify(state.allScores));
                localStorage.setItem('studyCourses', JSON.stringify(state.allCourses));
                calculateStreak();
            }
        }

        // --- STEP 2: PUSH ---
        // (This part remains largely the same, but now we push the "Cleaned" list)
        const sessionPayload = state.allSessions.map(s => ({
            id: s.id,
            user_id: user.id,
            course: s.course,
            seconds: s.seconds || 0,
            duration: s.duration,
            notes: s.notes || "",
            timestamp: s.timestamp,
            saved_at: s.savedAt || new Date().toISOString()
        }));

        const scorePayload = state.allScores.map(s => ({
            id: s.id,
            user_id: user.id,
            course: s.course,
            score: s.score,
            notes: s.notes || "",
            timestamp: s.timestamp,
            saved_at: s.savedAt || new Date().toISOString()
        }));

        const settingsPayload = {
            user_id: user.id,
            courses: state.allCourses,
            preferences: {
                streakTarget: state.streakTarget,
                heatmapTargetHours: state.heatmapTargetHours,
                pomodoroSettings: {
                    focus: state.pomodoroFocusDuration,
                    shortBreak: state.pomodoroShortBreakDuration,
                    longBreak: state.pomodoroLongBreakDuration
                }
            },
            timers: JSON.parse(localStorage.getItem('activeTimer') || '{}'),
            updated_at: state.settingsUpdatedAt
        };

        await Promise.all([
            supabase.from('study_sessions').upsert(sessionPayload),
            supabase.from('exam_scores').upsert(scorePayload),
            supabase.from('user_settings').upsert(settingsPayload, { onConflict: 'user_id' })
        ]);

        // CRITICAL: Update timestamp ONLY after a successful sync
        localStorage.setItem('lastSyncTimestamp', new Date().toISOString());
        
        updateSyncStatus("Synced", false);

    } catch (err) {
        console.error("Supabase Sync Error:", err);
        updateSyncStatus("Sync Error", true);
    } finally {
        isSyncing = false;
        if (!forcePush) window.dispatchEvent(new CustomEvent('data-updated'));
    }
}

// --- OPTIMIZED DELETE ---
export async function deleteItem(id) { 
    // 1. Identify the Object first to get the REAL UUID
    // (The passed 'id' might be a timestamp, which Supabase won't accept as an ID)
    const sessionItem = state.allSessions.find(i => i.id === id || i.timestamp === id);
    const scoreItem = state.allScores.find(i => i.id === id || i.timestamp === id);
    
    // If not found, exit
    if (!sessionItem && !scoreItem) return;

    // Capture the definitive UUID from the object
    const targetId = sessionItem ? sessionItem.id : scoreItem.id;

    // 2. Local Delete
    if (sessionItem) {
        const index = state.allSessions.indexOf(sessionItem);
        if (index > -1) state.allSessions.splice(index, 1);
    }
    if (scoreItem) {
        const index = state.allScores.indexOf(scoreItem);
        if (index > -1) state.allScores.splice(index, 1);
    }
    
    // 3. Save Local
    localStorage.setItem('studySessions', JSON.stringify(state.allSessions));
    localStorage.setItem('studyScores', JSON.stringify(state.allScores));
    
    // 4. Cloud Delete (Direct)
    const { data: { user } } = await supabase.auth.getUser();
    if (user && targetId) {
        // Use targetId (the real UUID) instead of the raw argument
        if (sessionItem) {
            await supabase.from('study_sessions').delete().eq('id', targetId);
        }
        if (scoreItem) {
            await supabase.from('exam_scores').delete().eq('id', targetId);
        }
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
            if (recoveredTimer.type === 'stopwatch') {
                state.stopwatchStartTime = recoveredTimer.startTime;
                state.isStopwatchRunning = true;
            } 
            else if (recoveredTimer.type === 'pomodoro') {
                const elapsedSinceStart = Math.floor((now - recoveredTimer.startTime) / 1000);
                const duration = recoveredTimer.originalDuration;
                
                if (elapsedSinceStart >= duration) {
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
                    return; 
                } else {
                    state.pomodoroStartTime = recoveredTimer.startTime;
                    state.pomodoroOriginalDuration = recoveredTimer.originalDuration;
                    state.pomodoroState = recoveredTimer.pomodoroState;
                    state.isPomodoroPaused = false;
                }
            } 
            else if (recoveredTimer.type === 'countdown') {
                const elapsedSinceStart = Math.floor((now - recoveredTimer.startTime) / 1000);
                const duration = recoveredTimer.originalDuration;

                if (elapsedSinceStart >= duration) {
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
                    state.countdownStartTime = recoveredTimer.startTime;
                    state.countdownOriginalDuration = recoveredTimer.originalDuration;
                    state.isCountdownRunning = true;
                }
            }
        }

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

export function logSession(course, seconds, notes, startTimeStamp) { 
    state.allSessions.push({ 
        id: generateUUID(),
        type:'session',
        course: course,
        duration: formatTime(seconds),
        seconds: seconds,
        notes: notes.trim(),
        timestamp: startTimeStamp || new Date().toISOString(),
        savedAt: new Date().toISOString()
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
        timestamp:new Date().toISOString(),
        savedAt: new Date().toISOString()
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