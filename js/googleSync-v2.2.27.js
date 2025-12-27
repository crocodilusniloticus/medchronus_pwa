/*
 * GOOGLE CALENDAR MASTER SYNC
 * Single Source of Truth Strategy
 */

const CLIENT_ID = '321969077224-k7qcqpeuhqhm8r6dgsbpvlvuiv81dvoe.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyAByiKFTPU3Qy-mCBp-4lccxhwgHxFYr6A'; 
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// --- TOKEN STORAGE & PERSISTENCE ---
function saveTokenLocal(tokenResponse) {
    if (!tokenResponse || !tokenResponse.access_token) return;
    // Calculate expiry. Google tokens usually last 3599 seconds.
    // We subtract 5 minutes buffer to be safe.
    const expiresAt = Date.now() + (tokenResponse.expires_in || 3599) * 1000 - (5 * 60 * 1000); 
    const session = { token: tokenResponse.access_token, expiresAt: expiresAt };
    localStorage.setItem('google_session', JSON.stringify(session));
}

function loadTokenLocal() {
    const raw = localStorage.getItem('google_session');
    if (!raw) return null;
    try {
        const session = JSON.parse(raw);
        if (Date.now() > session.expiresAt) {
            // Token expired
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
                client_id: CLIENT_ID, 
                scope: SCOPES, 
                callback: '', // Defined at request time
            });
            gisInited = true;
        } catch (err) { console.error("GIS Init Failed:", err); }
    }
    if (window.gapi) {
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
                gapiInited = true;
                
                // Attempt to restore session silently
                const savedToken = loadTokenLocal();
                if (savedToken) {
                    window.gapi.client.setToken({ access_token: savedToken });
                }
            } catch (err) { console.error("GAPI Init Failed:", err); }
        });
    }
}

