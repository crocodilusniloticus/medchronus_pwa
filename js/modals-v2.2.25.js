import { getLocalISODateString, injectJalaaliDate, generateUUID } from './utils-v2.2.25.js';
import { saveAudioFile, getAudioFile } from './database-v2.2.25.js';
import { upsertEventToGoogle } from './googleSync-v2.2.25.js'; // Import the new function

let state, refs, dataManager, updateAllDisplays;
let getTimeChartOptions, getScoreChartOptions, getCharts, getTrendChartOptions; 
let editDatePickerInstance = null; 

// --- AUDIO ENGINE VARIABLES ---
let beepCtx = null;
let backgroundCtx = null; // The "Keep Alive" context
let beepInterval = null;  // For looping the fallback beep

// A tiny silence snippet (MP3) to ensure the Audio Element is valid during Prime
const SILENT_MP3 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////wAAAP//OEAAAAAAAAAAAAAAAAAAAAAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAAAAAAAAAAAAACCAAAAAAAAABExAAAAMZAAAAAAAAAAAA//OEZAAABIAAAAkAAACAAAAAAAAAAAAAAP/zgEAAACAAAAAAAAAAAAAA//OEQAAACAAAAAAAAAAAAAA//OIQAAACAAAAAAAAAAAAAA==";

