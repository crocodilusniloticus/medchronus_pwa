import { getLocalISODateString, getPersianDateString, injectJalaaliDate } from './utils-v2.2.25.js';

let state, refs, showEventModal, logSession;

export function init(appState, uiRefs, eventModalFn, logSessionFn) { 
    state = appState; refs = uiRefs; showEventModal = eventModalFn; logSession = logSessionFn; 
}

export function initializeCalendar() { 
    // Ensure flatpickr is loaded
    if (!window.flatpickr) return;

    state.calendar = window.flatpickr(refs.studyCalendar, { 
        inline: true, 
        locale: 'fa', 
        altInput: true, 
        altFormat: "Y/m/d",
        dateFormat: "Y-m-d",
        onChange: (selectedDates) => { 
            if (!state.isSavingEvent && selectedDates.length) {
                updateLogDisplay(getLocalISODateString(selectedDates[0])); 
            }
        }, 
        onDayCreate: (dObj, dStr, fp, dayElem) => { 
            injectJalaaliDate(dayElem);
            const date = getLocalISODateString(dayElem.dateObj); 
            const eventsOnThisDay = state.allEvents.filter(e => e.date === date && !e.isDone); 
            if (eventsOnThisDay.length > 0) { 
                let dayClass = 'priority-low';
                const priorities = eventsOnThisDay.map(e => e.priority);
                if (priorities.includes('high')) dayClass = 'priority-high';
                else if (priorities.includes('medium')) dayClass = 'priority-medium';
                dayElem.classList.add(dayClass);
                const eventsList = eventsOnThisDay.map(e => `• ${e.title}`).join('\n');
                dayElem.setAttribute('data-tooltip', eventsList);
            } 
            
            // --- DESKTOP: Right Click ---
            dayElem.addEventListener('contextmenu', (e) => { 
                e.preventDefault(); 
                showEventModal(dayElem.dateObj); 
            }); 

            // --- MOBILE: Long Press (Simulate Right Click) ---
            let pressTimer;
            dayElem.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    e.preventDefault(); // Prevent default touch behavior
                    if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
                    showEventModal(dayElem.dateObj);
                }, 600); // 600ms threshold for long press
            }, { passive: false });

            const clearTimer = () => clearTimeout(pressTimer);
            dayElem.addEventListener('touchend', clearTimer);
            dayElem.addEventListener('touchmove', clearTimer);
            dayElem.addEventListener('touchcancel', clearTimer);
        } 
    }); 
}

export function initializeGlobalTooltips() { 
    // Fix: Access global tippy object instead of importing
    if (window.tippy && window.tippy.delegate) {
        window.tippy.delegate('body', { 
            target: '[data-tooltip]', 
            content: (reference) => reference.dataset.tooltip, 
            allowHTML: false, 
            // FIX: Added 'click' to trigger ensures tapping on mobile shows the tooltip
            trigger: 'mouseenter focus click', 
            placement: 'top', 
            animation: 'fade', 
            delay: 15, 
            duration: 0 
        }); 
    }
}

export function updateStreakDisplay() { 
    refs.streakCount.textContent = state.streakCount; 
    refs.streakContainer.classList.toggle('active-streak', state.streakCount > 0);
    refs.streakContainer.classList.toggle('target-hit', state.streakCount >= state.streakTarget);
}

export function toggleFocusModeVisuals() { 
    if (state.isFocusMode) { 
        document.body.classList.add('focus-mode'); 
        refs.btnFocusMode.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Exit Zen Mode`; 
        refs.btnFocusMode.dataset.tooltip = "Exit Zen Mode"; 
    } else { 
        document.body.classList.remove('focus-mode'); 
        refs.btnFocusMode.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>`; 
        refs.btnFocusMode.dataset.tooltip = "Enter Focus Mode"; 
    } 
}

