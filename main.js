const { app, BrowserWindow } = require('electron');

// *** THIS IS THE FIX ***
// 1. Add the require statement for the package
try {
  require('electron-reloader')(module);
} catch (_) {}
// *** END OF FIX 1 ***

app.commandLine.appendSwitch('force-device-scale-factor', '1');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 1008,
    minWidth: 800,
    minHeight: 600,
    
    show: false,
    backgroundColor: '#f4f7f9',

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "Residency Prep Hub"
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // This is correctly commented out
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });