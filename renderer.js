const flatpickr = require('flatpickr');

// By attaching initializeApp to the global 'window' object, we make it visible to index.html.
window.initializeApp = function() {
    // --- State Variables and Element References ---
    let allCourses = []; 
    let allSessions = [], allScores = [], allEvents = [];
    
    let calendar, timeChart, scoreChart, timer;
    let seconds = 0, isTimerRunning = false;
    let isSavingEvent = false; 
    
    let zoomedTimeChart = null;
    let zoomedScoreChart = null;
    let eventModalPicker = null; 

    let pieChartMode = 'total'; 

    // Element References
    const courseSelect = document.getElementById('courseSelect'), timerDisplay = document.getElementById('timerDisplay'), startButton = document.getElementById('startButton'), stopButton = document.getElementById('stopButton'), sessionNotes = document.getElementById('sessionNotes'), sessionLog = document.getElementById('sessionLog'), showAllButton = document.getElementById('showAllButton'), scoreCourseSelect = document.getElementById('scoreCourseSelect'), scoreInput = document.getElementById('scoreInput'), scoreNotes = document.getElementById('scoreNotes'), logScoreButton = document.getElementById('logScoreButton'), taskList = document.getElementById('task-list');
    
    // Event Modal
    const eventModal = document.getElementById('event-modal'), modalTitle = document.getElementById('modal-title'), eventText = document.getElementById('event-text'), saveEventButton = document.getElementById('save-event-button'), cancelEventButton = document.getElementById('cancel-event-button');
    const eventTimestamp = document.getElementById('event-timestamp');
    const eventError = document.getElementById('eventError');
    const eventDatePicker = document.getElementById('event-date-picker');
    
    // Error messages
    const timerError = document.getElementById('timerError');
    const scoreError = document.getElementById('scoreError');
    
    // Confirm modal references
    const confirmModal = document.getElementById('confirm-modal');
    const itemToProcess = document.getElementById('item-to-process'); 
    const confirmDeleteButton = document.getElementById('confirm-delete-button');
    const cancelDeleteButton = document.getElementById('cancel-delete-button');

    // Edit Log Modal references
    const editModal = document.getElementById('edit-log-modal');
    const editTimestamp = document.getElementById('edit-timestamp');
    const editCourseSelect = document.getElementById('edit-course-select');
    const editSessionGroup = document.getElementById('edit-session-group');
    const editDuration = document.getElementById('edit-duration');
    const editScoreGroup = document.getElementById('edit-score-group');
    const editScore = document.getElementById('edit-score');
    const editNotes = document.getElementById('edit-notes');
    const editError = document.getElementById('editError');
    const saveEditButton = document.getElementById('save-edit-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');

    // Chart Modal references
    const chartModal = document.getElementById('chart-modal');
    const zoomedChartTitle = document.getElementById('zoomed-chart-title');
    const zoomedChartContainer = document.getElementById('zoomed-chart-container');
    const closeChartModalButton = document.getElementById('close-chart-modal-button');

    // Chart Toggle Buttons
    const btnPieTotal = document.getElementById('btn-pie-total');
    const btnPieToday = document.getElementById('btn-pie-today');

    // Course Management Modal
    const manageCoursesBtn = document.getElementById('manage-courses-btn');
    const coursesModal = document.getElementById('courses-modal');
    const newCourseName = document.getElementById('new-course-name');
    const addCourseBtn = document.getElementById('add-course-btn');
    const courseListEditor = document.getElementById('course-list-editor');
    const closeCoursesModalBtn = document.getElementById('close-courses-modal-btn');


    // Tooltip instance array
    let tippyInstances = [];

    // --- Core Data Functions ---
    const saveData = () => { 
        localStorage.setItem('studySessions', JSON.stringify(allSessions)); 
        localStorage.setItem('studyScores', JSON.stringify(allScores)); 
        localStorage.setItem('studyEvents', JSON.stringify(allEvents));
        localStorage.setItem('studyCourses', JSON.stringify(allCourses));
    };
    
    const loadData = () => { 
        allSessions = (JSON.parse(localStorage.getItem('studySessions')) || [])
            .filter(s => s && s.timestamp && s.course); 
        allScores = (JSON.parse(localStorage.getItem('studyScores')) || [])
            .filter(s => s && s.timestamp && s.course); 
        allEvents = (JSON.parse(localStorage.getItem('studyEvents')) || [])
            .map(e => ({...e, isDone: typeof e.isDone === 'boolean' ? e.isDone : false}))
            .filter(e => e && e.date && e.title && e.timestamp);
        
        const savedCourses = JSON.parse(localStorage.getItem('studyCourses'));
        if (savedCourses && savedCourses.length > 0) {
            allCourses = savedCourses;
        } else {
            allCourses = ["Cardio", "Pulmono", "Nephro", "Gastro", "Endocrino", "Hemato", "Neuro", "Infect", "Rheumatology", "Surgery", "Peds", "Psychiatry", "Dermatology", "Gyneco", "Radio", "Ortho", "Uro", "Ophtalmo", "Biostat", "Pharma", "ENT", "Akhlagh", "Patho", "Genetics", "Physics", "Immuno", "Nutrition"];
        }
    };
    
    const updateAllDisplays = () => { 
        populateCourses(); 
        updateLogDisplay(); 
        updateCalendar(); 
        updateTimeChart(); 
        updateScoreChart(); 
        updateTaskDashboard(); 
        updateCourseEditorList();
    };
    
    function deleteItem(timestamp) { 
        allSessions = allSessions.filter(i => i.timestamp !== timestamp); 
        allScores = allScores.filter(i => i.timestamp !== timestamp); 
        allEvents = allEvents.filter(i => i.timestamp !== timestamp); 
        saveData(); 
        updateAllDisplays(); 
    }

    // --- Event Modal (Add/Edit) ---
    function showEventModal(date, timestamp = null) { 
        eventError.textContent = ''; 
        
        if (timestamp) {
            const event = allEvents.find(e => e.timestamp === timestamp);
            if (!event) return;
            modalTitle.textContent = 'Edit Event';
            eventText.value = event.title;
            eventTimestamp.value = event.timestamp;
            eventModalPicker.setDate(event.date);
        } else {
            const dateObj = new Date(date);
            modalTitle.textContent = `Add Event for ${dateObj.toLocaleDateString()}`; 
            eventText.value = ''; 
            eventTimestamp.value = '';
            eventModalPicker.setDate(date);
        }
        
        eventModal.style.display = 'flex'; 
        eventText.focus(); 
    }
    
    function hideEventModal() { 
        eventModal.style.display = 'none'; 
    }
    
    function saveEvent() {
        const title = eventText.value.trim();
        const date = eventDatePicker.value; 
        const ts = eventTimestamp.value;

        if (!title) { 
            eventError.textContent = 'Event title cannot be empty.';
            return; 
        }
        if (!date) {
            eventError.textContent = 'Please select a date.';
            return;
        }

        if (ts) {
            const eventIndex = allEvents.findIndex(e => e.timestamp === ts);
            if (eventIndex > -1) {
                allEvents[eventIndex].title = title;
                allEvents[eventIndex].date = date;
            }
        } else {
            allEvents.push({ type: 'event', title: title, date: date, timestamp: new Date().toISOString(), isDone: false });
        }
        
        saveData();
        isSavingEvent = true;
        hideEventModal();
        updateAllDisplays();
    }

    // --- Confirm Delete Modal ---
    function showConfirmModal(timestamp, isTask = false) {
        itemToProcess.value = timestamp;
        const confirmTitle = document.getElementById('modal-confirm-title');
        const confirmText = document.getElementById('modal-confirm-text');
        const confirmBtn = document.getElementById('confirm-delete-button');

        if (isTask) {
            confirmTitle.textContent = 'Mark as Done?';
            confirmText.textContent = 'This will permanently mark the task as done and remove it from the list.';
            confirmBtn.textContent = 'Mark Done';
            confirmBtn.style.backgroundColor = 'var(--green)';
        } else {
            confirmTitle.textContent = 'Are you sure?';
            confirmText.textContent = 'Are you sure you want to delete this item? This action cannot be undone.';
            confirmBtn.textContent = 'Delete';
            confirmBtn.style.backgroundColor = 'var(--red)';
        }
        confirmModal.style.display = 'flex';
    }

    function hideConfirmModal() {
        itemToProcess.value = '';
        confirmModal.style.display = 'none';
    }

    // --- Edit Log Modal Functions ---
    function showEditModal(timestamp) {
        let item = allSessions.find(s => s.timestamp === timestamp);
        let itemType = 'session';
        
        if (!item) {
            item = allScores.find(s => s.timestamp === timestamp);
            itemType = 'score';
        }
        if (!item) return; 

        editTimestamp.value = timestamp;
        editCourseSelect.value = item.course;
        editNotes.value = item.notes || '';
        editError.textContent = '';

        if (itemType === 'session') {
            editSessionGroup.style.display = 'block';
            editDuration.value = item.duration;
            editScoreGroup.style.display = 'none';
        } else {
            editSessionGroup.style.display = 'none';
            editScoreGroup.style.display = 'block';
            editScore.value = item.score;
        }
        editModal.style.display = 'flex';
    }

    function hideEditModal() {
        editModal.style.display = 'none';
    }

    function saveEdit() {
        const ts = editTimestamp.value;
        const newCourse = editCourseSelect.value;
        const newNotes = editNotes.value.trim();

        let sessionItem = allSessions.find(s => s.timestamp === ts);
        let scoreItem = allScores.find(s => s.timestamp === ts);

        if (sessionItem) {
            const newDuration = editDuration.value;
            if (!/^\d{2}:\d{2}:\d{2}$/.test(newDuration)) {
                editError.textContent = "Duration must be in HH:MM:SS format.";
                return;
            }
            const parts = newDuration.split(':').map(Number);
            const newSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];

            sessionItem.course = newCourse;
            sessionItem.notes = newNotes;
            sessionItem.duration = newDuration;
            sessionItem.seconds = newSeconds;

        } else if (scoreItem) {
            const newScore = parseInt(editScore.value, 10);
            if(isNaN(newScore) || newScore < 0 || newScore > 100){
                editError.textContent = 'Score must be a number from 0-100.';
                return;
            }
            
            scoreItem.course = newCourse;
            scoreItem.notes = newNotes;
            scoreItem.score = newScore;
        }

        saveData();
        updateAllDisplays();
        hideEditModal();
    }
    // --- End of Edit Log Functions ---
    
    // --- Course Management Functions ---
    function showCoursesModal() {
        coursesModal.style.display = 'flex';
    }
    function hideCoursesModal() {
        coursesModal.style.display = 'none';
    }
    
    function addCourse() {
        const name = newCourseName.value.trim();
        if (name && !allCourses.includes(name)) {
            allCourses.push(name);
            allCourses.sort();
            saveData();
            updateAllDisplays();
            newCourseName.value = '';
        }
    }

    function deleteCourse(courseName) {
        if (confirm(`Are you sure you want to delete "${courseName}"? This will not remove old log entries.`)) {
            allCourses = allCourses.filter(c => c !== courseName);
            saveData();
            updateAllDisplays();
        }
    }

    function updateCourseEditorList() {
        courseListEditor.innerHTML = '';
        allCourses.forEach(course => {
            const item = document.createElement('div');
            item.className = 'course-list-item';
            item.innerHTML = `<span>${course}</span>
                              <button class="delete-btn course-delete-btn" data-course="${course}">X</button>`;
            courseListEditor.appendChild(item);
        });
    }

    // --- Log Functions ---
    function logSession() { 
        allSessions.push({ type:'session',course:courseSelect.value,duration:formatTime(seconds),seconds:seconds,notes:sessionNotes.value.trim(),timestamp:new Date().toISOString()}); 
        saveData(); 
        updateAllDisplays(); 
        sessionNotes.value = ''; 
    }

    function logScore() { 
        const s = parseInt(scoreInput.value, 10); 
        if(isNaN(s) || s < 0 || s > 100){
            scoreError.textContent = 'Score must be a number from 0-100.';
            return;
        }
        scoreError.textContent = ''; 
        allScores.push({type:'score',course:scoreCourseSelect.value,score:s,notes:scoreNotes.value.trim(),timestamp:new Date().toISOString()}); 
        saveData(); 
        updateAllDisplays();
        scoreInput.value='';
        scoreNotes.value=''; 
    }
    
    // --- UI Update Functions ---
    function updateLogDisplay(filterDate = null) {
        sessionLog.innerHTML = ''; let combinedLog = [...allSessions, ...allScores];
        if (filterDate) { combinedLog = combinedLog.filter(item => item.timestamp.slice(0, 10) === filterDate); }
        combinedLog.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).forEach(item => {
            const el=document.createElement('div'); const d=new Date(item.timestamp); 
            const fd=d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
            
            const buttons = `
                <div class="log-header-buttons">
                    <button class="edit-btn" data-timestamp="${item.timestamp}">Edit</button>
                    <button class="delete-btn" data-timestamp="${item.timestamp}">X</button>
                </div>`;

            if(item.type==='session'){ el.className='log-item'; el.innerHTML=`<div class="log-header"><span class="log-course">${item.course}</span><div><span class="log-date">${fd}</span>${buttons}</div></div><div class="log-duration"><strong>Duration:</strong> ${item.duration}</div><div class="log-notes">${item.notes||'No notes added.'}</div>`; }
            else { el.className='score-item'; el.innerHTML=`<div class="log-header"><span class="log-course">${item.course}</span><div><span class="log-date">${fd}</span>${buttons}</div></div><div class="score-value">Score: ${item.score}%</div><div class="log-notes">${item.notes||'No notes added.'}</div>`; }
            sessionLog.appendChild(el);
        });
    }

    function updateTaskDashboard() {
        taskList.innerHTML = ''; 
        const now = new Date(); 
        now.setHours(0,0,0,0);
        
        const notDoneEvents = allEvents.filter(e => e && e.date && !e.isDone).sort((a,b) => {
            const partsA = a.date.split('-').map(Number);
            const dateA = new Date(partsA[0], partsA[1] - 1, partsA[2]);
            const partsB = b.date.split('-').map(Number);
            const dateB = new Date(partsB[0], partsB[1] - 1, partsB[2]);
            return dateA - dateB;
        });
        
        notDoneEvents.forEach(event => {
            const parts = event.date.split('-').map(Number);
            const eventDate = new Date(parts[0], parts[1] - 1, parts[2]);
            
            const daysLeft = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            let countdownText = ''; 
            let itemClass = 'task-item';
            let noticeText = ''; 
            
            if(daysLeft < 0) { 
                const overdueDays = -daysLeft;
                countdownText = `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue`; 
                itemClass += ' overdue'; 
                noticeText = 'OVERDUE!';
            } else if (daysLeft === 0) {
                countdownText = "";
                itemClass += ' warning-urgent';
                noticeText = 'DUE TODAY!';
            } else if (daysLeft === 1) {
                countdownText = "";
                itemClass += ' warning-urgent';
                noticeText = 'Due tomorrow!';
            } else if (daysLeft <= 3) {
                countdownText = "";
                itemClass += ' warning-urgent';
                noticeText = `Due in ${daysLeft} days!`;
            } else if (daysLeft <= 7) {
                countdownText = "";
                itemClass += ' warning-near';
                noticeText = 'Due this week';
            } else {
                countdownText = `${daysLeft} days left`;
                noticeText = '';
            }
            
            const formattedDate = eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const maxDaysForBar = 98;
            let barFillPercentage;
            
            if (daysLeft <= 0) {
                barFillPercentage = 0;
            } else if (daysLeft >= maxDaysForBar) {
                barFillPercentage = 100;
            } else {
                barFillPercentage = (daysLeft / maxDaysForBar) * 100;
            }

            const item = document.createElement('div'); item.className = itemClass;
            item.innerHTML = `<div class="task-header">
                                <div class="task-info">
                                    <span class="task-title">${event.title}</span>
                                    <span class="task-date">${formattedDate}</span>
                                </div>
                                <div class="task-controls">
                                    <div class="task-due-text">
                                        <span class="task-notice">${noticeText}</span>
                                        <span class="task-countdown">${countdownText}</span>
                                    </div>
                                    <button class="edit-btn task-edit-btn" data-timestamp="${event.timestamp}">Edit</button>
                                    <button class="delete-btn task-delete-btn" data-timestamp="${event.timestamp}">✔</button>
                                </div>
                              </div>
                              <div class="task-bar-bg"><div class="task-bar-fg" style="width: ${barFillPercentage}%;"></div></div>`;
            taskList.appendChild(item);
        });
    }

    // --- Calendar & Chart Initialization and Updates ---
    
    function initializeTooltips() {
        if (tippyInstances) {
            tippyInstances.forEach(instance => instance.destroy());
            tippyInstances = [];
        }

        tippyInstances = tippy('.event-day-tooltip', {
            content(reference) {
                return reference.dataset.tooltip;
            },
            allowHTML: false,
            whiteSpace: 'pre-line',
            animation: 'fade',
            delay: [100, 0]
        });
    }

    function initializeCalendar() {
        calendar = flatpickr("#study-calendar", {
            inline: true,
            
            locale: {
                firstDayOfWeek: 6 // 6 = Saturday
            },
            
            onChange: (selectedDates, dateStr) => { 
                if (isSavingEvent) {
                    isSavingEvent = false; 
                    return; 
                }
                if (!selectedDates.length) return; 
                
                const dateObj = selectedDates[0];
                const isoDate = dateObj.toISOString().slice(0, 10);

                if (eventModal.style.display === 'flex') {
                    eventDatePicker.value = isoDate;
                } else {
                    showAllButton.hidden = true; 
                    showEventModal(dateObj);
                }
                
                setTimeout(initializeTooltips, 50);
            },
            onDayCreate: (dObj, dStr, fp, dayElem) => {
                const dateObj = new Date(dayElem.dateObj);
                dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
                const date = dateObj.toISOString().slice(0, 10);

                if (new Set(allSessions.map(s => s.timestamp.slice(0, 10))).has(date)) {
                    dayElem.classList.add("study-day");
                }
                
                const eventsOnThisDay = allEvents.filter(e => e.date === date && !e.isDone);
                if (eventsOnThisDay.length > 0) {
                    dayElem.classList.add("event-day");
                    const eventTitles = eventsOnThisDay.map(e => e.title);
                    dayElem.dataset.tooltip = eventTitles.join('\n');
                    dayElem.classList.add('event-day-tooltip');
                }
            },
            onMonthChange: () => {
                setTimeout(initializeTooltips, 50); 
            },
            onYearChange: () => {
                setTimeout(initializeTooltips, 50);
            }
        });
    }
    
    function updateCalendar() { 
        if (calendar) calendar.redraw(); 
        setTimeout(initializeTooltips, 50); 
    }

    function initializeCharts() {
        // *** FIX: Changed devicePixelRatio from 5 to 2 to fix zoom ***
        const chartOptions = {
            devicePixelRatio: 4
        };

        timeChart = echarts.init(document.getElementById('time-chart'), null, chartOptions);
        scoreChart = echarts.init(document.getElementById('score-chart'), null, chartOptions);

        const chartResizeObserver = new ResizeObserver(() => {
            if (timeChart) timeChart.resize();
            if (scoreChart) scoreChart.resize();
        });

        chartResizeObserver.observe(document.getElementById('time-chart'));
        chartResizeObserver.observe(document.getElementById('score-chart'));
        
        timeChart.on('click', () => showChartModal('time'));
        scoreChart.on('click', () => showChartModal('score'));
    }
    
    function getTimeChartOptions() {
        let sessionsToDisplay = allSessions;
        let title = 'Study Time by Course (Total)';
        
        if (pieChartMode === 'today') {
            const todayStr = new Date().toISOString().slice(0, 10);
            sessionsToDisplay = allSessions.filter(s => s.timestamp.slice(0, 10) === todayStr);
            title = 'Study Time by Course (Today)';
        }

        let totalSeconds = 0;
        const courseData = {};
        sessionsToDisplay.forEach(s => { 
            courseData[s.course] = (courseData[s.course] || 0) + (s.seconds || 0);
            totalSeconds += (s.seconds || 0);
        });
        
        const totalHours = (totalSeconds / 3600).toFixed(1);
        
        const chartData = Object.keys(courseData).map(course => ({
            name: course,
            value: (courseData[course] / 3600) 
        }));
        
        return {
            title: { text: title, left: 'center', textStyle: { fontSize: 14 } },
            tooltip: { 
                trigger: 'item', 
                formatter: (params) => {
                    const hours = parseFloat(params.value).toFixed(2);
                    return `${params.name}: ${hours} hrs (${params.percent}%)`;
                }
            },
            legend: { 
                type: 'scroll',
                orient: 'horizontal', 
                left: 'center', 
                bottom: '0',
                itemWidth: 15,
                itemHeight: 10,
                textStyle: {
                    fontSize: 10
                }
            },
            graphic: {
                type: 'text',
                left: 'center',
                top: 'center',
                style: {
                    text: `${totalHours}\nhrs`,
                    textAlign: 'center',
                    fill: '#333',
                    fontSize: 24,
                    fontWeight: 'bold'
                }
            },
            series: [{ 
                type: 'pie', 
                radius: ['40%', '70%'],
                center: ['50%', '50%'], 
                data: chartData,
                label: { show: false, position: 'center' },
                labelLine: { show: false },
                emphasis: {
                    label: {
                        show: true,
                        position: 'center',
                        fontSize: 16,
                        fontWeight: 'bold',
                        formatter: (params) => {
                            const hours = parseFloat(params.value).toFixed(2);
                            return `${params.name}\n${hours} hrs`;
                        }
                    }
                }
            }]
        };
    }
    
    function getScoreChartOptions() {
        const scoresByCourse = {};
        allScores.forEach(s => { if (!scoresByCourse[s.course]) scoresByCourse[s.course] = []; scoresByCourse[s.course].push([new Date(s.timestamp), s.score]); });
        const series = Object.keys(scoresByCourse).map(course => ({
            name: course,
            type: 'line',
            data: scoresByCourse[course].sort((a, b) => a[0] - b[0]),
            smooth: true
        }));
        
        return {
            title: { text: 'Performance Trend', left: 'center', textStyle: { fontSize: 14 } },
            tooltip: { trigger: 'axis' },
            legend: { 
                type: 'scroll',
                orient: 'horizontal', 
                left: 'center', 
                bottom: '0',
                itemWidth: 15,
                itemHeight: 10,
                textStyle: {
                    fontSize: 10
                }
            },
            grid: {
                left: '10%',
                right: '10%',
                top: '15%',
                bottom: '28%'
            },
            xAxis: { type: 'time' },
            yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
            dataZoom: [{
                type: 'slider',
                start: 0,
                end: 100,
                height: 20,
                bottom: '12%'
            }],
            series: series
        };
    }

    function updateTimeChart() {
        const option = getTimeChartOptions();
        // This chart is now centered, so no overrides needed
        option.title.textStyle.fontSize = 14;
        option.graphic.style.fontSize = '24px';
        timeChart.setOption(option, { notMerge: true });
    }
    
    function updateScoreChart() {
        const option = getScoreChartOptions();
        scoreChart.setOption(option, { notMerge: true });
    }

    function showChartModal(type) {
        chartModal.style.display = 'flex';
        let option;
        
        if (type === 'time') {
            zoomedChartTitle.textContent = `Study Time by Course (${pieChartMode === 'total' ? 'Total' : 'Today'})`;
            option = getTimeChartOptions();
            option.legend.textStyle.fontSize = 12; 
            option.graphic.style.fontSize = '40px'; 
            
            if (!zoomedTimeChart) {
                // *** FIX: Changed devicePixelRatio from 5 to 2 ***
                zoomedTimeChart = echarts.init(zoomedChartContainer, null, { devicePixelRatio: 2 });
            }
            zoomedTimeChart.setOption(option, { notMerge: true });
            setTimeout(() => zoomedTimeChart.resize(), 50);

        } else if (type === 'score') {
            zoomedChartTitle.textContent = 'Performance Trend';
            option = getScoreChartOptions();
            option.legend.textStyle.fontSize = 12;

            if (!zoomedScoreChart) {
                // *** FIX: Changed devicePixelRatio from 5 to 2 ***
                zoomedScoreChart = echarts.init(zoomedChartContainer, null, { devicePixelRatio: 2 });
            }
            zoomedScoreChart.setOption(option, { notMerge: true });
            setTimeout(() => zoomedScoreChart.resize(), 50);
        }
    }

    function hideChartModal() {
        chartModal.style.display = 'none';
    }

    function setPieMode(mode) {
        pieChartMode = mode;
        btnPieTotal.classList.toggle('active', mode === 'total');
        btnPieToday.classList.toggle('active', mode === 'today');
        updateTimeChart(); 

        if (chartModal.style.display === 'flex' && zoomedTimeChart) {
            showChartModal('time');
        }
    }

    // --- Utility Functions ---
    function populateCourses() { 
        courseSelect.innerHTML = '';
        scoreCourseSelect.innerHTML = '';
        editCourseSelect.innerHTML = '';

        allCourses.sort().forEach(c => { 
            const o1=document.createElement('option');o1.value=c;o1.textContent=c;courseSelect.appendChild(o1);
            const o2=document.createElement('option');o2.value=c;o2.textContent=c;scoreCourseSelect.appendChild(o2);
            const o3=document.createElement('option');o3.value=c;o3.textContent=c;editCourseSelect.appendChild(o3);
        }); 
    }
    
    function formatTime(sec) { const h=Math.floor(sec/3600).toString().padStart(2,'0'); const m=Math.floor((sec%3600)/60).toString().padStart(2,'0'); const s=(sec%60).toString().padStart(2,'0'); return `${h}:${m}:${s}`; }
    
    function startTimer() { 
        if (isTimerRunning) return; 
        isTimerRunning=true; 
        startButton.disabled=true; 
        stopButton.disabled=false; 
        courseSelect.disabled=true; 
        startTime = Date.now();
        timer=setInterval(() => { 
            const elapsedMilliseconds = Date.now() - startTime;
            seconds = Math.floor(elapsedMilliseconds / 1000);
            timerDisplay.textContent=formatTime(seconds); 
        }, 1000);
    }
    
    function stopTimer() { 
        clearInterval(timer); 
        isTimerRunning=false; 
        startButton.disabled=false; 
        stopButton.disabled=true; 
        courseSelect.disabled=false; 
        
        const finalElapsedMilliseconds = Date.now() - startTime;
        seconds = Math.floor(finalElapsedMilliseconds / 1000);
        
        if (seconds < 10) {
            timerError.textContent = "Session < 10s not logged.";
        } else {
            timerError.textContent = ""; 
            logSession(); 
        }
        
        seconds=0; 
        startTime = null;
        timerDisplay.textContent=formatTime(seconds); 
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', startTimer);
    stopButton.addEventListener('click', stopTimer);
    logScoreButton.addEventListener('click', logScore);
    saveEventButton.addEventListener('click', saveEvent);
    
    cancelEventButton.addEventListener('click', () => {
        hideEventModal();
        updateLogDisplay(); 
        showAllButton.hidden = true; 
        calendar.clear();
        setTimeout(initializeTooltips, 50); 
    });
    showAllButton.addEventListener('click', () => { 
        updateLogDisplay(); 
        showAllButton.hidden=true; 
        calendar.clear(); 
        setTimeout(initializeTooltips, 50);
    });

    sessionLog.addEventListener('click', (event) => { 
        if(event.target.classList.contains('delete-btn')){
            const ts = event.target.dataset.timestamp; 
            showConfirmModal(ts, false);
        } else if (event.target.classList.contains('edit-btn')) {
            const ts = event.target.dataset.timestamp;
            showEditModal(ts);
        }
    });
    
    taskList.addEventListener('click', (event) => {
        if (event.target.classList.contains('task-delete-btn')) {
            const ts = event.target.dataset.timestamp;
            showConfirmModal(ts, true);
        } else if (event.target.classList.contains('task-edit-btn')) {
            const ts = event.target.dataset.timestamp;
            showEventModal(null, ts);
        }
    });

    confirmDeleteButton.addEventListener('click', () => {
        const ts = itemToProcess.value;
        if (ts) {
            const eventIndex = allEvents.findIndex(e => e.timestamp === ts);
            if (eventIndex > -1) {
                allEvents[eventIndex].isDone = true;
                saveData();
                updateAllDisplays();
            } else {
                deleteItem(ts);
            }
        }
        hideConfirmModal();
    });

    cancelDeleteButton.addEventListener('click', () => {
        hideConfirmModal();
    });
    
    saveEditButton.addEventListener('click', saveEdit);
    cancelEditButton.addEventListener('click', hideEditModal);
    
    closeChartModalButton.addEventListener('click', hideChartModal);
    
    btnPieTotal.addEventListener('click', () => setPieMode('total'));
    btnPieToday.addEventListener('click', () => setPieMode('today'));

    manageCoursesBtn.addEventListener('click', showCoursesModal);
    closeCoursesModalBtn.addEventListener('click', hideCoursesModal);
    addCourseBtn.addEventListener('click', addCourse);
    courseListEditor.addEventListener('click', (event) => {
        if (event.target.classList.contains('course-delete-btn')) {
            deleteCourse(event.target.dataset.course);
        }
    });
    
    // --- Initial Application Setup ---
    loadData();
    populateCourses();
    initializeCalendar();
    
    eventModalPicker = flatpickr("#event-date-picker", {
        dateFormat: "Y-m-d"
    });

    initializeCharts();
    updateAllDisplays();

    setTimeout(() => {
        if (timeChart) timeChart.resize();
        if (scoreChart) scoreChart.resize();
    }, 50);
}