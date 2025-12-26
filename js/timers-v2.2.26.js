import * as modals from './modals-v2.2.26.js'; 

let state, refs, logSession, playAlarm, updateAllDisplays, saveData, saveTimerProgress;

export function init(appState, uiRefs, logSessionFn, playAlarmFn, updateAllDisplaysFn, saveDataFn, saveTimerProgressFn) {
    state = appState;
    refs = uiRefs;
    logSession = logSessionFn;
    playAlarm = playAlarmFn;
    updateAllDisplays = updateAllDisplaysFn;
    saveData = saveDataFn;
    saveTimerProgress = saveTimerProgressFn;
    document.addEventListener('stop-alarm', () => {
        if (state.countdownSecondsLeft <= 0 && state.countdownStartTime !== null) {
            resetCountdownTimer();
        }
    });
    
}

// ... [restoreTimerState function remains unchanged from previous step] ...
export function restoreTimerState() {
    if (state.pomodoroState !== 'idle') {
        refs.pomodoroStartControls.classList.add('hidden');
        refs.pomodoroRunningControls.classList.remove('hidden');
        
        refs.pomodoroPauseResumeBtn.disabled = false;
        refs.pomodoroStopBtn.disabled = false;
        if(refs.pomodoroResetBtn) refs.pomodoroResetBtn.disabled = false;
        if(refs.pomodoroSkipBtn) refs.pomodoroSkipBtn.disabled = false;
        
        refs.pomodoroPauseResumeBtn.textContent = state.isPomodoroPaused ? "Resume" : "Pause";
        
        if(state.pomodoroState === 'studying') {
             refs.pomodoroStatus.textContent = "PHASE: FOCUS";
             refs.pomodoroStatus.classList.remove('break-mode');
        } else {
             refs.pomodoroStatus.textContent = "PHASE: BREAK";
             refs.pomodoroStatus.classList.add('break-mode');
        }

        if (!state.isPomodoroPaused && state.pomodoroStartTime) {
            clearInterval(state.pomodoroTimer);
            startPomodoroCountdown(state.pomodoroOriginalDuration, state.pomodoroState); 
        } else {
            refs.pomodoroTimerDisplay.textContent = formatCountdown(state.pomodoroSecondsLeft);
        }
    }

    if (state.isStopwatchRunning || state.isStopwatchPaused) {
        refs.stopButton.classList.remove('hidden');
        refs.resetButton.classList.remove('hidden');
        refs.stopButton.disabled = false;
        refs.resetButton.disabled = false;
        refs.courseSelect.disabled = true;
        refs.startButton.textContent = state.isStopwatchPaused ? "Resume" : "Pause";

        if (state.isStopwatchRunning && state.stopwatchStartTime) {
            clearInterval(state.stopwatchTimer);
            const now = Date.now();
            state.stopwatchSeconds = Math.floor((now - state.stopwatchStartTime) / 1000);
            refs.timerDisplay.textContent = formatTime(state.stopwatchSeconds);
            
            state.stopwatchTimer = setInterval(() => { 
                state.stopwatchSeconds = Math.floor((Date.now() - state.stopwatchStartTime) / 1000);
                refs.timerDisplay.textContent = formatTime(state.stopwatchSeconds); 
                saveTimerProgress(); 
            }, 1000);
        } else {
            refs.timerDisplay.textContent = formatTime(state.stopwatchSeconds);
        }
    }

    if (state.isCountdownRunning || state.isCountdownPaused) {
        refs.countdownStopBtn.classList.remove('hidden');
        refs.countdownResetBtn.classList.remove('hidden');
        refs.countdownStopBtn.disabled = false;
        refs.countdownResetBtn.disabled = false;
        refs.countdownStartPauseBtn.textContent = state.isCountdownPaused ? "Resume" : "Pause";

        if (state.isCountdownRunning) {
             clearInterval(state.countdownTimer);
             
             const startTime = state.countdownStartTime;
             const originalDur = state.countdownOriginalDuration;

             const elapsed = Math.floor((Date.now() - startTime) / 1000);
             state.countdownSecondsLeft = originalDur - elapsed;
             if(state.countdownSecondsLeft < 0) state.countdownSecondsLeft = 0;
             refs.countdownTimerDisplay.textContent = formatTime(state.countdownSecondsLeft);

             state.countdownTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                state.countdownSecondsLeft = originalDur - elapsed;
                
                if (state.countdownSecondsLeft < 0) state.countdownSecondsLeft = 0;
                refs.countdownTimerDisplay.textContent = formatTime(state.countdownSecondsLeft);
                saveTimerProgress();

                if (state.countdownSecondsLeft <= 0) {
                    clearInterval(state.countdownTimer); 
                    playAlarm();
                    logSession(refs.countdownCourseSelect.value, state.countdownOriginalDuration, refs.countdownNotes.value.trim(), new Date(state.countdownStartTime).toISOString());
                    updateAllDisplays(); 
                    refs.countdownNotes.value = '';
                }
            }, 1000);

        } else {
            refs.countdownTimerDisplay.textContent = formatTime(state.countdownSecondsLeft);
        }
    }

    updateTimerTabIndicators();
}