export function primeAudioEngine() {
    // 1. Prime the HTML Audio Element
    if (refs.alarmSound) {
        // FIX: If no source exists, inject silence so .play() actually works and unlocks the channel
        if (!refs.alarmSound.src || refs.alarmSound.src === window.location.href) {
            refs.alarmSound.src = SILENT_MP3;
        }
        
        refs.alarmSound.volume = 0.01; // Non-zero for iOS sometimes helps
        
        const playPromise = refs.alarmSound.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // Success! The channel is unlocked.
                // We pause it immediately.
                refs.alarmSound.pause();
                refs.alarmSound.currentTime = 0;
            }).catch((e) => {
                // console.warn("Audio Prime failed (user interaction required):", e);
            });
        }
    }

    // 2. Start "The Silent Heartbeat" (Low Power Mode)
    // This keeps the CPU awake (~1% battery/hour) so the timer doesn't freeze.
    if (!backgroundCtx) {
        backgroundCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (backgroundCtx.state === 'suspended') {
        backgroundCtx.resume().then(() => {
            // Create a generated silent tone (Low CPU usage)
            const oscillator = backgroundCtx.createOscillator();
            const gainNode = backgroundCtx.createGain();
            
            // Set volume to barely non-zero (prevents iOS from killing the thread)
            gainNode.gain.value = 0.0001; 
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 20; // 20Hz (Low rumble, inaudible)
            
            oscillator.connect(gainNode);
            gainNode.connect(backgroundCtx.destination);
            
            oscillator.start();
            // We let this run forever. It acts as the "heartbeat".
        }).catch(() => {});
    }

    // 3. Prepare the Beep Context (Fallback)
    if (!beepCtx) {
        beepCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (beepCtx.state === 'suspended') {
        beepCtx.resume().catch(() => {});
    }
}

export function init(appState, uiRefs, dataMgr, updateFn, timeChartFn, scoreChartFn, getChartsFn, trendChartFn) {
    state = appState;
    refs = uiRefs;
    dataManager = dataMgr;
    updateAllDisplays = updateFn;
    
    getTimeChartOptions = timeChartFn;
    getScoreChartOptions = scoreChartFn;
    getCharts = getChartsFn;
    getTrendChartOptions = trendChartFn;

    // --- iOS UNLOCKER ---
    // Trigger on the very first touch to unlock audio capabilities
    document.addEventListener('touchstart', primeAudioEngine, { once: true, capture: true });
    document.addEventListener('click', primeAudioEngine, { once: true, capture: true });

    // --- STOP BUTTON LISTENER ---
    document.addEventListener('stop-alarm', () => playAlarm(true));
}

export function showEventModal(date, timestamp = null) { 
    refs.eventError.textContent = ''; 
    if (timestamp) { 
        const event = state.allEvents.find(e => e.timestamp === timestamp); 
        if (!event) return; 
        refs.modalTitle.textContent = 'Edit Deadline'; 
        refs.eventText.value = event.title; 
        refs.eventTimestamp.value = event.timestamp; 
        if(refs.eventPriority) { refs.eventPriority.value = event.priority || 'low'; } 
        state.eventModalPicker.setDate(event.date); 
    } else { 
        refs.modalTitle.textContent = `Add Deadline`; 
        refs.eventText.value = ''; 
        refs.eventTimestamp.value = ''; 
        if(refs.eventPriority) refs.eventPriority.value = 'low'; 
        state.eventModalPicker.setDate(date || new Date()); 
    } 
    if(refs.eventModal) refs.eventModal.style.display = 'flex'; 
    refs.eventText.focus(); 
}
export function hideEventModal() { refs.eventModal.style.display = 'none'; }

export async function saveEvent() { 
    const title = refs.eventText.value.trim(); 
    const date = refs.eventDatePicker.value; 
    const ts = refs.eventTimestamp.value; 
    const priority = refs.eventPriority.value; 
    
    if (!title) { refs.eventError.textContent = 'Event title cannot be empty.'; return; } 
    if (!date) { refs.eventError.textContent = 'Please select a due date.'; return; } 
    
    let activeEvent = null;

    // 1. UPDATE LOCAL STATE (Optimistic)
    if (ts) { 
        // Editing existing
        const eventIndex = state.allEvents.findIndex(e => e.timestamp === ts); 
        if (eventIndex > -1) { 
            state.allEvents[eventIndex].title = title; 
            state.allEvents[eventIndex].date = date; 
            state.allEvents[eventIndex].priority = priority; 
            // Keep googleId if it exists
            activeEvent = state.allEvents[eventIndex];
        } 
    } else { 
        // Creating new
        const newId = generateUUID();
        activeEvent = { 
            id: newId, // Temporary ID until Google assigns one (or permanent if offline)
            type: 'event', 
            title: title, 
            date: date, 
            priority: priority, 
            timestamp: new Date().toISOString(), 
            isDone: false,
            googleId: null
        };
        state.allEvents.push(activeEvent); 
    } 
    
    // 2. SAVE LOCAL & UPDATE UI
    dataManager.saveData(); 
    state.isSavingEvent = true; 
    hideEventModal(); 
    if (state.calendar) state.calendar.setDate([], false); 
    updateAllDisplays(); 

    // 3. PUSH TO GOOGLE (Background)
    if (activeEvent) {
        const result = await upsertEventToGoogle(activeEvent);
        if (result.success && result.googleId) {
            // Update the local event with the confirmed Google ID
            activeEvent.googleId = result.googleId;
            activeEvent.id = result.googleId; // Use Google ID as main ID
            dataManager.saveData(); // Save the ID persistence
        } else if (result.error && result.error !== "Offline") {
             // Optional: Toast error
             console.warn("Google Sync Warning:", result.error);
        }
    }
}

export function showConfirmModal(identifier, isTask = false, itemType = 'log') { 
    refs.itemToProcess.value = identifier; 
    refs.itemToProcess.dataset.itemType = itemType; 
    refs.confirmDeleteButton.style.backgroundColor = 'var(--red)'; 
    refs.confirmDeleteButton.textContent = 'Delete'; 
    
    if (itemType === 'course') { 
        refs.modalConfirmTitle.textContent = 'Delete Course?'; 
        refs.modalConfirmText.textContent = `Are you sure you want to delete the course "${identifier}"? This will not affect existing log entries.`; 
    } else if (itemType === 'task_permanent') { 
        refs.modalConfirmTitle.textContent = 'Delete Task Permanently?'; 
        refs.modalConfirmText.textContent = 'This will remove the task from history. Use "Done" if you just finished it.'; 
    } else { 
        refs.modalConfirmTitle.textContent = 'Are you sure?'; 
        refs.modalConfirmText.textContent = 'Are you sure you want to delete this item? This action cannot be undone.'; 
    } 
    refs.confirmModal.style.display = 'flex'; 
}
export function hideConfirmModal() { refs.itemToProcess.value = ''; refs.confirmModal.style.display = 'none'; }

export function showEditModal(timestamp) { 
    let item = state.allSessions.find(s => s.timestamp === timestamp); 
    let itemType = 'session'; 
    if (!item) { 
        item = state.allScores.find(s => s.timestamp === timestamp); 
        itemType = 'score'; 
    } 
    if (!item) return; 
    
    refs.editTimestamp.value = timestamp; 
    refs.editCourseSelect.value = item.course; 
    refs.editNotes.value = item.notes || ''; 
    refs.editError.textContent = ''; 
    
    if (!editDatePickerInstance) { 
        editDatePickerInstance = window.flatpickr(refs.editDatePicker, { 
            dateFormat: "Y-m-d", 
            defaultDate: new Date(timestamp), 
            locale: 'fa', 
            onDayCreate: (dObj, dStr, fp, dayElem) => { injectJalaaliDate(dayElem); } 
        }); 
    } else { 
        editDatePickerInstance.setDate(new Date(timestamp)); 
    } 
    
    if (itemType === 'session') { 
        refs.editSessionGroup.style.display = 'block'; 
        refs.editDuration.value = item.duration; 
        refs.editScoreGroup.style.display = 'none'; 
    } else { 
        refs.editSessionGroup.style.display = 'none'; 
        refs.editScoreGroup.style.display = 'block'; 
        refs.editScore.value = item.score; 
    } 
    refs.editModal.style.display = 'flex'; 
}
export function hideEditModal() { refs.editModal.style.display = 'none'; }

export function saveEdit() { 
    const ts = refs.editTimestamp.value; 
    const newCourse = refs.editCourseSelect.value; 
    const newNotes = refs.editNotes.value.trim(); 
    const newDateStr = refs.editDatePicker.value; 
    
    let sessionItem = state.allSessions.find(s => s.timestamp === ts); 
    let scoreItem = state.allScores.find(s => s.timestamp === ts); 
    let activeItem = sessionItem || scoreItem; 
    
    if (activeItem) { 
        if(!activeItem.id) activeItem.id = generateUUID();
        if (newDateStr) { 
            const originalDateObj = new Date(ts); 
            const newDateObj = new Date(newDateStr); 
            newDateObj.setHours(originalDateObj.getHours(), originalDateObj.getMinutes(), originalDateObj.getSeconds()); 
            activeItem.timestamp = newDateObj.toISOString(); 
        } 
        activeItem.course = newCourse; 
        activeItem.notes = newNotes; 
        
        if (sessionItem) { 
            const newDuration = refs.editDuration.value; 
            if (!/^\d{2}:\d{2}:\d{2}$/.test(newDuration)) { 
                refs.editError.textContent = "Duration must be in HH:MM:SS format."; 
                return; 
            } 
            const parts = newDuration.split(':').map(Number); 
            activeItem.seconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2]; 
            activeItem.duration = newDuration; 
        } else if (scoreItem) { 
            const newScore = parseInt(refs.editScore.value, 10); 
            if(isNaN(newScore) || newScore < 0 || newScore > 100){ 
                refs.editError.textContent = 'Score must be a number from 0-100.'; 
                return; 
            } 
            activeItem.score = newScore; 
        } 
        dataManager.saveData(); 
        updateAllDisplays(); 
        hideEditModal(); 
    } 
}

