const manualContent = `
<div class="manual-section">
    <h3>Google Calendar Sync</h3>
    <div style="background: var(--bg-body); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 10px;">
        <strong style="color: var(--danger); display:block; margin-bottom:5px;">⚠️ Strict Sync Rule</strong>
        <p style="margin:0; font-size: 0.9rem; line-height: 1.5;">
            This App is the master controller for the <strong>'MedChronos'</strong> calendar <em>only</em>.
            <br><br>
            1. Events in App &rarr; Pushed to Google.
            <br>2. Events found on Google ('MedChronos') but <em>not</em> in the App &rarr; <strong>Deleted</strong>.
        </p>
    </div>
    <ul>
        <li><strong>Usage:</strong> Add deadlines inside this App. Use your phone only to <em>view</em> them.</li>
        <li><strong>Warning:</strong> Any event you add manually to the 'MedChronos' calendar on your phone will be deleted upon the next sync because it does not exist in the App.</li>
    </ul>
</div>


<div class="manual-section">
    <h3>Calendar & Jalaali Dates</h3>
    <ul>
        <li><strong>Dual Dates:</strong> The calendar automatically shows Gregorian dates (large) and <strong>Persian (Jalaali)</strong> dates (small, bottom-left) simultaneously.</li>
        <li><strong>Adding Deadlines:</strong> Right-click (or long-press) any day to add an exam or task.</li>
        <li><strong>Priority Colors:</strong>
            <br>• <span style="color:var(--danger); font-weight:bold;">High (Red):</span> Urgent exams.
            <br>• <span style="color:var(--warning); font-weight:bold;">Medium (Orange):</span> Important deadlines.
            <br>• <span style="color:var(--primary); font-weight:bold;">Low (Blue):</span> Standard reminders.
        </li>
        <li><strong>History:</strong> Clicking a past date filters the <strong>History Log</strong> to show only sessions from that day. Click "Today" to reset.</li>
    </ul>
</div>

<div class="manual-section">
    <h3>Study Timers</h3>
    <ul>
        <li><strong>Stopwatch:</strong> Standard timer. Great for unstructured "deep work" sessions.</li>
        <li><strong>Pomodoro:</strong> Automated cycles. Focus / Short Break / Focus. After 4 cycles, you get a Long Break.
            <br><em>(Customize durations in Settings).</em></li>
        <li><strong>Countdown:</strong> Fixed duration (e.g., "3 Hours"). Ideal for simulating mock exams.</li>
        <li><strong>Zen Mode:</strong> Click the "Zen" icon to black out the interface and focus purely on the timer.</li>
    </ul>
</div>

<div class="manual-section">
    <h3>Analytics & Scores</h3>
    <ul>
        <li><strong>Streak:</strong> Your streak only increases if you meet your <strong>Daily Goal</strong> (Default: 8 hours). Adjust this in Settings.</li>
        <li><strong>Trend Chart:</strong> Shows your study volume over the last 7 or 30 days. The "Status" (e.g., "On Fire", "Focus Up") compares your recent week to your monthly average.</li>
        <li><strong>Log Score:</strong> Record practice exam results (0-100%). The "Performance" chart tracks your improvement per subject over time.</li>
        <li><strong>Attempts:</strong> If you take multiple tests for one subject, the chart groups them so you can see your trajectory.</li>
    </ul>
</div>

<div class="manual-section">
    <h3>Focus Tools</h3>
    <ul>
        <li><strong>Audio Deck:</strong>
            <br>• <strong>Brown Noise:</strong> Deep, rumbly (like a waterfall). Best for deep concentration.
            <br>• <strong>Pink Noise:</strong> Balanced (like rain). Good for general study.
            <br>• <strong>White Noise:</strong> High pitch (like static). Good for blocking outside chatter.
        </li>
        <li><strong>Box Breathing:</strong> A visual pacer to reduce anxiety. Tap to start. Switch between "Orb" and "Lotus" styles.</li>
    </ul>
</div>

<div class="manual-section">
    <h3>Data & Backup</h3>
    <ul>
        <li><strong>Offline First:</strong> Your data lives on this computer.</li>
        <li><strong>Export/Import:</strong> Go to <strong>Settings > Backup</strong> to save a backup file. Use this to move data to a new computer or keep a safe copy.</li>
        <li><strong>Courses:</strong> You can Add/Delete subjects in <strong>Settings > Manage Courses</strong>. Deleting a course does <em>not</em> delete its history logs.</li>
    </ul>
</div>
`;

export function init() {
    try {
        const container = document.getElementById('manual-container');
        if (container) {
            container.innerHTML = manualContent;
        }
    } catch (e) {
        console.error("Failed to load manual content:", e);
    }
}