const { exec } = require('child_process'); 
// Added injectJalaaliDate to imports
const { getLocalISODateString, injectJalaaliDate } = require('./utils');


let state, refs, dataManager, updateAllDisplays;
// Added getTrendChartOptions to this list
let getTimeChartOptions, getScoreChartOptions, getCharts, getTrendChartOptions; 
let editDatePickerInstance = null; 

// --- UPDATED INIT: Accepts trendChartFn ---
function init(appState, uiRefs, dataMgr, updateFn, timeChartFn, scoreChartFn, getChartsFn, trendChartFn) {
    state = appState;
    refs = uiRefs;
    dataManager = dataMgr;
    updateAllDisplays = updateFn;
    
    getTimeChartOptions = timeChartFn;
    getScoreChartOptions = scoreChartFn;
    getCharts = getChartsFn;
    getTrendChartOptions = trendChartFn; // Store the function
}

function showEventModal(date, timestamp = null) { 
    refs.eventError.textContent = ''; 
    
    if (timestamp) {
        const event = state.allEvents.find(e => e.timestamp === timestamp);
        if (!event) return;
        refs.modalTitle.textContent = 'Edit Deadline';
        refs.eventText.value = event.title;
        refs.eventTimestamp.value = event.timestamp;
        
        // Load priority
        if(refs.eventPriority) {
            refs.eventPriority.value = event.priority || 'low';
        }
        
        state.eventModalPicker.setDate(event.date);
    } else {
        refs.modalTitle.textContent = `Add Deadline`; 
        refs.eventText.value = ''; 
        refs.eventTimestamp.value = '';
        
        // Reset priority
        if(refs.eventPriority) {
            refs.eventPriority.value = 'low';
        }
        
        state.eventModalPicker.setDate(date || new Date());
    }
    
    // This implies refs.eventModal must exist
    if(refs.eventModal) {
        refs.eventModal.style.display = 'flex'; 
    }
    refs.eventText.focus(); 
}

function hideEventModal() { refs.eventModal.style.display = 'none'; }

function saveEvent() {
    const title = refs.eventText.value.trim();
    const date = refs.eventDatePicker.value; 
    const ts = refs.eventTimestamp.value;
    const priority = refs.eventPriority.value; // Get Priority

    if (!title) { refs.eventError.textContent = 'Event title cannot be empty.'; return; }
    if (!date) { refs.eventError.textContent = 'Please select a due date.'; return; }

    if (ts) {
        const eventIndex = state.allEvents.findIndex(e => e.timestamp === ts);
        if (eventIndex > -1) {
            state.allEvents[eventIndex].title = title;
            state.allEvents[eventIndex].date = date;
            state.allEvents[eventIndex].priority = priority; // Update Priority
        }
    } else {
        state.allEvents.push({ 
            type: 'event', 
            title: title, 
            date: date, 
            priority: priority, // Save Priority
            timestamp: new Date().toISOString(), 
            isDone: false 
        });
    }
    
    dataManager.saveData();
    state.isSavingEvent = true;
    hideEventModal();
    if (state.calendar) state.calendar.setDate([], false);
    updateAllDisplays();
}