export function showPomodoroPrompt(phaseName, nextDuration) { refs.pomodoroPromptTitle.textContent = "Phase Complete!"; if (phaseName === 'studying') { refs.pomodoroPromptText.textContent = "Break is over. Ready to focus?"; refs.pomodoroPromptConfirmBtn.textContent = `Start Focus (${state.pomodoroFocusDuration}m)`; } else { refs.pomodoroPromptText.textContent = "Great job! Time for a break?"; const breakType = phaseName === 'shortBreak' ? 'Short' : 'Long'; const breakMins = phaseName === 'shortBreak' ? (state.pomodoroShortBreakDuration || 10) : (state.pomodoroLongBreakDuration || 20); refs.pomodoroPromptConfirmBtn.textContent = `Start ${breakType} Break (${breakMins}m)`; } refs.pomodoroPromptModal.style.display = 'flex'; }
export function hidePomodoroPrompt() { refs.pomodoroPromptModal.style.display = 'none'; }
export function showCoursesModal() { refs.coursesModal.style.display = 'flex'; refs.newCourseName.focus(); }
export function hideCoursesModal() { refs.coursesModal.style.display = 'none'; }
export function addCourse() { const name = refs.newCourseName.value.trim(); if (name && !state.allCourses.includes(name)) { state.allCourses.push(name); state.allCourses.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())); dataManager.saveData(); updateAllDisplays(); refs.newCourseName.value = ''; } }
export function deleteCourse(courseName) { state.allCourses = state.allCourses.filter(c => c !== courseName); dataManager.saveData(); updateAllDisplays(); }
export function showSettingsModal() { if(refs.settingsModal) refs.settingsModal.style.display = 'flex'; if(refs.deadlineUrgencyInput) refs.deadlineUrgencyInput.value = state.deadlineUrgencyDays; if(refs.settingHeatmapTarget) refs.settingHeatmapTarget.value = state.heatmapTargetHours; if(refs.settingFocusDuration) refs.settingFocusDuration.value = state.pomodoroFocusDuration || 50; if(refs.settingShortBreakDuration) refs.settingShortBreakDuration.value = state.pomodoroShortBreakDuration || 10; if(refs.settingLongBreakDuration) refs.settingLongBreakDuration.value = state.pomodoroLongBreakDuration || 20; }
export function hideSettingsModal() { refs.settingsModal.style.display = 'none'; }
export function saveSettings() { const urgency = parseInt(refs.deadlineUrgencyInput.value); if(urgency && urgency > 0) state.deadlineUrgencyDays = urgency; if(refs.settingHeatmapTarget) { const val = parseFloat(refs.settingHeatmapTarget.value); if(val > 0) state.heatmapTargetHours = val; } if(refs.settingFocusDuration) { const val = parseInt(refs.settingFocusDuration.value); if(val > 0) state.pomodoroFocusDuration = val; } if(refs.settingShortBreakDuration) { const val = parseInt(refs.settingShortBreakDuration.value); if(val > 0) state.pomodoroShortBreakDuration = val; } if(refs.settingLongBreakDuration) { const val = parseInt(refs.settingLongBreakDuration.value); if(val > 0) state.pomodoroLongBreakDuration = val; } dataManager.saveData(); updateAllDisplays(); hideSettingsModal(); }

