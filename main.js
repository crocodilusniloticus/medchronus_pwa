const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
try {
  require('electron-reloader')(module);
} catch (_) {}

// 1. Configure Logging for Updates
log.transports.file.level = 'info';
autoUpdater.logger = log;

// 2. Data Migration Logic
function checkAndMigrateData() {
    const userDataPath = app.getPath('userData'); 
    const appDataPath = app.getPath('appData');
    
    const oldAppNames = ['pre-prep-hub', 'residency-prep-hub', 'MedChronus'];
    const localStoragePath = path.join(userDataPath, 'Local Storage');

    if (fs.existsSync(localStoragePath)) {
        log.info("Data exists in MedChronos. No migration needed.");
        return;
    }

    log.info("Checking for old data to migrate...");

    for (const oldName of oldAppNames) {
        const oldPath = path.join(appDataPath, oldName);
        if (fs.existsSync(oldPath)) {
            log.info(`Migrating data from: ${oldPath}`);
            try {
                fs.cpSync(oldPath, userDataPath, { recursive: true, force: true });
                log.info("Migration successful.");
                break; 
            } catch (err) {
                log.error("Migration failed:", err);
            }
        }
    }
}

// 3. Auto-Updater Logic
function setupAutoUpdater(window) {
  // Check for updates immediately on startup
  autoUpdater.checkForUpdatesAndNotify();

  // Listen for events to give feedback to the user (optional log viewing)
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available.');
    // Optionally notify render process here
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.');
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);
    // You could send this to the renderer to show a progress bar
    window.setProgressBar(progressObj.percent / 100);
  });

  autoUpdater.on('update-downloaded', (info) => {
    window.setProgressBar(-1); // Remove progress bar
    const response = dialog.showMessageBoxSync(window, {
      type: 'info',
      buttons: ['Restart and Install', 'Later'],
      title: 'Update Ready',
      message: 'A new version of MedChronos has been downloaded.',
      detail: 'Restart the application to apply the update?'
    });

    if (response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
}

// 4. Main Window Logic
app.commandLine.appendSwitch('force-device-scale-factor', '0.9');

async function handleFileOpen() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }]
    });
    if (!canceled) return filePaths[0];
}

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
    // Initialize Updater
    setupAutoUpdater(mainWindow);
  });
}

app.whenReady().then(() => {
    checkAndMigrateData();
    ipcMain.handle('dialog:openFile', handleFileOpen);
    createWindow();
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});

app.on('activate', () => { 
    if (BrowserWindow.getAllWindows().length === 0) createWindow(); 
});