function updateTimerTabIndicators() {
    refs.btnTimerStopwatch.classList.toggle('running', state.isStopwatchRunning || state.isStopwatchPaused);
    refs.btnTimerPomodoro.classList.toggle('running', state.pomodoroState !== 'idle');
    refs.btnTimerCountdown.classList.toggle('running', state.isCountdownRunning || state.isCountdownPaused);
}

export function updatePomodoroDisplay() {
    if (state.pomodoroState === 'idle') {
        state.pomodoroSecondsLeft = state.pomodoroFocusDuration * 60;
        refs.pomodoroTimerDisplay.textContent = formatCountdown(state.pomodoroSecondsLeft);
    }
}

function stopAndLogRunningTimers(excludeTimerType) {
    if (excludeTimerType !== 'stopwatch' && (state.isStopwatchRunning || state.isStopwatchPaused)) stopTimer();
    if (excludeTimerType !== 'pomodoro' && state.pomodoroState !== 'idle') stopPomodoro();
    if (excludeTimerType !== 'countdown' && (state.isCountdownRunning || state.isCountdownPaused)) stopCountdownTimer();
}

// ... [stopwatch functions startTimer, pauseTimer, stopTimer, resetStopwatch remain unchanged] ...
export function startTimer() { 
    stopAndLogRunningTimers('stopwatch');
    modals.primeAudioEngine(); // Unlock Audio for Stopwatch

    if (state.isStopwatchRunning) {
        pauseTimer();
        return;
    } 
    
    state.isStopwatchRunning = true; 
    state.isStopwatchPaused = false;
    refs.startButton.textContent = "Pause";
    
    refs.stopButton.classList.remove('hidden');
    refs.resetButton.classList.remove('hidden');
    refs.stopButton.disabled = false; 
    refs.resetButton.disabled = false; 
    refs.courseSelect.disabled = true; 

    if (state.stopwatchStartTime === null) { 
        state.stopwatchStartTime = Date.now(); 
        state.stopwatchSeconds = 0; 
    } 
    else if (state.isStopwatchPaused === false && state.stopwatchSeconds > 0) {
         state.stopwatchStartTime = Date.now() - (state.stopwatchSeconds * 1000); 
    }
    
    clearInterval(state.stopwatchTimer);
    state.stopwatchTimer = setInterval(() => { 
        state.stopwatchSeconds = Math.floor((Date.now() - state.stopwatchStartTime) / 1000);
        refs.timerDisplay.textContent = formatTime(state.stopwatchSeconds); 
        saveTimerProgress(); 
    }, 1000);

    updateTimerTabIndicators(); 
    saveTimerProgress(); 
}

export function pauseTimer() {
    clearInterval(state.stopwatchTimer);
    state.isStopwatchRunning = false; 
    state.isStopwatchPaused = true;
    refs.startButton.textContent = "Resume"; 
    updateTimerTabIndicators(); 
    saveTimerProgress(); 
}
    
export function stopTimer() { 
    clearInterval(state.stopwatchTimer); 
    if (state.stopwatchStartTime && state.stopwatchSeconds >= 1) {
        refs.timerError.textContent = ""; 
        logSession(refs.courseSelect.value, state.stopwatchSeconds, refs.sessionNotes.value, new Date(state.stopwatchStartTime).toISOString()); 
        updateAllDisplays();
    }
    resetStopwatch();
    saveData(); 
}

