/*
 * GOOGLE CALENDAR SYNC (CLIENT-SIDE PWA)
 * TWO-WAY SYNC WITH SMART LINKING
 */

const CLIENT_ID = '321969077224-k7qcqpeuhqhm8r6dgsbpvlvuiv81dvoe.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyAByiKFTPU3Qy-mCBp-4lccxhwgHxFYr6A'; 
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// --- TOKEN STORAGE ---
function saveTokenLocal(tokenResponse) {
    if (!tokenResponse || !tokenResponse.access_token) return;
    const expiresAt = Date.now() + (50 * 60 * 1000); 
    const session = { token: tokenResponse.access_token, expiresAt: expiresAt };
    localStorage.setItem('google_session', JSON.stringify(session));
}

function loadTokenLocal() {
    const raw = localStorage.getItem('google_session');
    if (!raw) return null;
    try {
        const session = JSON.parse(raw);
        if (Date.now() > session.expiresAt) {
            localStorage.removeItem('google_session'); 
            return null;
        }
        return session.token;
    } catch (e) { return null; }
}

// --- INIT ---
export function initGoogleClients() {
    if (window.google) {
        try {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID, scope: SCOPES, callback: '',
            });
            gisInited = true;
        } catch (err) { console.error("GIS Init Failed:", err); }
    }
    if (window.gapi) {
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
                gapiInited = true;
                const savedToken = loadTokenLocal();
                if (savedToken) window.gapi.client.setToken({ access_token: savedToken });
            } catch (err) { console.error("GAPI Init Failed:", err); }
        });
    }
}

