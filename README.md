# ⚕️ MedChronos

**The dedicated study tracker for Medical Residents and Students.**

MedChronos is a Progressive Web App (PWA) designed for high-stakes medical residency preparation. It combines advanced time-tracking, spaced repetition concepts, and mental resilience tools into a distraction-free interface that works entirely offline.

![Version](https://img.shields.io/github/v/release/crocodilusniloticus/medchronus_pwa?label=latest%20version&color=blue)
![Platform](https://img.shields.io/badge/platform-PWA-blue)
![License](https://img.shields.io/github/license/crocodilusniloticus/residency-prep-hub)
![Build Status](https://github.com/crocodilusniloticus/residency-prep-hub/actions/workflows/build.yml/badge.svg)
![Database](https://img.shields.io/badge/Backend-Supabase-green)


## ✨ Features

### ⏱️ Advanced Study Timers
* **Stopwatch:** Open-ended sessions for deep work logging.
* **Pomodoro:** Automated workflow (Focus 50m → Break 10m) with cycle tracking.
* **Countdown:** Simulate exam blocks (e.g., 4-hour mock exams).
* **Zen Mode:** A dedicated overlay that blacks out the dashboard, showing only the active timer.

### 📊 Analytics & Insights
* **Visual Trends:** "On Fire" vs. "Focus Up" indicators based on 7-day vs. 30-day averages.
* **Subject Breakdown:** Track time distribution per rotation (e.g., Nephro, Cardio, Neuro).
* **Score Logs:** Record practice exam scores and visualize your performance trajectory.

### 📅 Smart Planning
* **Dual Calendar:** Native support for both **Gregorian** and **Persian (Jalaali)** dates.
* **Streak Protection:** Gamified streak counter (requires meeting daily goals).
* **Deadlines:** Color-coded urgency indicators for upcoming exams.
    * *Note: Deadlines sync one-way from App → Google Calendar.*

### 🧠 Focus Tools
* **Audio Engine:** Built-in Brown (Deep), Pink (Balanced), and White (Sharp) noise generators.
* **Breathing Pacer:** Visual "Box Breathing" (4-4-4-4) tool to lower cortisol before study sessions.

---

## 📲 How to Install
MedChronos is a **PWA**, meaning it lives in your browser but behaves like a native app. You do not need an App Store or an `.exe` file.

### 🖥️ Desktop (Chrome / Edge)
1.  Navigate to the app URL.
2.  Look for the **Install Icon** (Computer with a down-arrow) on the right side of the address bar.
3.  Click **Install**. The app will launch in its own standalone window.

### 🍎 iOS (Safari)
1.  Open the URL in Safari.
2.  Tap the **Share** button (Square with arrow up).
3.  Scroll down and tap **"Add to Home Screen"**.

### 🤖 Android (Chrome)
1.  Open the URL in Chrome.
2.  Tap the **Menu** (three dots).
3.  Tap **"Install App"** or **"Add to Home Screen"**.

---

## 🔄 How to Update
Because this is an "Offline-First" app, your browser aggressively caches it.
* **To Update:** Close the app completely (swipe up on mobile) and reopen it. Wait 5 seconds. Close and reopen again.
* **If stuck:** A "Hard Reload" (`Ctrl + Shift + R` on Windows/Linux or `Cmd + Shift + R` on Mac) forces the new version.

---

## ⚠️ Important: Data & Sync
1.  **Local Storage:** By default, all data lives on your device. You do not need internet to study.
2.  **Cloud Backup:** You can sign in (via Settings) to sync your progress to the cloud (Supabase) and share data between your laptop and phone.
3.  **Calendar Warning:** The app acts as the **Master** for the "MedChronos" calendar. **Do not create exam dates on your phone's Google Calendar app**—they will be deleted on the next sync. Only create deadlines *inside* the MedChronos desktop interface.

---

## 💻 For Developers

### Tech Stack
* **Frontend:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3.
* **Backend:** Supabase (Auth & Database).
* **Infrastructure:** Docker, Nginx (Alpine), GitHub Actions.

### Local Development
```bash
# Clone the repo
git clone [https://github.com/crocodilusniloticus/medchronus_pwa.git](https://github.com/crocodilusniloticus/medchronus_pwa.git)

# Enter directory
cd medchronus_pwa

# Start a local server (e.g., using Python or VS Code Live Server)
# PWA Service Workers require HTTPS or Localhost to function.
python3 -m http.server 8000