const icons = { 
    edit: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>`, 
    delete: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>`, 
    check: `✔`,
    recover: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`
};

export function updateLogDisplay(filterDateOverride) { 
    refs.sessionLog.innerHTML = ''; 
    if (filterDateOverride !== undefined) state.logFilterDate = filterDateOverride;
    const activeFilter = state.logFilterDate;
    let combinedLog = [...state.allSessions, ...state.allScores]; 
    if (activeFilter) { 
        refs.showAllButton.hidden = false; 
        combinedLog = combinedLog.filter(item => getLocalISODateString(new Date(item.timestamp)) === activeFilter); 
    } else { 
        refs.showAllButton.hidden = true; 
    } 
    
    if (state.logViewMode === 'chrono') { 
        refs.btnLogChrono.classList.add('active'); refs.btnLogTopic.classList.remove('active'); 
        combinedLog.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).forEach(item => { 
            const el=document.createElement('div'); 
            const d=new Date(item.timestamp); 
            const pDate = getPersianDateString(d);
            const tTime = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const fd = `${pDate}, ${tTime}`;
            const buttons = `<div class="log-meta"><span class="log-date">${fd}</span><div class="log-actions"><button class="action-icon-btn edit edit-btn" data-timestamp="${item.timestamp}" data-tooltip="Edit">${icons.edit}</button><button class="action-icon-btn delete delete-btn" data-timestamp="${item.timestamp}" data-tooltip="Delete">${icons.delete}</button></div></div>`; 
            if(item.type==='session'){ el.className='log-item'; el.innerHTML=`<span class="log-course">${item.course}</span>${buttons}<div class="log-duration">${item.duration}</div><div class="log-notes">${item.notes}</div>`; } else { el.className='score-item'; el.innerHTML=`<span class="log-course">${item.course}</span>${buttons}<div class="score-value">${item.score}%</div><div class="log-notes">${item.notes}</div>`; } refs.sessionLog.appendChild(el); 
        }); 
    } else { 
        refs.btnLogChrono.classList.remove('active'); refs.btnLogTopic.classList.add('active'); 
        const grouped = {}; 
        combinedLog.filter(item => item.notes && item.notes.trim() !== '').forEach(item => { if (!grouped[item.course]) grouped[item.course] = []; grouped[item.course].push(item); }); 
        Object.keys(grouped).sort().forEach(course => { 
            const courseHeader = document.createElement('h3'); courseHeader.className = 'log-course-header'; courseHeader.textContent = course; refs.sessionLog.appendChild(courseHeader); 
            grouped[course].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach((item, index) => { 
                const el=document.createElement('div'); const cleanNote = item.notes.replace(/\(stopped early\)/g, '').trim(); 
                if (item.type === 'session') { el.className = 'log-item-minimal'; el.innerHTML = `<span class="log-date-minimal">${index + 1}.</span> ${cleanNote}`; } 
                else { el.className = 'log-item-minimal'; el.innerHTML = `<span class="log-date-minimal">${index + 1}.</span> <strong>${item.score}%</strong> ${cleanNote}`; } 
                refs.sessionLog.appendChild(el); 
            }); 
        }); 
    } 
}

export function updateTaskDashboard() {
    refs.taskList.innerHTML = ''; 
    const now = new Date(); now.setHours(0,0,0,0);
    let filteredEvents;
    if (state.showCompletedTasks) { refs.btnToggleTasks.textContent = "Show Pending"; filteredEvents = state.allEvents.filter(e => e.isDone); } 
    else { refs.btnToggleTasks.textContent = "Show Completed"; filteredEvents = state.allEvents.filter(e => !e.isDone); }
    filteredEvents.sort((a,b) => { const dateA = new Date(a.date); const dateB = new Date(b.date); return state.showCompletedTasks ? dateB - dateA : dateA - dateB; });
    if (filteredEvents.length === 0) { refs.taskList.innerHTML = `<div style="text-align:center; color:#999; margin-top:20px; font-size:0.85rem;">No tasks.</div>`; return; }
    filteredEvents.forEach(event => {
        const eventDate = new Date(event.date);
        eventDate.setMinutes(eventDate.getMinutes() + eventDate.getTimezoneOffset());
        const daysLeft = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let countdownText = ''; let itemClass = 'task-item';
        if (state.showCompletedTasks) { itemClass += ' completed'; countdownText = "Done"; } 
        else { if(daysLeft < 0) { itemClass += ' overdue'; countdownText = `${-daysLeft}d passed`; } else if (daysLeft === 0) { itemClass += ' warning-urgent'; countdownText = 'Today'; } else if (daysLeft <= 3) { itemClass += ' warning-urgent'; countdownText = `${daysLeft}d left`; } else { countdownText = `${daysLeft}d left`; } }
        const formattedDate = getPersianDateString(eventDate);
        let barFill = state.showCompletedTasks ? 100 : (daysLeft <= 0 ? 100 : Math.max(0, 100 - ((daysLeft / (state.deadlineUrgencyDays || 60)) * 100)));
        const item = document.createElement('div'); item.className = itemClass;
        let controlsHtml = '';
        const commonBtns = `<button class="action-icon-btn edit task-edit-btn" data-timestamp="${event.timestamp}" data-tooltip="Edit">${icons.edit}</button><button class="action-icon-btn delete task-delete-btn" data-timestamp="${event.timestamp}" data-tooltip="Delete">${icons.delete}</button>`;
        if (state.showCompletedTasks) { controlsHtml = `<button class="action-icon-btn task-recover-btn" data-timestamp="${event.timestamp}" data-tooltip="Un-complete" style="color:var(--primary); margin-right:4px;">${icons.recover}</button>${commonBtns}`; } 
        else { controlsHtml = `<span class="task-date" style="margin-right:8px; font-weight:600; color:${daysLeft < 3 ? 'var(--danger)' : 'var(--text-muted)'}">${countdownText}</span><button class="task-done-btn" data-timestamp="${event.timestamp}" data-tooltip="Mark Done" style="margin-right:4px;">✔</button>${commonBtns}`; }
        item.innerHTML = `<div class="task-header"><div><span class="task-title">${event.title}</span><span class="task-date" style="display:block; margin-top:2px;">${formattedDate}</span></div><div class="task-controls" style="display:flex; align-items:center;">${controlsHtml}</div></div><div class="task-bar-bg"><div class="task-bar-fg" style="width: ${barFill}%;"></div></div>`;
        refs.taskList.appendChild(item);
    });
}

export function updateCalendar() { if (state.calendar && typeof state.calendar.redraw === 'function') state.calendar.redraw(); }
export function resetCalendarToToday() { const today = new Date(); if (state.calendar) { state.calendar.setDate(today, true); state.calendar.jumpToDate(today); } updateLogDisplay(getLocalISODateString(today)); }
export function initializeEventModalPicker() { 
    state.eventModalPicker = window.flatpickr(refs.eventDatePicker, { dateFormat: "Y-m-d", altInput: true, altFormat: "Y/m/d", locale: 'fa', onDayCreate: (dObj, dStr, fp, dayElem) => { injectJalaaliDate(dayElem); } }); 
}
export function populateCourses() { refs.courseSelect.innerHTML = ''; refs.scoreCourseSelect.innerHTML = ''; refs.editCourseSelect.innerHTML = ''; refs.pomodoroCourseSelect.innerHTML = ''; refs.countdownCourseSelect.innerHTML = ''; state.allCourses.forEach(c => { [refs.courseSelect, refs.scoreCourseSelect, refs.editCourseSelect, refs.pomodoroCourseSelect, refs.countdownCourseSelect].forEach(sel => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); }); }); if (state.lastSelectedCourse && state.allCourses.includes(state.lastSelectedCourse)) { [refs.courseSelect, refs.scoreCourseSelect, refs.editCourseSelect, refs.pomodoroCourseSelect, refs.countdownCourseSelect].forEach(sel => sel.value = state.lastSelectedCourse); } }
export function updateCourseEditorList() { refs.courseListEditor.innerHTML = ''; state.allCourses.forEach(course => { const item = document.createElement('div'); item.className = 'course-list-item'; item.innerHTML = `<span>${course}</span><button class="action-icon-btn delete course-delete-btn" data-course="${course}">${icons.delete}</button>`; refs.courseListEditor.appendChild(item); }); }
export function setLogViewMode(mode) { state.logViewMode = mode; updateLogDisplay(); }