// --- AUTH ---
export function handleAuthClick() {
    return new Promise((resolve, reject) => {
        if (!gisInited || !tokenClient) { initGoogleClients(); return reject("GIS loading..."); }
        if (window.gapi.client.getToken() !== null) { resolve({ access_token: window.gapi.client.getToken().access_token }); return; }
        
        const savedToken = loadTokenLocal();
        if (savedToken) {
            window.gapi.client.setToken({ access_token: savedToken });
            resolve({ access_token: savedToken });
            return;
        }

        tokenClient.callback = async (resp) => {
            if (resp.error) reject(resp);
            else { saveTokenLocal(resp); resolve(resp); }
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

export function handleSignoutClick() {
    const token = window.gapi.client.getToken();
    if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token);
        window.gapi.client.setToken('');
    }
    localStorage.removeItem('google_session');
}

// --- CORE TWO-WAY SYNC LOGIC ---

export async function pushEventsToGoogle(localEvents) {
    if (!gapiInited) await new Promise(r => setTimeout(r, 1000));
    try { await handleAuthClick(); } catch (e) { return { success: false, error: "Login Required" }; }

    try {
        const calendarId = await getCalendarId();
        const googleEvents = await fetchGoogleEvents(calendarId);
        const { finalEvents, stats } = await performTwoWaySync(calendarId, localEvents, googleEvents);
        return { success: true, stats, finalEvents }; 
    } catch (e) {
        console.error("Two-Way Sync Error:", e);
        return { success: false, error: e.message };
    }
}

async function getCalendarId() {
    const calendarName = 'MedChronos';
    const calList = await window.gapi.client.calendar.calendarList.list();
    const medCal = calList.result.items.find(c => c.summary === calendarName);
    if (medCal) return medCal.id;
    const newCal = await window.gapi.client.calendar.calendars.insert({ summary: calendarName });
    return newCal.result.id;
}

async function fetchGoogleEvents(calendarId) {
    const response = await window.gapi.client.calendar.events.list({
        calendarId: calendarId, maxResults: 2500, singleEvents: true
    });
    return response.result.items || [];
}

async function performTwoWaySync(calendarId, localEvents, googleEvents) {
    let stats = { addedToLocal: 0, deletedFromLocal: 0, uploadedToGoogle: 0 };
    let newLocalEvents = [...localEvents]; 
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // --- A. IMPORT FROM GOOGLE ---
    googleEvents.forEach(gEvent => {
        // 1. Try Match by ID
        let matchIndex = newLocalEvents.findIndex(l => l.googleId === gEvent.id);
        
        // 2. SMART LINKING: If no ID match, try Title + Date match
        // This fixes the "Duplicate" issue for legacy events
        if (matchIndex === -1) {
            matchIndex = newLocalEvents.findIndex(l => 
                !l.googleId && // Only link if local has no ID
                l.title === gEvent.summary && 
                l.date === gEvent.start.date
            );
            // If we found a "Fuzzy Match", link them now!
            if (matchIndex > -1) {
                newLocalEvents[matchIndex].googleId = gEvent.id;
                newLocalEvents[matchIndex].isSynced = true;
            }
        }
        
        if (matchIndex > -1) {
            // EXISTS: Update local details
            if (newLocalEvents[matchIndex].title !== gEvent.summary || 
                newLocalEvents[matchIndex].date !== gEvent.start.date) {
                newLocalEvents[matchIndex].title = gEvent.summary;
                newLocalEvents[matchIndex].date = gEvent.start.date;
                if(gEvent.description && gEvent.description.includes('Priority:')) {
                    const p = gEvent.description.split('Priority:')[1].trim();
                    newLocalEvents[matchIndex].priority = p;
                }
                newLocalEvents[matchIndex].isSynced = true;
            }
        } else {
            // MISSING LOCALLY: Add it
            let priority = 'low';
            if(gEvent.description && gEvent.description.includes('Priority:')) {
                priority = gEvent.description.split('Priority:')[1].trim();
            }
            newLocalEvents.push({
                title: gEvent.summary,
                date: gEvent.start.date, 
                timestamp: new Date().toISOString(), 
                priority: priority,
                isDone: false,
                googleId: gEvent.id,
                isSynced: true
            });
            stats.addedToLocal++;
        }
    });

    // --- B. HANDLE DELETIONS ---
    const googleIds = new Set(googleEvents.map(g => g.id));
    const countBefore = newLocalEvents.length;
    newLocalEvents = newLocalEvents.filter(local => {
        // If it was previously synced (has ID) but missing from Google -> Delete
        if (local.googleId && !googleIds.has(local.googleId)) {
            return false; 
        }
        return true; 
    });
    stats.deletedFromLocal = countBefore - newLocalEvents.length;

    // --- C. EXPORT TO GOOGLE ---
    for (const localEvent of newLocalEvents) {
        if (localEvent.isSynced && localEvent.googleId) continue; 

        // Important: If it's marked DONE locally, we still sync it, 
        // but Google Calendar doesn't have "Done". It just stays as an event.
        
        const resource = {
            summary: localEvent.title,
            description: `Priority: ${localEvent.priority || 'low'}`,
            start: { date: localEvent.date }, 
            end: { date: localEvent.date }, 
            colorId: localEvent.priority === 'high' ? '11' : (localEvent.priority === 'medium' ? '6' : '9')
        };
        const endDateObj = new Date(localEvent.date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        resource.end.date = endDateObj.toISOString().split('T')[0];

        try {
            const res = await window.gapi.client.calendar.events.insert({
                calendarId: calendarId, resource: resource
            });
            localEvent.googleId = res.result.id;
            localEvent.isSynced = true;
            stats.uploadedToGoogle++;
        } catch (err) { console.error(`Upload error:`, err); }
        await sleep(150); 
    }

    return { finalEvents: newLocalEvents, stats };
}

export async function deleteSingleEvent(googleId) {
    if (!gapiInited) return { success: false };
    try {
        const calList = await window.gapi.client.calendar.calendarList.list();
        const medCal = calList.result.items.find(c => c.summary === 'MedChronos');
        if (!medCal) return { success: true };
        await window.gapi.client.calendar.events.delete({ calendarId: medCal.id, eventId: googleId });
        return { success: true };
    } catch (e) { return { success: true }; }
}