function showConfirmModal(identifier, isTask = false, itemType = 'log') { refs.itemToProcess.value = identifier; refs.itemToProcess.dataset.itemType = itemType; refs.confirmDeleteButton.style.backgroundColor = 'var(--red)'; refs.confirmDeleteButton.textContent = 'Delete'; if (itemType === 'course') { refs.modalConfirmTitle.textContent = 'Delete Course?'; refs.modalConfirmText.textContent = `Are you sure you want to delete the course "${identifier}"? This will not affect existing log entries.`; } else if (itemType === 'task_permanent') { refs.modalConfirmTitle.textContent = 'Delete Task Permanently?'; refs.modalConfirmText.textContent = 'This will remove the task from history. Use "Done" if you just finished it.'; } else { refs.modalConfirmTitle.textContent = 'Are you sure?'; refs.modalConfirmText.textContent = 'Are you sure you want to delete this item? This action cannot be undone.'; } refs.confirmModal.style.display = 'flex'; }
function hideConfirmModal() { refs.itemToProcess.value = ''; refs.confirmModal.style.display = 'none'; }
function showEditModal(timestamp) { 
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
            locale: 'fa', // Ensure Persian Month names
            // Fix: Inject Jalaali numbers
            onDayCreate: (dObj, dStr, fp, dayElem) => {
                injectJalaaliDate(dayElem);
            }
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
function hideEditModal() { refs.editModal.style.display = 'none'; }
function saveEdit() { const ts = refs.editTimestamp.value; const newCourse = refs.editCourseSelect.value; const newNotes = refs.editNotes.value.trim(); const newDateStr = refs.editDatePicker.value; let sessionItem = state.allSessions.find(s => s.timestamp === ts); let scoreItem = state.allScores.find(s => s.timestamp === ts); let activeItem = sessionItem || scoreItem; if (activeItem) { if (newDateStr) { const originalDateObj = new Date(ts); const newDateObj = new Date(newDateStr); newDateObj.setHours(originalDateObj.getHours(), originalDateObj.getMinutes(), originalDateObj.getSeconds()); activeItem.timestamp = newDateObj.toISOString(); } activeItem.course = newCourse; activeItem.notes = newNotes; if (sessionItem) { const newDuration = refs.editDuration.value; if (!/^\d{2}:\d{2}:\d{2}$/.test(newDuration)) { refs.editError.textContent = "Duration must be in HH:MM:SS format."; return; } const parts = newDuration.split(':').map(Number); activeItem.seconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2]; activeItem.duration = newDuration; } else if (scoreItem) { const newScore = parseInt(refs.editScore.value, 10); if(isNaN(newScore) || newScore < 0 || newScore > 100){ refs.editError.textContent = 'Score must be a number from 0-100.'; return; } activeItem.score = newScore; } dataManager.saveData(); updateAllDisplays(); hideEditModal(); } }

function showPomodoroPrompt(phaseName, nextDuration) { 
    refs.pomodoroPromptTitle.textContent = "Phase Complete!"; 
    if (phaseName === 'studying') { 
        refs.pomodoroPromptText.textContent = "Break is over. Ready to focus?"; 
        refs.pomodoroPromptConfirmBtn.textContent = `Start Focus (${state.pomodoroFocusDuration}m)`; 
    } else { 
        refs.pomodoroPromptText.textContent = "Great job! Time for a break?"; 
        const breakType = phaseName === 'shortBreak' ? 'Short' : 'Long';
        const breakMins = phaseName === 'shortBreak' ? (state.pomodoroShortBreakDuration || 10) : (state.pomodoroLongBreakDuration || 20);
        refs.pomodoroPromptConfirmBtn.textContent = `Start ${breakType} Break (${breakMins}m)`; 
    } 
    refs.pomodoroPromptModal.style.display = 'flex'; 
}

function hidePomodoroPrompt() { refs.pomodoroPromptModal.style.display = 'none'; }
function showCoursesModal() { refs.coursesModal.style.display = 'flex'; refs.newCourseName.focus(); }
function hideCoursesModal() { refs.coursesModal.style.display = 'none'; }
function addCourse() { const name = refs.newCourseName.value.trim(); if (name && !state.allCourses.includes(name)) { state.allCourses.push(name); state.allCourses.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())); dataManager.saveData(); updateAllDisplays(); refs.newCourseName.value = ''; } }
function deleteCourse(courseName) { state.allCourses = state.allCourses.filter(c => c !== courseName); dataManager.saveData(); updateAllDisplays(); }

function showSettingsModal() { 
    if(refs.settingsModal) refs.settingsModal.style.display = 'flex'; 
    
    if(refs.deadlineUrgencyInput) refs.deadlineUrgencyInput.value = state.deadlineUrgencyDays;

    // RESTORE THIS
    if(refs.settingHeatmapTarget) refs.settingHeatmapTarget.value = state.heatmapTargetHours;

    if(refs.settingFocusDuration) refs.settingFocusDuration.value = state.pomodoroFocusDuration || 50;
    if(refs.settingShortBreakDuration) refs.settingShortBreakDuration.value = state.pomodoroShortBreakDuration || 10;
    if(refs.settingLongBreakDuration) refs.settingLongBreakDuration.value = state.pomodoroLongBreakDuration || 20;
}

function hideSettingsModal() { refs.settingsModal.style.display = 'none'; }

function saveSettings() {
    const newSoundPath = refs.alarmSoundInput.value;
    if(newSoundPath) { 
        refs.alarmSound.src = 'file://' + newSoundPath; 
        localStorage.setItem('alarmSound', newSoundPath); 
        refs.selectedAlarmFile.textContent = newSoundPath.split('\\').pop().split('/').pop(); 
    }
    
    const urgency = parseInt(refs.deadlineUrgencyInput.value); 
    if(urgency && urgency > 0) state.deadlineUrgencyDays = urgency;

    // RESTORE THIS
    if(refs.settingHeatmapTarget) {
        const val = parseFloat(refs.settingHeatmapTarget.value);
        if(val > 0) state.heatmapTargetHours = val;
    }

    if(refs.settingFocusDuration) {
        const val = parseInt(refs.settingFocusDuration.value);
        if(val > 0) state.pomodoroFocusDuration = val;
    }
    if(refs.settingShortBreakDuration) {
        const val = parseInt(refs.settingShortBreakDuration.value);
        if(val > 0) state.pomodoroShortBreakDuration = val;
    }
    if(refs.settingLongBreakDuration) {
        const val = parseInt(refs.settingLongBreakDuration.value);
        if(val > 0) state.pomodoroLongBreakDuration = val;
    }

    dataManager.saveData(); 
    updateAllDisplays(); 
    hideSettingsModal();
}

function maximizeSystemVolume() { try { if (process.platform === 'darwin') { exec('osascript -e "set volume output volume 100"'); } else if (process.platform === 'win32') { const cmd = `powershell -WindowStyle Hidden -Command "$w=New-Object -ComObject WScript.Shell;for($i=0;$i-lt 50;$i++){$w.SendKeys([char]175)}"`; exec(cmd); } else if (process.platform === 'linux') { exec('amixer sset Master 100% || amixer -D pulse sset Master 100%'); } } catch (e) { console.error("Could not set system volume:", e); } }

function playAlarm(stop = false) { 
    if (stop) { 
        refs.alarmSound.pause(); 
        refs.alarmSound.currentTime = 0; 
        return;
    } 

    maximizeSystemVolume(); 

    // Check if we have a valid file source
    const currentSrc = refs.alarmSound.getAttribute('src');
    if (currentSrc && currentSrc !== '' && currentSrc !== 'file://') {
        refs.alarmSound.volume = 1.0; 
        refs.alarmSound.currentTime = 0; 
        refs.alarmSound.play().catch(e => { 
            console.warn("Could not play alarm file. Using fallback.", e); 
            playFallbackBeep();
        }); 
    } else {
        // Fallback if no file is selected
        playFallbackBeep();
    }
}

// Fallback Beep using Web Audio API (No files required)
function playFallbackBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 880; // A5
        gain.gain.value = 0.5;
        
        osc.start();
        
        // Beep pattern: Beep... Beep... Beep
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.6);

        // Repeat twice more
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 880;
            osc2.start();
            gain2.gain.setValueAtTime(0.5, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc2.stop(ctx.currentTime + 0.6);
        }, 800);

        setTimeout(() => {
            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.connect(gain3);
            gain3.connect(ctx.destination);
            osc3.frequency.value = 880;
            osc3.start();
            gain3.gain.setValueAtTime(0.5, ctx.currentTime);
            gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc3.stop(ctx.currentTime + 0.6);
        }, 1600);

    } catch (e) {
        console.error("Audio Context Error:", e);
    }
}

function testAlarm() { const soundPath = localStorage.getItem('alarmSound') || ''; if (soundPath) { refs.alarmSound.src = 'file://' + soundPath; playAlarm(); } else { playAlarm(); /* Will trigger fallback */ } }
async function selectAlarmFile() { const filePath = await window.ipcRenderer.invoke('dialog:openFile'); if (filePath) { refs.alarmSoundInput.value = filePath; refs.selectedAlarmFile.textContent = filePath.split('\\').pop().split('/').pop(); } }

function showChartModal(type) { 
    refs.chartModal.style.display = 'flex'; 
    let option; 
    
    // Helper to resize chart after modal opens
    const resizeChart = (chart) => requestAnimationFrame(() => chart.resize());

    if (type === 'time') { 
        if (state.pieChartMode === 'trend') { 
            // *** TREND MODE ***
            refs.zoomedChartTitle.textContent = `Study Time Trend (Last ${state.trendChartSpan} Days)`; 
            
            // Now calling the correct function
            option = getTrendChartOptions(); 
            
            // Clean layout for Trend in Modal
            if(option.series && option.series[0] && option.series[0].type === 'bar') {
                option.legend.orient = 'horizontal';
                option.legend.right = 'auto';
                option.legend.left = 'center';
                option.title = null; // No title needed for bar chart
            }

        } else { 
            // *** PIE MODE (Total or Today) ***
            refs.zoomedChartTitle.textContent = `Study Time by Course (${state.pieChartMode === 'total' ? 'Total' : 'Today'})`; 
            option = getTimeChartOptions(); 
            
            // Fix Layout for Zoomed Pie
            if (option.series && option.series[0]) {
                option.series[0].center = ['50%', '50%']; // Center in modal
                option.series[0].radius = ['50%', '80%']; // Bigger pie
            }
            
            // Move Legend to Bottom
            option.legend = {
                bottom: 20,
                left: 'center',
                orient: 'horizontal'
            };
            
            // Add Center Text (Because HTML overlay is missing in modal)
            let totalSec = 0;
            state.allSessions.forEach(s => {
               if(state.pieChartMode === 'today') {
                   const todayStr = getLocalISODateString(new Date());
                   if(getLocalISODateString(new Date(s.timestamp)) === todayStr) totalSec += s.seconds;
               } else {
                   totalSec += s.seconds;
               }
            });
            const hrs = (totalSec / 3600).toFixed(1);
            
            option.title = {
                text: hrs + '\nHOURS',
                left: 'center',
                top: 'center',
                textStyle: { fontSize: 40, color: '#4a413a', fontWeight: 'bold' }
            };
        } 
        
        // Init Time Chart if needed
        if (!state.zoomedTimeChart) { 
            state.zoomedTimeChart = window.echarts.init(refs.zoomedChartContainer, null, { devicePixelRatio: 2 }); 
        } 
        
        // Critical: Clear previous options to prevent mixing Pie/Bar properties
        state.zoomedTimeChart.clear();
        state.zoomedTimeChart.setOption(option, { notMerge: true }); 
        resizeChart(state.zoomedTimeChart);
    
    } else if (type === 'score') { 
        // *** PERFORMANCE CHART ***
        refs.zoomedChartTitle.textContent = 'Performance Trend'; 
        option = getScoreChartOptions(); 
        
        if (!state.zoomedScoreChart) { 
            state.zoomedScoreChart = window.echarts.init(refs.zoomedChartContainer, null, { devicePixelRatio: 2 }); 
        } 
        
        state.zoomedScoreChart.clear();
        state.zoomedScoreChart.setOption(option, { notMerge: true }); 
        resizeChart(state.zoomedScoreChart);
    } 
}

function hideChartModal() { refs.chartModal.style.display = 'none'; }

function showHelpModal() {
    refs.helpModal.style.display = 'flex';
}

function hideHelpModal() {
    refs.helpModal.style.display = 'none';
}

function showSyncOnboarding() {
    if(refs.syncOnboardingModal) {
        refs.syncOnboardingModal.style.display = 'flex';
    }
}

function hideSyncOnboarding() {
    if(refs.syncOnboardingModal) {
        refs.syncOnboardingModal.style.display = 'none';
    }
}
module.exports = {
    init, showEventModal, hideEventModal, saveEvent, showConfirmModal, hideConfirmModal,
    showEditModal, hideEditModal, saveEdit, showCoursesModal, hideCoursesModal, addCourse, deleteCourse,
    showSettingsModal, hideSettingsModal, saveSettings, testAlarm, selectAlarmFile,
    showChartModal, hideChartModal, playAlarm,
    showPomodoroPrompt, hidePomodoroPrompt, showHelpModal, hideHelpModal, showSyncOnboarding, 
    hideSyncOnboarding
};