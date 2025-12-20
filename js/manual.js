/**
 * manual.js
 * Comprehensive user manual and help documentation.
 * Uses ES Module syntax for PWA compatibility.
 */

const manualContent = `
<div class="manual-container-inner">

    <div class="manual-section">
        <h3>📲 How to Install (PWA)</h3>
        <p class="manual-intro">
            MedChronos is a <strong>Progressive Web App</strong>. It lives in your browser but installs like a native app for offline use.
        </p>
        <div class="manual-card-grid">
            <div class="manual-card">
                <strong>🖥️ Desktop (Chrome/Edge)</strong>
                <p>Look for the <i class="fas fa-download"></i> <strong>Install icon</strong> on the right side of the URL bar. Click it to install as a standalone app.</p>
            </div>
            <div class="manual-card">
                <strong>🍎 iOS (Safari)</strong>
                <p>Tap the <strong>Share</strong> button <i class="fas fa-share-square"></i> &rarr; Scroll down &rarr; Tap <strong>"Add to Home Screen"</strong>.</p>
            </div>
            <div class="manual-card">
                <strong>🤖 Android (Chrome)</strong>
                <p>Tap the <strong>Three Dots</strong> menu <i class="fas fa-ellipsis-v"></i> &rarr; Tap <strong>"Install App"</strong> or "Add to Home Screen".</p>
            </div>
        </div>
    </div>

    <div class="manual-section">
        <h3>⚠️ Critical: Google Calendar Sync</h3>
        <div class="manual-alert manual-alert-danger">
            <strong>The "Master Controller" Rule</strong>
            <p>
                This app acts as the master source for the <em>"MedChronos"</em> calendar.
                <br><br>
                <strong>Do NOT create events in the Google Calendar app directly.</strong>
                <br>
                If you add an exam via the Google Calendar app/website, MedChronos will <strong>delete it</strong> upon the next sync because it is not in the local database.
                <br><br>
                ✅ <strong>Correct Usage:</strong> Create deadlines <em>inside</em> MedChronos. Use your phone only to VIEW them.
            </p>
        </div>
    </div>

    <div class="manual-section">
        <h3>☁️ Cloud & Offline Data</h3>
        <ul>
            <li><strong>Offline First:</strong> All data is stored immediately in your browser. You never need internet to study.</li>
            <li><strong>Cloud Backup:</strong> If you sign in (via Settings), your Sessions, Scores, and Settings are backed up to the secure cloud.</li>
            <li><strong>Cross-Device:</strong> You can study on your phone during a commute and review on your laptop later. Data merges automatically when online.</li>
        </ul>
    </div>

    <div class="manual-section">
        <h3>⏱️ Study Modes</h3>
        <ul>
            <li><strong>Stopwatch:</strong> For unstructured "Deep Work".</li>
            <li><strong>Pomodoro:</strong> Automated cycles (default: 50m Focus / 10m Break). The app tracks the cycle phase for you.</li>
            <li><strong>Zen Mode:</strong> Tap the <i class="fas fa-eye"></i> icon (or "Focus Mode" button) to hide the dashboard and focus purely on the timer.</li>
        </ul>
    </div>

    <div class="manual-section">
        <h3>📊 Analytics & Streaks</h3>
        <ul>
            <li><strong>The Streak:</strong> Measures consistency. You must meet your daily goal (default: 8h) to increase the streak.</li>
            <li><strong>Freeze Logic:</strong> If you miss a day, the streak resets. (Tip: You can lower your daily goal in Settings on busy days to keep the streak alive).</li>
            <li><strong>Trend Chart:</strong> Shows your last 7 days vs. your 30-day average to tell if you are "On Fire" or need to "Focus Up".</li>
        </ul>
    </div>

    <div class="manual-section">
        <h3>🧠 Focus Tools</h3>
        <ul>
            <li><strong>Audio Engine:</strong> Brown Noise (Deep), Pink Noise (Balanced), White Noise (Sharp).</li>
            <li><strong>Breathing Pacer:</strong> Visual "Box Breathing" guide (4-4-4-4) to reduce pre-exam anxiety. Tap to activate.</li>
            <li><strong>Calendar:</strong> Full dual support for Gregorian and Jalaali dates. Click "Today" to reset the history view.</li>
        </ul>
    </div>

</div>

<style>
    /* Embedded styles for the manual to ensure consistency */
    .manual-container-inner {
        font-size: 0.95rem;
        line-height: 1.6;
        color: var(--text-primary);
    }
    .manual-section {
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--border-color);
    }
    .manual-section:last-child {
        border-bottom: none;
    }
    .manual-section h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: var(--accent-color);
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .manual-card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
    .manual-card {
        background: var(--bg-card);
        padding: 15px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
    }
    .manual-card strong {
        display: block;
        margin-bottom: 8px;
        color: var(--text-primary);
    }
    .manual-card p {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.8;
    }
    .manual-alert {
        padding: 15px;
        border-radius: 8px;
        margin-top: 10px;
        font-size: 0.9rem;
    }
    .manual-alert-danger {
        background: rgba(255, 77, 77, 0.1);
        border: 1px solid var(--danger);
        color: var(--text-primary);
    }
    .manual-alert-danger strong {
        color: var(--danger);
        font-size: 1rem;
    }
    .manual-intro {
        opacity: 0.9;
        margin-bottom: 20px;
    }
    ul {
        padding-left: 20px;
        margin-top: 5px;
    }
    li {
        margin-bottom: 8px;
    }
</style>
`;

export function init() {
    try {
        const container = document.getElementById('manual-container');
        if (container) {
            container.innerHTML = manualContent;
        }
    } catch (e) {
        console.error("Failed to inject manual content:", e);
    }
}