// --- AUTH HANDLER ---
export function handleAuthClick() {
    return new Promise((resolve, reject) => {
        if (!gisInited || !tokenClient) { initGoogleClients(); return reject("GIS loading..."); }
        
        // 1. Check if we have a valid token already loaded
        const currentToken = window.gapi.client.getToken();
        const savedToken = loadTokenLocal();

        if (currentToken && savedToken && currentToken.access_token === savedToken) {
            resolve({ access_token: currentToken.access_token });
            return;
        }

        // 2. If no valid token, request one
        tokenClient.callback = async (resp) => {
            if (resp.error) reject(resp);
            else { 
                saveTokenLocal(resp); 
                resolve(resp); 
            }
        };

        // If we have a saved token but gapi doesn't know it yet, try setting it
        if (savedToken) {
             window.gapi.client.setToken({ access_token: savedToken });
             resolve({ access_token: savedToken });
        } else {
             // Prompt user (or silent if previously consented)
             tokenClient.requestAccessToken({ prompt: '' }); 
        }
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

// --- HELPER: Calendar ID ---
async function getCalendarId() {
    const calendarName = 'MedChronos';
    const calList = await window.gapi.client.calendar.calendarList.list();
    const medCal = calList.result.items.find(c => c.summary === calendarName);
    if (medCal) return medCal.id;
    const newCal = await window.gapi.client.calendar.calendars.insert({ summary: calendarName });
    return newCal.result.id;
}

// --- HELPER: Description Parser ---
// This allows us to store "Done" and "Priority" in Google Calendar
function parseDescription(desc) {
    let priority = 'low';
    let isDone = false;
    
    if (desc) {
        if (desc.includes('Priority: high')) priority = 'high';
        else if (desc.includes('Priority: medium')) priority = 'medium';
        else if (desc.includes('Priority: low')) priority = 'low';
        
        if (desc.includes('Status: [done]')) isDone = true;
    }
    return { priority, isDone };
}

function createDescription(priority, isDone) {
    return `Priority: ${priority}\nStatus: [${isDone ? 'done' : 'pending'}]\n---\nCreated by MedChronos`;
}

// --- CORE FUNCTION 1: MASTER FETCH (Download) ---
// This overwrites local events with Google events.
export async function fetchGoogleEventsMaster() {
    if (!gapiInited) return { success: false, error: "GAPI not ready" };
    try { await handleAuthClick(); } catch (e) { return { success: false, error: "Login Required" }; }

    try {
        const calendarId = await getCalendarId();
        
        // Fetch events (e.g., from 1 month ago to 1 year ahead)
        const minDate = new Date();
        minDate.setMonth(minDate.getMonth() - 1);
        
        const response = await window.gapi.client.calendar.events.list({
            calendarId: calendarId,
            timeMin: minDate.toISOString(),
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const googleEvents = response.result.items || [];
        
        // Transform into App Format
        const finalEvents = googleEvents.map(gEvent => {
            const meta = parseDescription(gEvent.description);
            // Fallback for date if it's a timed event vs all-day event
            const dateStr = gEvent.start.date || (gEvent.start.dateTime ? gEvent.start.dateTime.split('T')[0] : null);
            
            return {
                id: gEvent.id,       // Use Google ID as internal ID
                googleId: gEvent.id, // Explicit reference
                title: gEvent.summary,
                date: dateStr,
                timestamp: gEvent.created, 
                priority: meta.priority,
                isDone: meta.isDone,
                isSynced: true
            };
        }).filter(e => e.date); // Filter out events with no date

        return { success: true, events: finalEvents };

    } catch (e) {
        console.error("Google Fetch Error:", e);
        if(e.status === 401) localStorage.removeItem('google_session'); // Clear bad token
        return { success: false, error: e.message };
    }
}

// --- CORE FUNCTION 2: UPSERT (Upload) ---
// Handles both Create and Update
export async function upsertEventToGoogle(appEvent) {
    if (!navigator.onLine) return { success: false, error: "Offline" };
    try { await handleAuthClick(); } catch (e) { return { success: false, error: "Auth Failed" }; }

    try {
        const calendarId = await getCalendarId();
        const resource = {
            summary: appEvent.title,
            description: createDescription(appEvent.priority, appEvent.isDone),
            start: { date: appEvent.date },
            end: { date: appEvent.date },
            colorId: appEvent.priority === 'high' ? '11' : (appEvent.priority === 'medium' ? '6' : '9')
        };
        
        // Google Calendar all-day events are exclusive of end date, so add 1 day
        const endDateObj = new Date(appEvent.date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        resource.end.date = endDateObj.toISOString().split('T')[0];

        let resultId;

        if (appEvent.googleId) {
            // UPDATE existing
            try {
                await window.gapi.client.calendar.events.patch({
                    calendarId: calendarId,
                    eventId: appEvent.googleId,
                    resource: resource
                });
                resultId = appEvent.googleId;
            } catch (patchErr) {
                // If 404/410, event was deleted on Google. Re-create it.
                if (patchErr.status === 404 || patchErr.status === 410) {
                     const res = await window.gapi.client.calendar.events.insert({
                        calendarId: calendarId, resource: resource
                    });
                    resultId = res.result.id;
                } else throw patchErr;
            }
        } else {
            // INSERT new
            const res = await window.gapi.client.calendar.events.insert({
                calendarId: calendarId,
                resource: resource
            });
            resultId = res.result.id;
        }

        return { success: true, googleId: resultId };

    } catch (e) {
        console.error("Google Upsert Error:", e);
        return { success: false, error: e.message };
    }
}

// --- CORE FUNCTION 3: DELETE ---
export async function deleteEventFromGoogle(googleId) {
    if (!navigator.onLine || !googleId) return { success: true }; // Assume success if local only
    try { await handleAuthClick(); } catch (e) { return { success: false }; }

    try {
        const calendarId = await getCalendarId();
        await window.gapi.client.calendar.events.delete({
            calendarId: calendarId,
            eventId: googleId
        });
        return { success: true };
    } catch (e) {
        if(e.status === 404 || e.status === 410) return { success: true }; // Already gone
        console.error("Google Delete Error:", e);
        return { success: false, error: e.message };
    }
}
// Removed "performTwoWaySync" entirely as it is no longer used.
export const pushEventsToGoogle = null; // Deprecated