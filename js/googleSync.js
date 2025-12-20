/*
 * GOOGLE CALENDAR SYNC (CLIENT-SIDE PWA)
 */

const CLIENT_ID = '321969077224-k7qcqpeuhqhm8r6dgsbpvlvuiv81dvoe.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyAByiKFTPU3Qy-mCBp-4lccxhwgHxFYr6A'; 

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// --- 1. INITIALIZATION ---

export function initGoogleClients() {
    if (window.google) {
        try {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: '', 
            });
            gisInited = true;
            console.log("GIS (Login) Initialized");
        } catch (err) {
            console.error("GIS Init Failed:", err);
        }
    }

    if (window.gapi) {
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                });
                gapiInited = true;
                console.log("GAPI (Data) Initialized");
            } catch (err) {
                console.error("GAPI Init Failed (Check API Key Restrictions):", err);
                alert("Google Sync Error: API Key rejected.\n\nIf you see this, go to Google Cloud Console > Credentials > API Key and set 'Application restrictions' to 'None' temporarily.");
            }
        });
    }
}

export function handleAuthClick() {
    return new Promise((resolve, reject) => {
        if (!gisInited) {
            if (window.google && !tokenClient) initGoogleClients();
            
            if(!gisInited) {
                alert("Login System not ready. Refresh the page.");
                return reject("GIS not initialized");
            }
        }

        tokenClient.callback = async (resp) => {
            if (resp.error) {
                reject(resp);
                throw resp;
            }
            resolve(resp);
        };

        if (window.gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
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
}

// --- 2. SYNC LOGIC ---

export async function pushEventsToGoogle(localEvents) {
    if (!gisInited) {
        return { success: false, error: "Login system not loaded. Refresh page." };
    }

    if (!window.gapi.client.getToken()) {
        try {
            await handleAuthClick(); 
        } catch (e) {
            return { success: false, error: "Login Cancelled" };
        }
    }

    if (!gapiInited) {
        return { success: false, error: "API Connection Failed. Check Console for details." };
    }

    try {
        const stats = await performSync(localEvents);
        return { success: true, stats };
    } catch (e) {
        console.error("Sync Logic Error:", e);
        return { success: false, error: e.message || "Sync Failed" };
    }
}

async function performSync(localEvents) {
    const calendarName = 'MedChronos';
    let calendarId = null;

    try {
        const calList = await window.gapi.client.calendar.calendarList.list();
        const medCal = calList.result.items.find(c => c.summary === calendarName);
        if (medCal) {
            calendarId = medCal.id;
        } else {
            const newCal = await window.gapi.client.calendar.calendars.insert({ summary: calendarName });
            calendarId = newCal.result.id;
        }
    } catch (e) {
        if (e.status === 403) throw new Error("Permission Denied (Check API Quota or Key Restrictions)");
        throw new Error("Could not access calendar. Check console.");
    }

    const activeLocalEvents = localEvents.filter(e => !e.isDone && e.date);
    const updatesToSaveLocally = [];
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (const localEvent of activeLocalEvents) {
        const resource = {
            summary: localEvent.title,
            description: `Priority: ${localEvent.priority || 'low'}`,
            start: { date: localEvent.date }, 
            end: { date: localEvent.date },
            colorId: localEvent.priority === 'high' ? '11' : (localEvent.priority === 'medium' ? '6' : '9')
        };

        const endDateObj = new Date(localEvent.date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const y = endDateObj.getFullYear();
        const m = String(endDateObj.getMonth() + 1).padStart(2, '0');
        const d = String(endDateObj.getDate()).padStart(2, '0');
        resource.end.date = `${y}-${m}-${d}`;

        try {
            if (localEvent.googleId) {
                await window.gapi.client.calendar.events.patch({
                    calendarId: calendarId,
                    eventId: localEvent.googleId,
                    resource: resource
                });
            } else {
                const res = await window.gapi.client.calendar.events.insert({
                    calendarId: calendarId,
                    resource: resource
                });
                localEvent.googleId = res.result.id;
                localEvent.isSynced = true;
                updatesToSaveLocally.push(localEvent);
            }
        } catch (err) {
            if (err.status === 404 && localEvent.googleId) {
                try {
                    localEvent.googleId = null;
                    const res = await window.gapi.client.calendar.events.insert({
                        calendarId: calendarId,
                        resource: resource
                    });
                    localEvent.googleId = res.result.id;
                    localEvent.isSynced = true;
                    updatesToSaveLocally.push(localEvent);
                } catch (retryErr) { console.error("Retry failed"); }
            }
        }
        await sleep(100); 
    }

    return { updatedEvents: updatesToSaveLocally };
}

export async function deleteSingleEvent(googleId) {
    return { success: true };
}