// --- UPDATED PLAY ALARM ---
export async function playAlarm(stop = false) { 
    const stopBtn = document.getElementById('global-stop-alarm-btn');

    if (stop) { 
        // STOP
        if(refs.alarmSound) {
            refs.alarmSound.pause(); 
            refs.alarmSound.currentTime = 0; 
            refs.alarmSound.loop = false; // Stop the loop
        }
        
        if (beepInterval) {
            clearInterval(beepInterval);
            beepInterval = null;
        }

        if(stopBtn) stopBtn.classList.add('hidden'); 
        return;
    } 
    
    // PLAY
    if(refs.alarmSound) refs.alarmSound.volume = 1.0; 
    
    try {
        const savedFile = await getAudioFile();
        if (savedFile && savedFile.content) {
            const url = URL.createObjectURL(savedFile.content);
            refs.alarmSound.src = url;
            
            // FIX: Infinite Loop for custom files
            refs.alarmSound.loop = true; 
            
            await refs.alarmSound.play();
            if(stopBtn) stopBtn.classList.remove('hidden'); 
            return;
        }
        throw new Error("No custom file");
    } catch (e) {
        // FIX: Infinite Loop for fallback beep
        playFallbackBeep(); // Play once immediately
        if (beepInterval) clearInterval(beepInterval);
        beepInterval = setInterval(playFallbackBeep, 1000); // Repeat every second
        
        if(stopBtn) stopBtn.classList.remove('hidden'); 
    }
}

