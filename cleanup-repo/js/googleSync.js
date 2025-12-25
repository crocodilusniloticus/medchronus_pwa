const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { DateTime } = require('luxon'); 
const { app } = require('electron'); 

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const USER_DATA_PATH = (process.env.APPDATA_PATH || process.cwd());
const CREDENTIALS_PATH = app.isPackaged 
    ? path.join(process.resourcesPath, 'credentials.json') 
    : path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(USER_DATA_PATH, 'token.json');

// --- UTILITIES ---

// 1. Sleep Function (Pause execution)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 2. Retry Wrapper (The "Anti-Crash" Shield)
// If Google says "Rate Limit", this waits and tries again automatically.
async function executeWithRetry(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (err) {
        // 403 or 429 = Rate Limit Exceeded
        if (retries > 0 && (err.code === 403 || err.code === 429)) {
            console.warn(`Rate limit hit. Retrying in ${delay}ms...`);
            await sleep(delay);
            return executeWithRetry(fn, retries - 1, delay * 2); // Double the wait time (Backoff)
        }
        throw err;
    }
}

// --- AUTHENTICATION ---
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) { return null; }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) return client;
  try { await fs.access(CREDENTIALS_PATH); } 
  catch (e) { throw new Error(`File not found: credentials.json`); }
  client = await authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });
  if (client.credentials) await saveCredentials(client);
  return client;
}

// --- BATCH PROCESSOR WITH THROTTLING ---
async function processInBatches(items, asyncCallback) {
    // Reduced batch size to 5 to stay under the speed limit
    const BATCH_SIZE = 5; 
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        
        // Execute batch
        await Promise.all(batch.map(item => executeWithRetry(() => asyncCallback(item))));
        
        // PAUSE: Wait 250ms between batches to let Google breathe
        if (i + BATCH_SIZE < items.length) {
            await sleep(250);
        }
    }
}

// --- SYNC LOGIC ---

async function pushEventsToGoogle(localEvents) {
    console.log("Starting Robust Mirroring...");
    const auth = await authorize();
    const calendar = google.calendar({version: 'v3', auth});

    // 1. Get Calendar ID
    const calList = await calendar.calendarList.list();
    let medCal = calList.data.items.find(c => c.summary === 'MedChronos');
    let calendarId = medCal ? medCal.id : null;

    if (!calendarId) {
        const newCal = await calendar.calendars.insert({ requestBody: { summary: 'MedChronos' } });
        calendarId = newCal.data.id;
    }

    // 2. PREPARE LOCAL DATA
    const activeLocalEvents = localEvents.filter(e => !e.isDone && e.date);
    
    let timeMinStr = undefined;
    if (activeLocalEvents.length > 0) {
        const sortedDates = activeLocalEvents.map(e => e.date).sort();
        const earliest = DateTime.fromISO(sortedDates[0]).minus({ days: 30 }); 
        if (earliest.isValid) timeMinStr = earliest.toISODate() + 'T00:00:00Z';
    } else {
        timeMinStr = DateTime.now().minus({ years: 1 }).toISODate() + 'T00:00:00Z';
    }

    // 3. FETCH GOOGLE EVENTS (Safe Fetch)
    let googleEvents = [];
    try {
        const listResp = await executeWithRetry(() => calendar.events.list({
            calendarId: calendarId,
            maxResults: 2500,
            singleEvents: true,
            timeMin: timeMinStr,
            fields: 'items(id,summary,start,end,colorId)',
        }));
        googleEvents = listResp.data.items || [];
    } catch (e) {
        console.warn("Could not list Google events.", e);
    }

    // 4. SORT ACTIONS
    const claimedGoogleIds = new Set();
    const updatesToSaveLocally = []; 
    const toInsert = [];
    const toUpdate = [];
    const toDelete = [];

    for (const localEvent of activeLocalEvents) {
        const startDate = DateTime.fromISO(localEvent.date);
        if (!startDate.isValid) continue;
        
        const dateStr = startDate.toISODate();
        const fuzzyKey = `${localEvent.title.trim().toLowerCase()}|${dateStr}`;

        let match = null;
        if (localEvent.googleId) {
            match = googleEvents.find(g => g.id === localEvent.googleId);
        }
        if (!match) {
            match = googleEvents.find(g => {
                const gDate = g.start.date || (g.start.dateTime ? g.start.dateTime.split('T')[0] : null);
                const gKey = `${(g.summary || '').trim().toLowerCase()}|${gDate}`;
                return gKey === fuzzyKey;
            });
        }

        let colorId = '9'; 
        if (localEvent.priority === 'high') colorId = '11'; 
        if (localEvent.priority === 'medium') colorId = '6'; 

        const resource = {
            summary: localEvent.title,
            description: `Priority: ${localEvent.priority || 'low'}`,
            start: { date: dateStr }, 
            end: { date: startDate.plus({ days: 1 }).toISODate() },
            colorId: colorId
        };

        if (match) {
            claimedGoogleIds.add(match.id);
            toUpdate.push({ id: match.id, resource, localEvent, originalId: match.id });
        } else {
            toInsert.push({ resource, localEvent });
        }
    }

    // Identify Deletions
    for (const gEvent of googleEvents) {
        if (!claimedGoogleIds.has(gEvent.id)) {
            toDelete.push(gEvent.id);
        }
    }

    // 5. EXECUTE (With Throttling)
    
    // A. Updates
    if (toUpdate.length > 0) {
        await processInBatches(toUpdate, async (item) => {
            await calendar.events.patch({
                calendarId: calendarId,
                eventId: item.id,
                resource: item.resource
            });
            if (item.localEvent.googleId !== item.originalId) {
                item.localEvent.googleId = item.originalId;
                updatesToSaveLocally.push(item.localEvent);
            }
        });
    }

    // B. Inserts
    if (toInsert.length > 0) {
        await processInBatches(toInsert, async (item) => {
            const res = await calendar.events.insert({
                calendarId: calendarId,
                resource: item.resource
            });
            item.localEvent.googleId = res.data.id;
            item.localEvent.isSynced = true;
            updatesToSaveLocally.push(item.localEvent);
        });
    }

    // C. Deletes
    if (toDelete.length > 0) {
        console.log(`Deleting ${toDelete.length} stray events...`);
        await processInBatches(toDelete, async (id) => {
            // 404/410 means already deleted, ignore those errors
            try {
                await calendar.events.delete({ calendarId: calendarId, eventId: id });
            } catch (e) {
                if(e.code !== 404 && e.code !== 410) throw e; 
            }
        });
    }

    return { updatedEvents: updatesToSaveLocally };
}

async function deleteSingleEvent(googleId) {
    try {
        const auth = await authorize();
        const calendar = google.calendar({version: 'v3', auth});
        const calList = await executeWithRetry(() => calendar.calendarList.list());
        let medCal = calList.data.items.find(c => c.summary === 'MedChronos');
        if (!medCal) return;
        
        await executeWithRetry(() => calendar.events.delete({ calendarId: medCal.id, eventId: googleId }));
    } catch (e) {
        // Ignore not found errors
        if (e.code !== 404 && e.code !== 410) console.error("Delete single failed:", e);
    }
}

module.exports = { pushEventsToGoogle, deleteSingleEvent };