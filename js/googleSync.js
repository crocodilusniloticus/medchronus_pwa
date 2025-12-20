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
    // GIS (Identity Services) - Handles Login/Token
    if (window.google) {
        try {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: '', // Defined at request time
            });
            gisInited = true;
            console.log("GIS (Login) Initialized");
        } catch (err) {
            console.error("GIS Init Failed:", err);
        }
    }

    // GAPI (Client Library) - Handles Calendar Data
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
                console.error("GAPI Init Failed:", err);
            }
        });
    }
}

// --- 2. AUTH FLOW ---

export function handleAuthClick() {
    return new Promise((resolve, reject) => {
        // Retry Init if needed
        if (!gisInited || !tokenClient) initGoogleClients();
        
        if (!gisInited || !tokenClient) {
            alert("Google Services are still loading. Please wait a moment and try again.");
            return reject("GIS not initialized");
        }

        // Define the callback for THIS specific request
        tokenClient.callback = async (resp) => {
            if (resp.error) {
                console.error("Google Auth Error:", resp);
                reject(resp);
            } else {
                resolve(resp);
            }
        };

        // Check if we already have a token
        if (window.gapi && window.gapi.client.getToken() === null) {
            // Trigger Popup
            // 'consent' forces the popup to appear if not signed in
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            // Refresh token silently
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

// --- 3. SYNC LOGIC ---

export async function pushEventsToGoogle(localEvents) {
    // 1. Check Clients
    if (!gapiInited) {
        // Try waiting 1 second
        await new Promise(r => setTimeout(r, 1000));
        if (!gapiInited) return { success: false, error: "Google API not connected." };
    }

    // 2. Check Auth
    if (!window.gapi.client.getToken()) {
        try {
            await handleAuthClick(); 
        } catch (e) {
            return { success: false, error: "Login Cancelled or Failed" };
        }
    }

    // 3. Perform Sync
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

    // Get or Create Calendar
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
        if (e.status === 403) throw new Error("Permission Denied (Check API Quota)");
        throw new Error("Calendar Access Failed");
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

        // Fix End Date (Google needs exclusive end date for all-day events)
        const endDateObj = new Date(localEvent.date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const y = endDateObj.getFullYear();
        const m = String(endDateObj.getMonth() + 1).padStart(2, '0');
        const d = String(endDateObj.getDate()).padStart(2, '0');
        resource.end.date = `${y}-${m}-${d}`;

        try {
            if (localEvent.googleId) {
                // Update Existing
                try {
                    await window.gapi.client.calendar.events.patch({
                        calendarId: calendarId,
                        eventId: localEvent.googleId,
                        resource: resource
                    });
                } catch (patchErr) {
                    // If 404 (Deleted on Google), Re-create it
                    if (patchErr.status === 404 || patchErr.status === 410) {
                        const res = await window.gapi.client.calendar.events.insert({
                            calendarId: calendarId,
                            resource: resource
                        });
                        localEvent.googleId = res.result.id;
                        localEvent.isSynced = true;
                        updatesToSaveLocally.push(localEvent);
                    }
                }
            } else {
                // Insert New
                const res = await window.gapi.client.calendar.events.insert({
                    calendarId: calendarId,
                    resource: resource
                });
                localEvent.googleId = res.result.id;
                localEvent.isSynced = true;
                updatesToSaveLocally.push(localEvent);
            }
        } catch (err) {
            console.error(`Sync error for ${localEvent.title}:`, err);
        }
        await sleep(150); // Rate limit protection
    }

    return { updatedEvents: updatesToSaveLocally };
}

export async function deleteSingleEvent(googleId) {
    if (!gapiInited || !gisInited) return { success: false };
    if (!window.gapi.client.getToken()) return { success: false };

    try {
        const calList = await window.gapi.client.calendar.calendarList.list();
        const medCal = calList.result.items.find(c => c.summary === 'MedChronos');
        if (!medCal) return { success: true };

        await window.gapi.client.calendar.events.delete({
            calendarId: medCal.id,
            eventId: googleId
        });
        return { success: true };
    } catch (e) {
        return { success: true }; // Treat 404/errors as "already deleted"
    }
}