function playFallbackBeep() {
    try {
        if (!beepCtx) {
            beepCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (beepCtx.state === 'suspended') beepCtx.resume();

        const ctx = beepCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880; 
        gain.gain.value = 0.5;
        osc.start();
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
        console.error("Audio Context Error:", e);
    }
}

export function testAlarm() { playAlarm(); }

export function selectAlarmFile() { 
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/mpeg, audio/mp4, audio/x-m4a, audio/wav, audio/aac, .mp3, .m4a, .wav, .aac';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            await saveAudioFile(file);
            refs.selectedAlarmFile.textContent = file.name;
        } catch (err) {
            console.error("Failed to save audio:", err);
            alert("Could not save audio file. Using default.");
        }
    };
    
    input.click();
}

export function showChartModal(type) { refs.chartModal.style.display = 'flex'; let option; const resizeChart = (chart) => requestAnimationFrame(() => chart.resize()); if (type === 'time') { if (state.pieChartMode === 'trend') { refs.zoomedChartTitle.textContent = `Study Time Trend (Last ${state.trendChartSpan} Days)`; option = getTrendChartOptions(); if(option.series && option.series[0] && option.series[0].type === 'bar') { option.legend.orient = 'horizontal'; option.legend.right = 'auto'; option.legend.left = 'center'; option.title = null; } } else { refs.zoomedChartTitle.textContent = `Study Time by Course (${state.pieChartMode === 'total' ? 'Total' : 'Today'})`; option = getTimeChartOptions(); if (option.series && option.series[0]) { option.series[0].center = ['50%', '50%']; option.series[0].radius = ['50%', '80%']; } option.legend = { bottom: 20, left: 'center', orient: 'horizontal' }; let totalSec = 0; state.allSessions.forEach(s => { if(state.pieChartMode === 'today') { const todayStr = getLocalISODateString(new Date()); if(getLocalISODateString(new Date(s.timestamp)) === todayStr) totalSec += s.seconds; } else { totalSec += s.seconds; } }); const hrs = (totalSec / 3600).toFixed(1); option.title = { text: hrs + '\nHOURS', left: 'center', top: 'center', textStyle: { fontSize: 40, color: '#4a413a', fontWeight: 'bold' } }; } if (!state.zoomedTimeChart) state.zoomedTimeChart = window.echarts.init(refs.zoomedChartContainer, null, { devicePixelRatio: 2 }); state.zoomedTimeChart.clear(); state.zoomedTimeChart.setOption(option, { notMerge: true }); resizeChart(state.zoomedTimeChart); } else if (type === 'score') { refs.zoomedChartTitle.textContent = 'Performance Trend'; option = getScoreChartOptions(); if (!state.zoomedScoreChart) state.zoomedScoreChart = window.echarts.init(refs.zoomedChartContainer, null, { devicePixelRatio: 2 }); state.zoomedScoreChart.clear(); state.zoomedScoreChart.setOption(option, { notMerge: true }); resizeChart(state.zoomedScoreChart); } }
export function hideChartModal() { refs.chartModal.style.display = 'none'; }
export function showHelpModal() { refs.helpModal.style.display = 'flex'; }
export function hideHelpModal() { refs.helpModal.style.display = 'none'; }
export function showSyncOnboarding() { if(refs.syncOnboardingModal) { refs.syncOnboardingModal.style.display = 'flex'; } }
export function hideSyncOnboarding() { if(refs.syncOnboardingModal) { refs.syncOnboardingModal.style.display = 'none'; } }