export function resetStopwatch() {
    clearInterval(state.stopwatchTimer);
    state.isStopwatchRunning = false; 
    state.isStopwatchPaused = false;
    state.stopwatchSeconds = 0; 
    state.stopwatchStartTime = null;
    
    refs.timerDisplay.textContent = formatTime(0);
    refs.startButton.textContent = "Start";
    
    refs.stopButton.classList.add('hidden');
    refs.resetButton.classList.add('hidden');
    refs.stopButton.disabled = true; 
    refs.resetButton.disabled = true; 
    
    refs.courseSelect.disabled = false;
    
    updateTimerTabIndicators();
    localStorage.removeItem('activeTimer');
}

// --- POMODORO (UPDATED) ---
export function beginNewPomodoroPhase(durationInSeconds, stateName) {
    stopAndLogRunningTimers('pomodoro');
    
    // FIX: Start "Heartbeat" for iOS background persistence
    modals.primeAudioEngine(); 

    state.pomodoroOriginalDuration = durationInSeconds;
    if (stateName === 'studying') {
        state.pomodoroStartTime = Date.now();
        refs.pomodoroStatus.textContent = "PHASE: FOCUS";
        refs.pomodoroStatus.classList.remove('break-mode');
    } else {
        state.pomodoroStartTime = Date.now(); 
        refs.pomodoroStatus.textContent = "PHASE: BREAK";
        refs.pomodoroStatus.classList.add('break-mode');
    }
    
    refs.pomodoroStartControls.classList.add('hidden');
    refs.pomodoroRunningControls.classList.remove('hidden');
    
    refs.pomodoroPauseResumeBtn.disabled = false;
    refs.pomodoroStopBtn.disabled = false;
    refs.pomodoroResetBtn.disabled = false;
    refs.pomodoroSkipBtn.disabled = false;
    
    state.isPomodoroPaused = false;
    startPomodoroCountdown(durationInSeconds, stateName);
}

function handlePomodoroCompletion(isSkipped = false) {
    clearInterval(state.pomodoroTimer);
    
    // FIX: Play alarm loop (unless skipped by button)
    // The alarm will continue ringing until user clicks a button in the Prompt Modal
    if(!isSkipped) playAlarm(); 

    if (state.pomodoroState === 'studying') {
        const elapsed = isSkipped ? (state.pomodoroOriginalDuration - state.pomodoroSecondsLeft) : state.pomodoroOriginalDuration;
        if (elapsed > 0) {
            logSession(refs.pomodoroCourseSelect.value, elapsed, refs.pomodoroNotes.value.trim(), new Date(state.pomodoroStartTime).toISOString());
            updateAllDisplays();
        }
        refs.pomodoroNotes.value = '';
        state.pomodoroCycle += 1;
        let nextBreakDuration, nextBreakName;
        if (state.pomodoroCycle >= 4) { nextBreakDuration = state.pomodoroLongBreakDuration * 60; nextBreakName = 'longBreak'; } 
        else { nextBreakDuration = state.pomodoroShortBreakDuration * 60; nextBreakName = 'shortBreak'; }
        
        // Auto-transition logic is removed in favor of Prompt
        // But here we immediately start next phase? 
        // Wait, MedChronos usually prompts between phases. 
        // To keep it simple: Show prompt for break.
        
        state.nextPomodoroPhase = { duration: nextBreakDuration, name: nextBreakName };
        modals.showPomodoroPrompt(nextBreakName, nextBreakDuration);
        
    } else {
        // Break finished
        // FIX: Removed the 15-second auto-stop timeout.
        // It will ring until user acts.
        state.nextPomodoroPhase = { duration: state.pomodoroFocusDuration * 60, name: 'studying' };
        modals.showPomodoroPrompt('studying', state.pomodoroFocusDuration * 60);
    }
    
    state.pomodoroState = 'idle';
    refs.pomodoroStatus.textContent = "COMPLETED";
    updateTimerTabIndicators();
    localStorage.removeItem('activeTimer');
}

export function skipPomodoroPhase() { handlePomodoroCompletion(true); }

export function startPomodoroCountdown(durationInSeconds, stateName) {
    clearInterval(state.pomodoroTimer); 
    state.pomodoroState = stateName;
    
    if (state.isPomodoroPaused === false) {
        refs.pomodoroPauseResumeBtn.textContent = "Pause";
    }

    const startTime = state.pomodoroStartTime; 

    state.pomodoroTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        state.pomodoroSecondsLeft = durationInSeconds - elapsed;
        
        if (state.pomodoroSecondsLeft < 0) state.pomodoroSecondsLeft = 0;
        refs.pomodoroTimerDisplay.textContent = formatCountdown(state.pomodoroSecondsLeft);
        saveTimerProgress();
        
        if (state.pomodoroSecondsLeft <= 0) handlePomodoroCompletion(false);
    }, 1000);
    
    updateTimerTabIndicators(); 
    saveTimerProgress(); 
}

