const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Ensure Google Sync knows where to write credentials
process.env.APPDATA_PATH = app.getPath('userData');

try {
  require('electron-reloader')(module);
} catch (_) {}

log.transports.file.level = 'info';
autoUpdater.logger = log;

// --- ROBUST MIGRATION LOGIC ---
function checkAndMigrateData() {
    const userDataPath = app.getPath('userData'); 
    const appDataPath = app.getPath('appData');
    const migrationLockFile = path.join(userDataPath, 'migration.lock');

    // 1. If migration already happened, stop.
    if (fs.existsSync(migrationLockFile)) {
        log.info("Migration already completed. Skipping.");
        return;
    }

    // List of possible old app folder names
    const oldAppNames = ['residency-prep-hub', 'pre-prep-hub', 'MedChronus', 'medchronos-old'];
    
    log.info("Searching for old data to migrate...");

    for (const oldName of oldAppNames) {
        const oldPath = path.join(appDataPath, oldName);
        
        // Don't migrate from self
        if (oldPath === userDataPath) continue;

        if (fs.existsSync(oldPath)) {
            log.info(`Found old data at: ${oldPath}`);
            try {
                // 2. Backup current (empty) state just in case
                const backupPath = path.join(userDataPath, 'backup_before_migration');
                // Copy current contents to backup if they exist
                try {
                    fs.cpSync(userDataPath, backupPath, { recursive: true, force: true });
                } catch(e) { /* Ignore backup errors on fresh install */ }

                // 3. COPY OLD DATA
                // We copy strictly the Local Storage and IndexedDB folders 
                // to avoid breaking Electron internal configs
                const foldersToCopy = ['Local Storage', 'Session Storage', 'databases', 'IndexedDB'];
                
                let dataFound = false;
                
                foldersToCopy.forEach(folder => {
                    const src = path.join(oldPath, folder);
                    const dest = path.join(userDataPath, folder);
                    if (fs.existsSync(src)) {
                        log.info(`Copying ${folder}...`);
                        fs.cpSync(src, dest, { recursive: true, force: true });
                        dataFound = true;
                    }
                });

                if (dataFound) {
                    log.info("Migration successful.");
                    // Create lock file so we don't overwrite again
                    fs.writeFileSync(migrationLockFile, 'true');
                    break; 
                }
            } catch (err) {
                log.error("Migration failed:", err);
            }
        }
    }
    
    // If no old data found, mark migration as done to stop checking
    if (!fs.existsSync(migrationLockFile)) {
        fs.writeFileSync(migrationLockFile, 'false');
    }
}

// --- UPDATER ---
function setupAutoUpdater(window) {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('checking-for-update', () => log.info('Checking for update...'));
  autoUpdater.on('update-available', () => log.info('Update available.'));
  autoUpdater.on('update-not-available', () => log.info('Update not available.'));
  autoUpdater.on('error', (err) => log.error('Error in auto-updater. ' + err));

  autoUpdater.on('download-progress', (progressObj) => {
    window.setProgressBar(progressObj.percent / 100);
  });

  autoUpdater.on('update-downloaded', () => {
    window.setProgressBar(-1);
    const response = dialog.showMessageBoxSync(window, {
      type: 'info',
      buttons: ['Restart and Install', 'Later'],
      title: 'Update Ready',
      message: 'A new version has been downloaded.',
      detail: 'Restart now?'
    });
    if (response === 0) autoUpdater.quitAndInstall(false, true);
  });
}

// --- MAIN WINDOW ---
app.commandLine.appendSwitch('force-device-scale-factor', '0.9');

async function handleFileOpen() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }]
    });
    if (!canceled) return filePaths[0];
}

const googleSync = require('./js/googleSync');

ipcMain.handle('google-calendar-sync', async (event, localEvents) => {
    try {
        const stats = await googleSync.pushEventsToGoogle(localEvents);
        return { success: true, stats: stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('google-calendar-delete-one', async (event, googleId) => {
    try {
        await googleSync.deleteSingleEvent(googleId);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('google-auth-logout', async () => {
    try {
        const tokenPath = path.join(app.getPath('userData'), 'token.json');
        if (fs.existsSync(tokenPath)) await fs.promises.unlink(tokenPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('dialog:openFile', handleFileOpen);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1720, height: 1200, minWidth: 800, minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    backgroundColor: '#f4f7f9',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    title: `MedChronos v${app.getVersion()}`
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setupAutoUpdater(mainWindow);
  });
}

app.whenReady().then(() => {
    checkAndMigrateData(); // Run migration before window opens
    createWindow();
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});

app.on('activate', () => { 
    if (BrowserWindow.getAllWindows().length === 0) createWindow(); 
});