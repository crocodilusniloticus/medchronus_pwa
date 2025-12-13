let state, refs;
// IMPORT UTILS
const { getLocalISODateString, getPersianDateString } = require('./utils');

function init(appState, uiRefs) {
    state = appState;
    refs = uiRefs;
}

// --- NEW HELPER: Read CSS Variables ---
function getCSSVal(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

function getCharts() {
    return {
        timeChart: state.timeChart,
        scoreChart: state.scoreChart,
        zoomedTimeChart: state.zoomedTimeChart,
        zoomedScoreChart: state.zoomedScoreChart
    };
}

function initializeCharts() {
    const chartOptions = { 
        renderer: 'svg', 
        devicePixelRatio: window.devicePixelRatio || 2 
    };
    
    state.timeChart = echarts.init(refs.timeChart, null, chartOptions);
    state.scoreChart = echarts.init(refs.scoreChart, null, chartOptions);

    const chartResizeObserver = new ResizeObserver(() => {
        if (state.timeChart) state.timeChart.resize();
        if (state.scoreChart) state.scoreChart.resize();
    });

    chartResizeObserver.observe(refs.timeChart);
    chartResizeObserver.observe(refs.scoreChart);

    const toggleZoom = (isVisible) => {
        state.scoreChart.setOption({ dataZoom: [{ show: isVisible }] });
    };
    refs.scoreChart.addEventListener('mouseenter', () => toggleZoom(true));
    refs.scoreChart.addEventListener('mouseleave', () => toggleZoom(false));
}

function updateLeftChartHeader(title, showStats = false, statData = null) {
    const titleEl = document.getElementById('chart-title-left');
    if (titleEl) titleEl.textContent = title;

    const statsContainer = document.getElementById('trend-stats-container');
    const valueEl = document.getElementById('trend-stats-value');
    const statusEl = document.getElementById('trend-stats-status');

    if (showStats && statData) {
        if (valueEl) valueEl.textContent = `${statData.label}: ${statData.value}h/d`;
        if (statusEl) {
            statusEl.textContent = `${statData.icon} ${statData.text}`;
            statusEl.style.color = statData.color;
        }
        statsContainer.classList.add('visible');
    } else {
        statsContainer.classList.remove('visible');
    }
}

function getTrendChartOptions() {
    const days = state.trendChartSpan || 7;
    const isHighDensity = days > 14; 
    const labelFontSize = isHighDensity ? 9 : 11;       
    const labelPadding = isHighDensity ? [2, 4] : [4, 8]; 
    const labelDistance = isHighDensity ? 5 : 8;       

    const now = new Date();
    let totalSec7 = 0; let totalSec30 = 0;

    state.allSessions.forEach(s => {
        const sTime = new Date(s.timestamp).getTime();
        const diffTime = now.getTime() - sTime;
        const diffDays = diffTime / (1000 * 3600 * 24);
        if (diffDays <= 7) totalSec7 += s.seconds;
        if (diffDays <= 30) totalSec30 += s.seconds;
    });

    const avgDaily7 = (totalSec7 / 7 / 3600);
    const avgDaily30 = (totalSec30 / 30 / 3600);
    
    const statLabel = isHighDensity ? "Month" : "Week";
    const statValue = isHighDensity ? avgDaily30.toFixed(1) : avgDaily7.toFixed(1);

    let statusText = "Gathering Data...";
    
    // CSS VARIABLE LOOKUPS FOR STATUS
    const colorNeutral = getCSSVal('--chart-status-neutral');
    const colorDanger  = getCSSVal('--chart-status-danger');
    const colorWarning = getCSSVal('--chart-status-warning');
    const colorSuccess = getCSSVal('--chart-status-success');
    const colorText    = getCSSVal('--chart-text');
    const colorGrid    = getCSSVal('--chart-grid-line');
    
    let statusColor = colorNeutral; 
    let statusIcon = "○";

    if (avgDaily7 < 1 ) { statusText = "Focus up!"; statusIcon = "⚡"; statusColor = colorDanger; } 
    else {
        const ratio = avgDaily30 > 0 ? (avgDaily7 / avgDaily30) : 2.0;
        if (ratio >= 1.5) { statusText = "On Fire!"; statusColor = colorWarning; statusIcon = "🔥"; } 
        else if (ratio >= 0.9) { statusText = "Consistent"; statusColor = colorSuccess; statusIcon = "✅"; } 
        else if (ratio >= 0.5) { statusText = "Keep Pushing"; statusColor = colorText; statusIcon = "📈"; } 
        else { statusText = "Focus up!"; statusColor = colorDanger; statusIcon = "⚠️"; }
    }

    updateLeftChartHeader(`Study Trend (Last ${days} Days)`, true, {
        label: statLabel, value: statValue, text: statusText, color: statusColor, icon: statusIcon
    });

    const getPerformanceStyle = (hours) => {
        // You can also map these to CSS vars if you want strict adherence, 
        // but simple hex logic is often faster for dynamic heatmaps.
        if (!hours || hours < 0.2) return { bg: '#e0e0e0', text: '#4a413a' }; 
        const ratio = hours / 2; 
        if (ratio < 0.5) return { bg: '#cfd8dc', text: '#455a64' }; 
        if (ratio < 1.0) return { bg: '#a5d6a7', text: '#1b5e20' }; 
        if (ratio < 1.5) return { bg: '#fff59d', text: '#f57f17' }; 
        return { bg: '#ef9a9a', text: '#b71c1c' }; 
    };

    const endDate = new Date();
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(endDate.getDate() - i);
        dates.push(getLocalISODateString(d));
    }

    const dataMap = {};
    dates.forEach(date => dataMap[date] = {});
    state.allSessions.forEach(s => {
        const sDate = getLocalISODateString(new Date(s.timestamp));
        if (dataMap[sDate]) dataMap[sDate][s.course] = (dataMap[sDate][s.course] || 0) + s.seconds;
    });

    const activeCourses = state.allCourses.filter(course => dates.some(date => (dataMap[date][course] || 0) > 0));

    const styledTotalData = dates.map(date => {
        let sum = 0;
        Object.values(dataMap[date]).forEach(seconds => sum += seconds);
        if (sum === 0) return null; 
        const hours = parseFloat((sum / 3600).toFixed(2));
        const style = getPerformanceStyle(hours); 
        return { 
            value: hours, 
            label: { backgroundColor: style.bg, color: style.text, borderRadius: 12, padding: labelPadding } 
        };
    });

    // LOAD PALETTE FROM CSS
    const palette = [
        getCSSVal('--chart-c1'),
        getCSSVal('--chart-c2'),
        getCSSVal('--chart-c3'),
        getCSSVal('--chart-c4'),
        getCSSVal('--chart-c5'),
        getCSSVal('--chart-c6')
    ];

    const series = activeCourses.map((course, index) => {
        const data = dates.map(date => ((dataMap[date][course] || 0) / 3600).toFixed(2));
        return {
            name: course, type: 'bar', stack: 'total', data: data,
            itemStyle: { color: palette[index % palette.length] },
            emphasis: { focus: 'series' }
        };
    });

    series.push({
        name: 'Total Daily', type: 'line', symbol: 'circle', symbolSize: 1, data: styledTotalData, 
        lineStyle: { width: 0, opacity: 0 }, itemStyle: { color: 'transparent', borderWidth: 0 }, silent: true, 
        label: {
            show: true, position: 'top', distance: labelDistance, 
            formatter: (params) => parseFloat(params.value) > 0 ? `${parseFloat(params.value).toFixed(1)}h` : '',
            fontWeight: 'bold', fontSize: labelFontSize
        }, z: 10 
    });

    return {
        tooltip: { 
            trigger: 'axis', axisPointer: { type: 'shadow' },
            backgroundColor: getCSSVal('--chart-tooltip-bg'), 
            borderColor: colorGrid,
            textStyle: { color: colorText, fontWeight: '600' },
            formatter: function (params) {
                const pDate = getPersianDateString(new Date(params[0].name));
                let tooltipHtml = `<div style="margin-bottom:4px; border-bottom:1px solid ${colorGrid}; padding-bottom:4px;">${pDate}</div>`;
                let hasData = false;
                params.forEach(item => {
                    if (item.seriesName !== 'Total Daily' && parseFloat(item.value) > 0) {
                        hasData = true;
                        const colorDot = `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${item.color};"></span>`;
                        tooltipHtml += `<div style="display:flex; justify-content:space-between; gap:15px; margin-top:4px;"><span>${colorDot} ${item.seriesName}</span><span style="font-weight:bold">${item.value}h</span></div>`;
                    }
                });
                if (!hasData) return `${pDate}<br/>No study data`;
                return tooltipHtml;
            }
        },
        legend: { type: 'scroll', bottom: 0, textStyle: { color: colorText }, data: activeCourses },
        grid: { left: '2%', right: '3%', bottom: '12%', top: '10%', containLabel: true },
        xAxis: { 
            type: 'category', 
            data: dates, 
            axisLine: { lineStyle: { color: colorGrid } }, 
            axisLabel: { 
                color: colorText,
                formatter: function(value) {
                    return getPersianDateString(new Date(value));
                }
            } 
        },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: colorGrid, type: 'dashed' } }, axisLabel: { color: colorText } },
        series: series
    };
}