export function togglePomodoroPause() {
    if (state.isPomodoroPaused) {
        state.isPomodoroPaused = false; 
        refs.pomodoroPauseResumeBtn.textContent = "Pause";
        const elapsedBeforePause = state.pomodoroOriginalDuration - state.pomodoroPausedTime;
        state.pomodoroStartTime = Date.now() - (elapsedBeforePause * 1000);
        startPomodoroCountdown(state.pomodoroOriginalDuration, state.pomodoroState);
    } else {
        state.isPomodoroPaused = true; 
        clearInterval(state.pomodoroTimer);
        state.pomodoroPausedTime = state.pomodoroSecondsLeft; 
        refs.pomodoroPauseResumeBtn.textContent = "Resume";
    }
    saveTimerProgress();
}

export function stopPomodoro() {
    clearInterval(state.pomodoroTimer);
    playAlarm(true);
    if (state.pomodoroState === 'studying') {
        const elapsedSeconds = state.pomodoroOriginalDuration - state.pomodoroSecondsLeft;
        if (elapsedSeconds >= 1) { 
            logSession(refs.pomodoroCourseSelect.value, elapsedSeconds, refs.pomodoroNotes.value.trim(), new Date(state.pomodoroStartTime).toISOString());
            updateAllDisplays();
            refs.pomodoroNotes.value = '';
        }
    }
    resetPomodoro();
    saveData(); 
}

export function resetPomodoro() {
    clearInterval(state.pomodoroTimer);
    state.pomodoroState = 'idle';
    state.isPomodoroPaused = false;
    state.pomodoroSecondsLeft = state.pomodoroFocusDuration * 60;
    state.pomodoroStartTime = null;
    
    refs.pomodoroTimerDisplay.textContent = formatCountdown(state.pomodoroFocusDuration * 60);
    refs.pomodoroStatus.textContent = "";
    
    refs.pomodoroStartControls.classList.remove('hidden');
    refs.pomodoroRunningControls.classList.add('hidden');
    
    updateTimerTabIndicators();
    localStorage.removeItem('activeTimer');
}

// --- COUNTDOWN (UPDATED) ---
export function startCountdownTimer(durationInSeconds) {
    stopAndLogRunningTimers('countdown');
    
    // FIX: Start Heartbeat immediately
    modals.primeAudioEngine(); 
    
    if (durationInSeconds === undefined) {
        if (state.isCountdownPaused) {
            durationInSeconds = state.countdownSecondsLeft;
        } else {
            const h = parseInt(refs.countdownHours.value) || 0; 
            const m = parseInt(refs.countdownMinutes.value) || 0; 
            const s = parseInt(refs.countdownSeconds.value) || 0;
            durationInSeconds = (h * 3600) + (m * 60) + s;
        }
    }

    if (state.isCountdownRunning) {
        pauseCountdownTimer();
        return;
    } 
    
    if (state.isCountdownPaused) {
        // RESUME
        state.isCountdownRunning = true; 
        state.isCountdownPaused = false;
        refs.countdownStartPauseBtn.textContent = "Pause";
        const elapsedBeforePause = state.countdownOriginalDuration - state.countdownPausedTime;
        state.countdownStartTime = Date.now() - (elapsedBeforePause * 1000);
    } else {
        // FRESH START
        if (durationInSeconds <= 0) return; 

        const h = parseInt(refs.countdownHours.value) || 0; 
        const m = parseInt(refs.countdownMinutes.value) || 0; 
        const s = parseInt(refs.countdownSeconds.value) || 0;
        localStorage.setItem('countdownValues', JSON.stringify({ h, m, s }));
        
        state.countdownStartTime = Date.now(); 
        state.countdownOriginalDuration = durationInSeconds;
        state.countdownSecondsLeft = durationInSeconds;
        
        state.isCountdownRunning = true; 
        state.isCountdownPaused = false;
        
        refs.countdownStartPauseBtn.textContent = "Pause"; 
        refs.countdownStopBtn.classList.remove('hidden');
        refs.countdownResetBtn.classList.remove('hidden');
        refs.countdownStopBtn.disabled = false;
        refs.countdownResetBtn.disabled = false;
    }

    clearInterval(state.countdownTimer); 
    
    const startTime = state.countdownStartTime;
    const originalDur = state.countdownOriginalDuration;

    state.countdownTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        state.countdownSecondsLeft = originalDur - elapsed;
        
        if (state.countdownSecondsLeft < 0) state.countdownSecondsLeft = 0;
        refs.countdownTimerDisplay.textContent = formatTime(state.countdownSecondsLeft);
        saveTimerProgress();

        if (state.countdownSecondsLeft <= 0) {
            clearInterval(state.countdownTimer); 
            
            // FIX: Loop alarm until stop
            playAlarm();
            
            logSession(refs.countdownCourseSelect.value, state.countdownOriginalDuration, refs.countdownNotes.value.trim(), new Date(state.countdownStartTime).toISOString());
            updateAllDisplays(); 
            refs.countdownNotes.value = '';

            // Timer stays at 00:00:00. Stop button remains visible.
        }
    }, 1000);
    
    updateTimerTabIndicators(); 
    saveTimerProgress();
}