function getTimeChartOptions(modeOverride) {
    const mode = modeOverride || state.pieChartMode || 'total';
    if (mode === 'trend') return getTrendChartOptions();

    let sessionsToDisplay = state.allSessions;
    let title = 'Study Time (Total)';
    if (mode === 'today') {
        const todayStr = getLocalISODateString(new Date());
        sessionsToDisplay = state.allSessions.filter(s => getLocalISODateString(new Date(s.timestamp)) === todayStr);
        title = 'Study Time (Today)';
    }

    updateLeftChartHeader(title, false);
    const courseData = {};
    let totalSeconds = 0;
    sessionsToDisplay.forEach(s => { 
        courseData[s.course] = (courseData[s.course] || 0) + (s.seconds || 0);
        totalSeconds += (s.seconds || 0);
    });

    const chartData = Object.keys(courseData).map(course => ({ name: course, value: (courseData[course] / 3600) }));
    
    // LOAD PALETTE FROM CSS
    const piePalette = [
        getCSSVal('--chart-c1'),
        getCSSVal('--chart-c2'),
        getCSSVal('--chart-c3'),
        getCSSVal('--chart-c4'),
        getCSSVal('--chart-c5'),
        getCSSVal('--chart-c6')
    ];

    const colorText = getCSSVal('--chart-text');
    const colorGrid = getCSSVal('--chart-grid-line');

    return {
        color: piePalette,
        tooltip: { 
            trigger: 'item', 
            backgroundColor: getCSSVal('--chart-tooltip-bg'),
            borderColor: colorGrid,
            textStyle: { color: colorText },
            formatter: (p) => {
                const colorDot = `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${p.color};"></span>`;
                return `${colorDot} <b>${p.name}</b><br/>${parseFloat(p.value).toFixed(2)}h (${p.percent}%)`;
            }
        },
        legend: { 
            type: 'scroll', 
            orient: 'vertical',
            right: 0,
            top: 'middle',
            height: '90%',
            textStyle: { color: colorText, fontWeight: 'bold' },
            pageIconColor: getCSSVal('--chart-c1'),
            pageTextStyle: { color: colorText }
        },
        series: [{ 
            type: 'pie', 
            radius: ['60%', '90%'], 
            center: ['42%', '50%'], 
            data: chartData, 
            label: { show: false },
            itemStyle: { borderColor: '#ffffff', borderWidth: 3 },
            emphasis: { scale: true, scaleSize: 5 }
        }]
    };
}