export function pauseCountdownTimer() {
    clearInterval(state.countdownTimer); 
    state.isCountdownRunning = false; 
    state.isCountdownPaused = true; 
    state.countdownPausedTime = state.countdownSecondsLeft;
    refs.countdownStartPauseBtn.textContent = "Resume"; 
    updateTimerTabIndicators(); 
    saveTimerProgress(); 
}

export function stopCountdownTimer() {
    clearInterval(state.countdownTimer); 
    playAlarm(true); // Stop alarm
    const elapsedSeconds = state.countdownOriginalDuration - state.countdownSecondsLeft;
    if (elapsedSeconds >= 2 && state.countdownSecondsLeft > 0) {
        logSession(refs.countdownCourseSelect.value, elapsedSeconds, refs.countdownNotes.value.trim(), new Date(state.countdownStartTime).toISOString());
        updateAllDisplays(); 
        refs.countdownNotes.value = '';
    }
    resetCountdownTimer(); 
    saveData(); 
}

export function resetCountdownTimer() {
    clearInterval(state.countdownTimer); 
    playAlarm(true); 
    state.isCountdownRunning = false; 
    state.isCountdownPaused = false; 
    state.countdownSecondsLeft = 0; 
    state.countdownStartTime = null;
    
    refs.countdownTimerDisplay.textContent = "00:00:00";
    const savedCountdown = JSON.parse(localStorage.getItem('countdownValues'));
    if (savedCountdown) { refs.countdownHours.value = savedCountdown.h; refs.countdownMinutes.value = savedCountdown.m; refs.countdownSeconds.value = savedCountdown.s; }
    refs.countdownStartPauseBtn.textContent = "Start";
    
    refs.countdownStopBtn.classList.add('hidden');
    refs.countdownResetBtn.classList.add('hidden');
    refs.countdownStopBtn.disabled = true; 
    refs.countdownResetBtn.disabled = true;
    
    updateTimerTabIndicators();
    localStorage.removeItem('activeTimer');
}

export function setTimerMode(mode) {
    refs.stopwatchPanel.classList.add('hidden'); 
    refs.pomodoroPanel.classList.add('hidden'); 
    refs.countdownPanel.classList.add('hidden');
    refs.btnTimerStopwatch.classList.remove('active'); 
    refs.btnTimerPomodoro.classList.remove('active'); 
    refs.btnTimerCountdown.classList.remove('active');
    
    if (mode === 'pomodoro') { refs.pomodoroPanel.classList.remove('hidden'); refs.btnTimerPomodoro.classList.add('active'); } 
    else if (mode === 'countdown') { refs.countdownPanel.classList.remove('hidden'); refs.btnTimerCountdown.classList.add('active'); } 
    else { refs.stopwatchPanel.classList.remove('hidden'); refs.btnTimerStopwatch.classList.add('active'); }
}

function formatTime(sec) { 
    const h=Math.floor(sec/3600).toString().padStart(2,'0'); const m=Math.floor((sec%3600)/60).toString().padStart(2,'0'); const s=(sec%60).toString().padStart(2,'0'); 
    return `${h}:${m}:${s}`; 
}

function formatCountdown(sec) {
    const m=Math.floor(sec / 60).toString().padStart(2, '0'); const s=(sec % 60).toString().padStart(2, '0'); 
    return `${m}:${s}`;
}