function updateTimeChart() {
    state.timeChart.clear(); 
    const option = getTimeChartOptions(state.pieChartMode);
    state.timeChart.setOption(option, { notMerge: true });

    const overlay = document.getElementById('pie-overlay');
    const valEl = document.getElementById('pie-val');

    if (overlay && valEl) {
        if (state.pieChartMode === 'trend') {
            overlay.classList.add('hidden');
        } else {
            overlay.classList.remove('hidden');
            let totalSeconds = 0;
            let sessions = state.allSessions;
            if (state.pieChartMode === 'today') {
                const todayStr = getLocalISODateString(new Date());
                sessions = sessions.filter(s => getLocalISODateString(new Date(s.timestamp)) === todayStr);
            }
            sessions.forEach(s => totalSeconds += (s.seconds || 0));
            valEl.textContent = (totalSeconds / 3600).toFixed(1);
        }
    }
}

function getScoreChartOptions() {
    // 1. Process Data: Group by Course and Sort by Date
    const courseGroups = {};
    let maxAttempts = 0;

    state.allScores.forEach(s => {
        if (!courseGroups[s.course]) {
            courseGroups[s.course] = [];
        }
        courseGroups[s.course].push({
            score: s.score,
            date: new Date(s.timestamp),
            notes: s.notes
        });
    });

    // Sort courses by latest activity (Right side = Most recent courses)
    const courses = Object.keys(courseGroups).sort((a, b) => {
        const lastA = Math.max(...courseGroups[a].map(i => i.date));
        const lastB = Math.max(...courseGroups[b].map(i => i.date));
        return lastA - lastB;
    });

    // Sort scores within courses (Oldest -> Newest) & Find Max Attempts
    courses.forEach(c => {
        courseGroups[c].sort((a, b) => a.date - b.date);
        if (courseGroups[c].length > maxAttempts) {
            maxAttempts = courseGroups[c].length;
        }
    });

    // 2. Build Series Data
    const seriesList = [];
    const baseColor = getCSSVal('--chart-c4'); 

    for (let i = 0; i < maxAttempts; i++) {
        const dataForAttempt = courses.map(c => {
            const entry = courseGroups[c][i]; 
            if (!entry) return null; 
            return {
                value: entry.score,
                date: entry.date,
                notes: entry.notes,
                course: c,
                attemptIndex: i + 1
            };
        });

        // Opacity gradient: Older attempts are ghosted, newest are solid
        const opacity = 0.3 + (0.7 * (i / (maxAttempts - 1 || 1)));

        seriesList.push({
            name: `Attempt ${i + 1}`,
            type: 'bar',
            data: dataForAttempt,
            barGap: '5%',          // Tight gap between attempts
            barCategoryGap: '30%', // Distinct gap between courses
            itemStyle: {
                color: baseColor,
                opacity: opacity,
                borderRadius: [3, 3, 0, 0]
            },
            emphasis: {
                focus: 'series',
                itemStyle: { opacity: 1, color: getCSSVal('--chart-c2') }
            }
        });
    }

    const colorText = getCSSVal('--chart-text');
    const colorGrid = getCSSVal('--chart-grid-line');
    const zoomColor = getCSSVal('--chart-c1');

    // Calculate Zoom: Show max 5 courses by default, anchored to the RIGHT (newest)
    const defaultZoomStart = courses.length > 5 ? 100 - ((5 / courses.length) * 100) : 0;

    return {
        tooltip: {
            trigger: 'item',
            backgroundColor: getCSSVal('--chart-tooltip-bg'),
            borderColor: colorGrid,
            textStyle: { color: colorText },
            formatter: (params) => {
                if (!params.data) return '';
                const pDate = getPersianDateString(params.data.date);
                return `
                    <div style="font-weight:bold; margin-bottom:4px; border-bottom:1px solid ${colorGrid}; padding-bottom:4px;">
                        ${params.data.course} <span style="font-weight:normal; font-size:0.8em;">(#${params.data.attemptIndex})</span>
                    </div>
                    <div>Score: <strong style="color:${baseColor}">${params.value}%</strong></div>
                    <div style="font-size:0.85em; color:${colorText}; margin-top:2px;">${pDate}</div>
                    ${params.data.notes ? `<div style="font-style:italic; margin-top:4px; font-size:0.8em; opacity:0.8;">"${params.data.notes}"</div>` : ''}
                `;
            }
        },
        grid: {
            left: '5%',
            right: '5%',
            top: '10%',
            bottom: '35px', // Space for the scrollbar
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: courses,
            axisLabel: {
                color: colorText,
                interval: 0,
                fontSize: 11,
                fontWeight: 'bold',
                width: 90,
                overflow: 'break'
            },
            axisLine: { lineStyle: { color: colorGrid } },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: { color: colorText },
            splitLine: { lineStyle: { color: colorGrid, type: 'dashed' } }
        },
        
        // FUNCTIONAL SCROLLBAR
        dataZoom: [
            {
                type: 'slider',
                show: true,
                xAxisIndex: 0,
                start: defaultZoomStart, 
                end: 100,                
                height: 10,              // Slim track
                bottom: 5,
                borderColor: 'transparent',
                backgroundColor: 'rgba(0,0,0,0.03)',
                fillerColor: 'rgba(40, 53, 147, 0.15)', 
                borderRadius: 5,         
                
                // --- MINIMAL HANDLES ---
                // Simple rounded vertical pill shape
                handleIcon: 'path://M-2,0 h4 c1.1,0 2,0.9 2,2 v12 c0,1.1 -0.9,2 -2,2 h-4 c-1.1,0 -2,-0.9 -2,-2 v-12 c0,-1.1 0.9,-2 2,-2 z',
                handleSize: '140%',      // Slightly larger than track to be grabbable
                handleStyle: {
                    color: '#ffffff',
                    borderColor: '#cfd8dc', // Light grey border
                    borderWidth: 1,
                    shadowBlur: 2,
                    shadowColor: 'rgba(0, 0, 0, 0.1)'
                },

                brushSelect: false,      // Disable selection drag
                moveHandleSize: 0,       // Hide top bar
                showDataShadow: false, 
                showDetail: false
            },
            {
                type: 'inside', 
                xAxisIndex: 0,
                zoomOnMouseWheel: false,
                moveOnMouseWheel: true
            }
        ],
        
        series: seriesList
    };
}

function updateScoreChart() {
    const option = getScoreChartOptions();
    state.scoreChart.setOption(option, { notMerge: true });
}

function setPieMode(mode) {
    state.pieChartMode = mode;
    refs.btnPieTotal.classList.toggle('active', mode === 'total');
    refs.btnPieToday.classList.toggle('active', mode === 'today');
    refs.btnPieTrend.classList.toggle('active', mode === 'trend');
    if (mode === 'trend') refs.trendSpanSelect.classList.remove('hidden'); else refs.trendSpanSelect.classList.add('hidden');
    updateTimeChart(); 
}

module.exports = {
    init, initializeCharts, getTimeChartOptions, getTrendChartOptions, getScoreChartOptions,
    updateTimeChart, updateScoreChart, setPieMode, getCharts
};